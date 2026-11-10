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

function numericBalance(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

// ======================================
// PROCESS DAILY ABSENCES
// ======================================

async function processDailyAbsences() {
  const todayKey = keyForDate(new Date());
  const yesterdayKey = addDays(todayKey, -1);
  const membersSnap = await db.collection('members').get();
  let processedMembers = 0, processedDates = 0, skippedMembers = 0, errors = 0;

  for (const memberDoc of membersSnap.docs) {
    try {
      const memberRef = memberDoc.ref;
      // Firestore transactions support document reads, not Query reads. Load absence
      // requests before the transaction and index them by date for this processing run.
      const absenceRequestsSnapshot = await memberRef.collection('absenceRequests').get();
      const absenceRequestsByDate = new Map();
      for (const requestDoc of absenceRequestsSnapshot.docs) {
        const requestData = requestDoc.data();
        if (!requestData.dateKey) continue;
        if (!absenceRequestsByDate.has(requestData.dateKey)) absenceRequestsByDate.set(requestData.dateKey, []);
        absenceRequestsByDate.get(requestData.dateKey).push(requestData);
      }
      const result = await db.runTransaction(async tx => {
        const freshSnap = await tx.get(memberRef);
        if (!freshSnap.exists) return null;
        const member = freshSnap.data();
        if (member.active === false || member.membershipActive === false) return null;

        const startKey = dateKeyForTimestamp(member.startDate);
        let endKey = dateKeyForTimestamp(member.endDate);
        if (!startKey || !endKey) return null;
        const last = typeof member.attendanceLastProcessedDate === 'string' ? member.attendanceLastProcessedDate : null;
        if (!last) return null;
        if (last >= yesterdayKey) return null;

        let attendanceRemaining = numericBalance(member.attendanceDaysRemaining, 30);
        let graceRemaining = numericBalance(member.graceAbsenceDaysRemaining, 7);
        let cursor = addDays(last, 1);
        const dates = [];
        while (cursor <= yesterdayKey && dates.length < MAX_DATES_PER_RUN) {
          dates.push(cursor); cursor = addDays(cursor, 1);
        }
        if (!dates.length) return null;

        const attendanceSnaps = [];
        const calendarSnaps = [];
        for (const key of dates) {
          attendanceSnaps.push(await tx.get(memberRef.collection('attendance').doc(key)));
          calendarSnaps.push(await tx.get(db.collection('clubCalendar').doc(key)));
        }

        let lastProcessed = last;
        let closedCompensationDays = 0;
        let approvedLeaveDays = 0;
        let ordinaryGraceDays = 0;
        let ordinaryMembershipDays = 0;
        let processed = 0;

        for (let i = 0; i < dates.length; i++) {
          const key = dates[i];
          if (key < startKey) { lastProcessed = key; processed++; continue; }
          if (key > endKey) break;
          const calendar = calendarSnaps[i].exists ? calendarSnaps[i].data() : {};
          const attended = attendanceSnaps[i].exists;
          const dateRequests = absenceRequestsByDate.get(key) || [];
          const approvedLeave = dateRequests.some(request => request.status === 'approved');
          const approvedLeaveAlreadyApplied = dateRequests.some(request => request.status === 'approved' && request.balanceApplied === true);
          const isFriday = weekdayForKey(key) === 5;

          // Fridays are the club's normal weekly closure; no compensation is added.
          if (isFriday) {
            lastProcessed = key; processed++; continue;
          }

          // A recorded club-wide closure extends the membership end date by one calendar day.
          if (isClubClosed(calendar)) {
            // Some future closure dates are compensated immediately by the admin panel.
            // Skip those dates here so the scheduled processor cannot extend twice.
            if (!arrayHas(member.compensatedClosureDates, key)) {
              const beforeEndKey = endKey;
              endKey = addDays(endKey, 1);
              closedCompensationDays++;
              const adjustmentRef = memberRef.collection('subscriptionAdjustments').doc(`closure_${key}`);
              tx.set(adjustmentRef, {
                type: 'closure',
                days: 1,
                reason: calendar.reason || calendar.closureType || 'إغلاق النادي',
                closureType: calendar.closureType || 'other',
                closureDate: key,
                beforeEndDate: beforeEndKey,
                afterEndDate: endKey,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: calendar.closureCreatedBy || 'system',
                visibleToMember: true
              }, { merge: true });
            }
            lastProcessed = key; processed++; continue;
          }

          if (isExcluded(member, key) || isApprovedPause(member, key)) {
            lastProcessed = key; processed++; continue;
          }

          if (attended) {
            // Reception has already deducted one attendance day at check-in.
            lastProcessed = key; processed++; continue;
          }

          if (approvedLeave) {
            // Approved absence uses grace allowance only, never the 30-day attendance balance.
            if (!approvedLeaveAlreadyApplied && graceRemaining > 0) graceRemaining--;
            approvedLeaveDays++;
          } else if (graceRemaining > 0) {
            graceRemaining--;
            ordinaryGraceDays++;
          } else {
            attendanceRemaining = Math.max(0, attendanceRemaining - 1);
            ordinaryMembershipDays++;
          }

          lastProcessed = key; processed++;
        }

        if (!processed) return null;
        const update = {
          attendanceDaysRemaining: attendanceRemaining,
          graceAbsenceDaysRemaining: graceRemaining,
          absenceAllowanceDays: 7,
          absenceAllowanceDaysRemaining: graceRemaining,
          graceAbsenceDaysConsumed: Math.max(0, 7 - graceRemaining),
          attendanceLastProcessedDate: lastProcessed,
          attendanceAbsenceProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
          attendancePlanVersion: 2
        };
        if (closedCompensationDays > 0) {
          update.endDate = timestampAtKsaEndOfDay(endKey);
          update.compensatedClosureDates = admin.firestore.FieldValue.arrayUnion(...dates.filter(key => {
            const cal = calendarSnaps[dates.indexOf(key)];
            return cal && cal.exists && isClubClosed(cal.data()) && !arrayHas(member.compensatedClosureDates, key);
          }));
          update.subscriptionExtensionDaysTotal = admin.firestore.FieldValue.increment(closedCompensationDays);
        }
        tx.set(memberRef, update, { merge: true });
        return { datesProcessed: processed, attendanceDaysRemaining: attendanceRemaining,
          graceAbsenceDaysRemaining: graceRemaining, approvedLeaveDays, ordinaryGraceDays,
          ordinaryMembershipDays, closedCompensationDays, endDateKey: endKey };
      });

      if (result) {
        processedMembers++; processedDates += result.datesProcessed;
        console.log('Member processed:', memberDoc.id, result);
      } else skippedMembers++;
    } catch (error) {
      errors++; console.error('Failed to process member:', memberDoc.id, error);
    }
  }

  console.log('Daily absence run completed', { yesterdayKey, processedMembers, processedDates, skippedMembers, errors });
  if (errors > 0) throw new Error(`Processing finished with ${errors} member error(s).`);
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
