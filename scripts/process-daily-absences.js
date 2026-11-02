const admin = require('firebase-admin');

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const TZ = 'Asia/Riyadh';

function keyForDate(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const part = Object.fromEntries(
    parts.map(p => [p.type, p.value])
  );

  return `${part.year}-${part.month}-${part.day}`;
}

function dateFromKey(key) {
  return new Date(`${key}T00:00:00Z`);
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

function arrayHas(arr, key) {
  return Array.isArray(arr) && arr.includes(key);
}

async function processDailyAbsences() {
  const yesterdayKey = addDays(keyForDate(new Date()), -1);
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
        const startedAt = asDate(member.attendancePlanStartedAt);

        let last = typeof member.attendanceLastProcessedDate === 'string'
          ? member.attendanceLastProcessedDate
          : null;

        if (!startedAt || !last) return null;

        if (
          member.active === false ||
          member.membershipActive === false
        ) return null;

        if (last >= yesterdayKey) return null;

        let remaining = Number.isFinite(member.attendanceDaysRemaining)
          ? member.attendanceDaysRemaining
          : 30;

        let grace = Number.isFinite(member.graceAbsenceDaysRemaining)
          ? member.graceAbsenceDaysRemaining
          : 7;

        let cursor = addDays(last, 1);
        const dates = [];
        let guard = 0;

        while (cursor <= yesterdayKey && guard < 370) {
          dates.push(cursor);
          cursor = addDays(cursor, 1);
          guard++;
        }

        if (cursor <= yesterdayKey) {
          throw new Error('More than 370 unprocessed dates; admin review required.');
        }

        const attendanceRefs = dates.map(key =>
          memberRef.collection('attendance').doc(key)
        );

        const calendarRefs = dates.map(key =>
          db.collection('clubCalendar').doc(key)
        );

        const attendanceSnaps = [];
        const calendarSnaps = [];

        for (const ref of attendanceRefs) {
          attendanceSnaps.push(await tx.get(ref));
        }

        for (const ref of calendarRefs) {
          calendarSnaps.push(await tx.get(ref));
        }

        let lastProcessed = last;

        for (let i = 0; i < dates.length; i++) {
          const key = dates[i];
          const calendar = calendarSnaps[i].exists
            ? calendarSnaps[i].data()
            : {};

          const closed = calendar.closed === true ||
            calendar.type === 'closed';

          const paused = arrayHas(member.excludedAbsenceDates, key) ||
            arrayHas(member.attendancePauseDates, key);

          const ranges = Array.isArray(member.attendancePauseRanges)
            ? member.attendancePauseRanges
            : [];

          const inPauseRange = ranges.some(range =>
            range &&
            range.approved === true &&
            typeof range.startDate === 'string' &&
            typeof range.endDate === 'string' &&
            range.startDate <= key &&
            key <= range.endDate
          );

          const attended = attendanceSnaps[i].exists;
          const friday = weekdayForKey(key) === 5;

          if (!friday && !closed && !paused && !inPauseRange && !attended) {
            if (grace > 0) {
              grace--;
            } else {
              remaining = Math.max(0, remaining - 1);
            }
          }

          lastProcessed = key;
        }

        tx.set(memberRef, {
          attendanceDaysRemaining: remaining,
          graceAbsenceDaysRemaining: grace,
          attendanceLastProcessedDate: lastProcessed,
          attendanceAbsenceProcessedAt:
            admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return { datesProcessed: dates.length };
      });

      if (result) {
        processedMembers++;
        processedDates += result.datesProcessed;
      } else {
        skippedMembers++;
      }
    } catch (error) {
      errors++;
      console.error(
        'Failed to process member:',
        memberDoc.id,
        error.message
      );
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

processDailyAbsences()
  .then(() => {
    console.log('Daily absence processing finished.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Daily absence processing failed:', error);
    process.exit(1);
  });
