const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const TZ = 'Asia/Riyadh';

function keyForDate(date) {
  // Build YYYY-MM-DD using the club's local timezone, not the server timezone.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const part = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${part.year}-${part.month}-${part.day}`;
}
function dateFromKey(key) { return new Date(`${key}T00:00:00Z`); }
function addDays(key, count = 1) {
  const d = dateFromKey(key);
  d.setUTCDate(d.getUTCDate() + count);
  return keyForDate(d);
}
function weekdayForKey(key) { return dateFromKey(key).getUTCDay(); } // Friday = 5
function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
function arrayHas(arr, key) { return Array.isArray(arr) && arr.includes(key); }

async function processDailyAbsences() {
  // At 00:10 KSA, process the calendar day that just ended.
  const yesterdayKey = addDays(keyForDate(new Date()), -1);
  const membersSnap = await db.collection('members').get();
  let processedMembers = 0, processedDates = 0, skippedMembers = 0, errors = 0;

  for (const memberDoc of membersSnap.docs) {
    try {
      const memberRef = memberDoc.ref;
      await db.runTransaction(async tx => {
        const freshSnap = await tx.get(memberRef);
        if (!freshSnap.exists) return;
        const member = freshSnap.data();
        const startedAt = asDate(member.attendancePlanStartedAt);
        let last = typeof member.attendanceLastProcessedDate === 'string'
          ? member.attendanceLastProcessedDate : null;

        // A membership's attendance plan begins only after its first successful scan.
        if (!startedAt || !last) { skippedMembers++; return; }
        if (member.active === false || member.membershipActive === false) { skippedMembers++; return; }
        if (last >= yesterdayKey) { skippedMembers++; return; }

        let remaining = Number.isFinite(member.attendanceDaysRemaining) ? member.attendanceDaysRemaining : 30;
        let grace = Number.isFinite(member.graceAbsenceDaysRemaining) ? member.graceAbsenceDaysRemaining : 7;
        let cursor = addDays(last, 1);
        const work = [];
        let guard = 0;
        while (cursor <= yesterdayKey && guard < 370) {
          work.push(cursor);
          cursor = addDays(cursor, 1);
          guard++;
        }
        if (cursor <= yesterdayKey) throw new Error('More than 370 unprocessed dates; admin review required.');

        // Complete all reads before writes, as required by Firestore transactions.
        const attendanceRefs = work.map(key => memberRef.collection('attendance').doc(key));
        const calendarRefs = work.map(key => db.collection('clubCalendar').doc(key));
        const attendanceSnaps = [];
        const calendarSnaps = [];
        for (const ref of attendanceRefs) attendanceSnaps.push(await tx.get(ref));
        for (const ref of calendarRefs) calendarSnaps.push(await tx.get(ref));

        let lastProcessed = last;
        let changedDates = 0;
        for (let i = 0; i < work.length; i++) {
          const key = work[i];
          const day = dateFromKey(key);
          const calendar = calendarSnaps[i].exists ? calendarSnaps[i].data() : {};
          const closedGlobally = calendar.closed === true || calendar.type === 'closed';
          const isPaused = arrayHas(member.excludedAbsenceDates, key)
            || arrayHas(member.attendancePauseDates, key);
          const pauseRanges = Array.isArray(member.attendancePauseRanges) ? member.attendancePauseRanges : [];
          const inPauseRange = pauseRanges.some(r => r && typeof r.startDate === 'string' && typeof r.endDate === 'string' && r.startDate <= key && key <= r.endDate && r.approved === true);
          const attended = attendanceSnaps[i].exists;
          const isFriday = weekdayForKey(key) === 5;

          if (!isFriday && !closedGlobally && !isPaused && !inPauseRange && !attended) {
            if (grace > 0) grace -= 1;
            else remaining = Math.max(0, remaining - 1);
          }
          lastProcessed = key;
          changedDates++;
        }

        tx.set(memberRef, {
          attendanceDaysRemaining: remaining,
          graceAbsenceDaysRemaining: grace,
          attendanceLastProcessedDate: lastProcessed,
          attendanceAbsenceProcessedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        processedMembers++;
        processedDates += changedDates;
      });
    } catch (err) {
      errors++;
      logger.error('Failed to process member absence dates', { memberId: memberDoc.id, error: String(err) });
    }
  }

  logger.info('Daily absence run completed', { yesterdayKey, processedMembers, processedDates, skippedMembers, errors });
}

processDailyAbsences().then(() => {
  console.log("Daily absence processing finished.");
  process.exit(0);
}).catch(error => {
  console.error("Daily absence processing failed:", error);
  process.exit(1);
});
