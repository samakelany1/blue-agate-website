const admin = require('firebase-admin');

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const TZ = 'Asia/Riyadh';
const MAX_DATES_PER_RUN = 30;

// ======================================
// DATE HELPERS
// ======================================

function keyForDate(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const part = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${part.year}-${part.month}-${part.day}`;
}

function dateFromKey(key) {
  return new Date(`${key}T00:00:00.000Z`);
}

function addDays(key, count = 1) {
  const date = dateFromKey(key);
  date.setUTCDate(date.getUTCDate() + count);
  return keyForDate(date);
}

function weekdayForKey(key) {
  return dateFromKey(key).getUTCDay();
}

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKeyForTimestamp(value) {
  const date = asDate(value);
  return date ? keyForDate(date) : null;
}

// Firestore endDate is stored as the end of the day in Saudi Arabia (UTC+3).
function timestampAtKsaEndOfDay(key) {
  return admin.firestore.Timestamp.fromDate(
    new Date(`${key}T20:59:59.999Z`)
  );
}

function arrayHas(arr, key) {
  return Array.isArray(arr) && arr.includes(key);
}

function isClubClosed(calendar) {
  return calendar.closed === true || calendar.type === 'closed';
}

// Approved pause ranges are treated as approved medical/excused leave.
function isApprovedPause(member, key) {
  const ranges = Array.isArray(member.attendancePauseRanges)
    ? member.attendancePauseRanges
    : [];

  return ranges.some(range =>
    range &&
    range.approved === true &&
    typeof range.startDate === 'string' &&
    typeof range.endDate === 'string' &&
    range.startDate <= key &&
    key <= range.endDate
  );
}

// These dates are excluded from absence calculation without extending membership.
function isExcluded(member, key) {
  return arrayHas(member.excludedAbsenceDates, key) ||
    arrayHas(member.attendancePauseDates, key);
}

function getAllowance(member) {
  const value = Number(member.absenceAllowanceDaysRemaining);
  return Number.isFinite(value) ? Math.max(0, value) : null;
}

// ======================================
// PROCESS DAILY ABSENCES
// ======================================

async function processDailyAbsences() {
  const todayKey = keyForDate(new Date());
  const yesterdayKey = addDays(todayKey, -1);
  const membersSnap = await db.collection('members').get();

  let processedMembers = 0;
  let processedDates = 0;
  let skippedMembers = 0;
  let errors = 0;

  for (const memberDoc of membersSnap.docs) {
    try {
      const memberRef = memberDoc.ref;

      const result = await db.runTransaction(async tx => {
        const freshSnap = await tx.get(memberRef);
        if (!freshSnap.exists) return null;

        const member = freshSnap.data();

        if (member.active === false || member.membershipActive === false) {
          return null;
        }

        const startKey = dateKeyForTimestamp(member.startDate);
        let endKey = dateKeyForTimestamp(member.endDate);

        if (!startKey || !endKey) {
          console.log('Skipped member: missing startDate/endDate', memberDoc.id);
          return null;
        }

        // The admin panel initializes this to the day before the subscription starts.
        // Do not silently apply the new policy to old historical records.
        const last = typeof member.attendanceLastProcessedDate === 'string'
          ? member.attendanceLastProcessedDate
          : null;

        if (!last) {
          console.log('Skipped member: attendanceLastProcessedDate is missing', memberDoc.id);
          return null;
        }

        let remaining = getAllowance(member);
        if (remaining === null) {
          console.log('Skipped member: absenceAllowanceDaysRemaining is missing or invalid', memberDoc.id);
          return null;
        }

        if (last >= yesterdayKey) return null;

        let cursor = addDays(last, 1);
        const dates = [];

        // Collect a bounded batch. End-date extensions are calculated below in date order.
        while (cursor <= yesterdayKey && dates.length < MAX_DATES_PER_RUN) {
          dates.push(cursor);
          cursor = addDays(cursor, 1);
        }

        if (dates.length === 0) return null;

        const attendanceRefs = dates.map(key =>
          memberRef.collection('attendance').doc(key)
        );
        const calendarRefs = dates.map(key =>
          db.collection('clubCalendar').doc(key)
        );

        // Complete all transaction reads before writing.
        const attendanceSnaps = [];
        for (const ref of attendanceRefs) attendanceSnaps.push(await tx.get(ref));

        const calendarSnaps = [];
        for (const ref of calendarRefs) calendarSnaps.push(await tx.get(ref));

        let lastProcessed = last;
        let extendedDays = 0;
        let absenceDaysUsed = 0;
        let medicalDaysExtended = 0;
        let datesActuallyProcessed = 0;

        for (let i = 0; i < dates.length; i++) {
          const key = dates[i];

          // Only process dates covered by the current subscription end date.
          // A qualifying absence or approved medical day may extend endKey by one day.
          if (key > endKey) break;

          const calendar = calendarSnaps[i].exists
            ? calendarSnaps[i].data()
            : {};

          if (weekdayForKey(key) === 5 || isClubClosed(calendar)) {
            lastProcessed = key;
            datesActuallyProcessed++;
            continue;
          }

          if (isExcluded(member, key)) {
            lastProcessed = key;
            datesActuallyProcessed++;
            continue;
          }

          const attended = attendanceSnaps[i].exists;
          const approvedMedicalLeave = isApprovedPause(member, key);

          if (approvedMedicalLeave) {
            // Approved medical leave extends the subscription independently
            // and does not consume the regular absence allowance.
            if (!attended) {
              endKey = addDays(endKey, 1);
              extendedDays++;
              medicalDaysExtended++;
            }
          } else if (!attended) {
            // Regular absence consumes the allowance first.
            if (remaining > 0) {
              remaining--;
              absenceDaysUsed++;
            } else {
              endKey = addDays(endKey, 1);
              extendedDays++;
            }
          }
          // Attendance does not consume absence allowance.

          lastProcessed = key;
          datesActuallyProcessed++;
        }

        if (datesActuallyProcessed === 0) return null;

        const update = {
          absenceAllowanceDaysRemaining: remaining,
          attendanceLastProcessedDate: lastProcessed,
          attendanceAbsenceProcessedAt:
            admin.firestore.FieldValue.serverTimestamp()
        };

        if (extendedDays > 0) {
          update.endDate = timestampAtKsaEndOfDay(endKey);
        }

        tx.set(memberRef, update, { merge: true });

        return {
          datesProcessed: datesActuallyProcessed,
          absenceAllowanceDaysRemaining: remaining,
          absenceDaysUsed,
          extendedDays,
          medicalDaysExtended,
          endDateKey: endKey
        };
      });

      if (result) {
        processedMembers++;
        processedDates += result.datesProcessed;

        console.log('Member processed:', memberDoc.id, result);
      } else {
        skippedMembers++;
      }
    } catch (error) {
      errors++;
      console.error('Failed to process member:', memberDoc.id, error);
    }
  }

  console.log('Daily absence run completed', {
    yesterdayKey,
    processedMembers,
    processedDates,
    skippedMembers,
    errors
  });

  if (errors > 0) {
    throw new Error(`Processing finished with ${errors} member error(s).`);
  }
}

// ======================================
// RUN
// ======================================

processDailyAbsences()
  .then(() => {
    console.log('Daily absence processing finished.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Daily absence processing failed:', error);
    process.exit(1);
  });
