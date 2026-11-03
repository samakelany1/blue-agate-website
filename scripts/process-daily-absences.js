const admin = require('firebase-admin');

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const TZ = 'Asia/Riyadh';

const INITIAL_ATTENDANCE_DAYS = 30;
const INITIAL_GRACE_DAYS = 7;

// معالجة 30 يومًا كحد أقصى في التشغيل الواحد
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

  if (typeof value.toDate === 'function') {
    return value.toDate();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function arrayHas(arr, key) {
  return Array.isArray(arr) && arr.includes(key);
}


// ======================================
// CLUB CLOSURE / PAUSE CHECK
// ======================================

function isPaused(member, key) {
  const excluded =
    arrayHas(member.excludedAbsenceDates, key) ||
    arrayHas(member.attendancePauseDates, key);

  if (excluded) return true;

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

function isClubClosed(calendar) {
  return calendar.closed === true ||
    calendar.type === 'closed';
}


// ======================================
// PROCESS DAILY ABSENCES AND ATTENDANCE
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

        // لا تتم معالجة العضويات غير النشطة
        if (
          member.active === false ||
          member.membershipActive === false
        ) {
          return null;
        }

        // تاريخ بداية نظام الحضور
        const startedAt = asDate(
          member.attendancePlanStartedAt
        );

        // لا يبدأ الخصم قبل أول حضور
        if (!startedAt) return null;

        const startKey = keyForDate(startedAt);

        // آخر تاريخ تمت معالجته
        let last =
          typeof member.attendanceLastProcessedDate === 'string'
            ? member.attendanceLastProcessedDate
            : addDays(startKey, -1);

        // حماية من معالجة تواريخ تسبق بداية الاشتراك
        if (last < addDays(startKey, -1)) {
          last = addDays(startKey, -1);
        }

        // لا توجد تواريخ جديدة للمعالجة
        if (last >= yesterdayKey) {
          return null;
        }

        // رصيد أيام الاشتراك
        let remaining = Number.isFinite(
          member.attendanceDaysRemaining
        )
          ? Math.max(0, member.attendanceDaysRemaining)
          : INITIAL_ATTENDANCE_DAYS;

        // رصيد أيام السماح
        let grace = Number.isFinite(
          member.graceAbsenceDaysRemaining
        )
          ? Math.max(0, member.graceAbsenceDaysRemaining)
          : INITIAL_GRACE_DAYS;


        // ======================================
        // PREPARE DATES
        // ======================================

        let cursor = addDays(last, 1);

        const dates = [];

        while (
          cursor <= yesterdayKey &&
          dates.length < MAX_DATES_PER_RUN
        ) {
          dates.push(cursor);

          cursor = addDays(cursor, 1);
        }

        if (dates.length === 0) return null;


        // ======================================
        // FIRESTORE REFERENCES
        // ======================================

        const attendanceRefs = dates.map(key =>
          memberRef.collection('attendance').doc(key)
        );

        const calendarRefs = dates.map(key =>
          db.collection('clubCalendar').doc(key)
        );


        // ======================================
        // READ ATTENDANCE
        // ======================================

        const attendanceSnaps = [];

        for (const ref of attendanceRefs) {
          attendanceSnaps.push(await tx.get(ref));
        }


        // ======================================
        // READ CLUB CALENDAR
        // ======================================

        const calendarSnaps = [];

        for (const ref of calendarRefs) {
          calendarSnaps.push(await tx.get(ref));
        }


        // ======================================
        // CALCULATE BALANCES
        // ======================================

        let lastProcessed = last;

        for (let i = 0; i < dates.length; i++) {

          const key = dates[i];

          const calendar = calendarSnaps[i].exists
            ? calendarSnaps[i].data()
            : {};

          const attended = attendanceSnaps[i].exists;

          const friday = weekdayForKey(key) === 5;

          const closed = isClubClosed(calendar);

          const paused = isPaused(member, key);


          // الجمعة لا تخصم
          if (friday) {
            lastProcessed = key;
            continue;
          }

          // أيام إغلاق النادي لا تخصم
          if (closed) {
            lastProcessed = key;
            continue;
          }

          // الإيقاف المعتمد لا يخصم
          if (paused) {
            lastProcessed = key;
            continue;
          }


          // ======================================
          // ATTENDANCE DAY
          // ======================================

          if (attended) {

            // كل حضور يخصم يوم اشتراك
            remaining = Math.max(0, remaining - 1);

          }


          // ======================================
          // ABSENCE DAY
          // ======================================

          else {

            // خصم الغياب من أيام السماح أولًا
            if (grace > 0) {

              grace--;

            }

            // بعد انتهاء السماح يخصم من الاشتراك
            else {

              remaining = Math.max(0, remaining - 1);

            }

          }

          lastProcessed = key;
        }


        // ======================================
        // SAVE MEMBER BALANCES
        // ======================================

        tx.set(memberRef, {

          attendanceDaysRemaining: remaining,

          graceAbsenceDaysRemaining: grace,

          attendanceLastProcessedDate: lastProcessed,

          attendanceAbsenceProcessedAt:
            admin.firestore.FieldValue.serverTimestamp()

        }, {
          merge: true
        });


        return {
          datesProcessed: dates.length,
          attendanceDaysRemaining: remaining,
          graceAbsenceDaysRemaining: grace
        };

      });


      if (result) {

        processedMembers++;

        processedDates += result.datesProcessed;

        console.log('Member processed:', memberDoc.id, {
          datesProcessed: result.datesProcessed,
          attendanceDaysRemaining:
            result.attendanceDaysRemaining,
          graceAbsenceDaysRemaining:
            result.graceAbsenceDaysRemaining
        });

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


  // ======================================
  // FINAL REPORT
  // ======================================

  console.log('Daily absence run completed', {

    yesterdayKey,

    processedMembers,

    processedDates,

    skippedMembers,

    errors

  });


  if (errors > 0) {

    throw new Error(
      `Processing finished with ${errors} member error(s).`
    );

  }

}


// ======================================
// RUN
// ======================================

processDailyAbsences()

  .then(() => {

    console.log(
      'Daily absence processing finished.'
    );

    process.exit(0);

  })

  .catch(error => {

    console.error(
      'Daily absence processing failed:',
      error
    );

    process.exit(1);

  });
