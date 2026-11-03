// Blue Agate - Attendance & Membership Balance
// يعتمد على Firebase Auth + Firestore.
// يبدأ الاشتراك عند أول حضور ناجح.
// التوقيت المعتمد: Asia/Riyadh.

const ATTENDANCE_DAYS = 30;
const GRACE_DAYS = 7;
const TIME_ZONE = "Asia/Riyadh";


// ======================================
// DATE HELPERS
// ======================================

function localDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function dateFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isFriday(dateKey) {
  return dateFromKey(dateKey).getUTCDay() === 5;
}

function previousClubDay(date) {
  const previous = new Date(date);
  previous.setUTCDate(previous.getUTCDate() - 1);

  // الجمعة إجازة ولا تدخل في حساب الاستمرارية
  if (previous.getUTCDay() === 5) {
    previous.setUTCDate(previous.getUTCDate() - 1);
  }

  return previous;
}


// ======================================
// MESSAGES
// ======================================

function updateAttendanceMessage(message, type = "info") {
  const box = document.getElementById("attendance-message");

  if (!box) return;

  box.textContent = message;
  box.className = `attendance-message ${type}`;
  box.hidden = false;
}


// ======================================
// LOAD ATTENDANCE
// ======================================

async function loadAttendance() {
  const user = firebase.auth().currentUser;

  if (!user) return;

  const db = firebase.firestore();

  try {
    const memberRef = db.collection("members").doc(user.uid);

    const [memberSnapshot, attendanceSnapshot] = await Promise.all([
      memberRef.get(),

      memberRef
        .collection("attendance")
        .orderBy("dateKey", "desc")
        .get()
    ]);

    if (!memberSnapshot.exists) {
      updateAttendanceMessage(
        "تعذر العثور على بيانات العضوية.",
        "error"
      );
      return;
    }

    const member = memberSnapshot.data();

    const dates = [];

    attendanceSnapshot.forEach(doc => {
      const data = doc.data();

      if (data.dateKey) {
        dates.push(data.dateKey);
      }
    });

    renderAttendance(dates, member);

  } catch (error) {
    console.error("Attendance load error:", error);

    updateAttendanceMessage(
      "تعذر تحميل سجل الحضور حاليًا.",
      "error"
    );
  }
}


// ======================================
// STREAK
// ======================================

function calculateStreak(dateKeys) {
  const uniqueDates = [...new Set(dateKeys)].sort().reverse();

  if (!uniqueDates.length) return 0;

  const todayKey = localDateKey();

  let current = uniqueDates.includes(todayKey)
    ? dateFromKey(todayKey)
    : dateFromKey(uniqueDates[0]);

  let streak = 0;

  while (true) {
    const key = localDateKey(current);

    if (uniqueDates.includes(key)) {
      streak++;
    } else if (current.getUTCDay() === 5) {
      // الجمعة لا تكسر الاستمرارية
    } else {
      break;
    }

    const previous = previousClubDay(current);

    if (previous.getTime() === current.getTime()) {
      break;
    }

    current = previous;
  }

  return streak;
}


// ======================================
// RENDER ATTENDANCE
// ======================================

function renderAttendance(dateKeys, member = {}) {
  const streakEl = document.getElementById("streak-number");
  const totalEl = document.getElementById("attendance-total");
  const listEl = document.getElementById("attendance-list");
  const todayStatus = document.getElementById(
    "attendance-today-status"
  );

  const todayKey = localDateKey();

  const hasToday = dateKeys.includes(todayKey);

  const streak = calculateStreak(dateKeys);

  const remaining = Number.isFinite(member.attendanceDaysRemaining)
    ? member.attendanceDaysRemaining
    : ATTENDANCE_DAYS;

  const grace = Number.isFinite(member.graceAbsenceDaysRemaining)
    ? member.graceAbsenceDaysRemaining
    : GRACE_DAYS;

  const planStarted = Boolean(member.attendancePlanStartedAt);

  const inactive =
    member.active === false ||
    member.membershipActive === false;

  const noBalance = planStarted && remaining <= 0;

  if (streakEl) {
    streakEl.textContent = streak;
  }

  if (totalEl) {
    totalEl.textContent = dateKeys.length;
  }

  if (todayStatus) {
    if (hasToday) {
      todayStatus.textContent = "تم تسجيل حضورك اليوم ✓";
      todayStatus.className = "attendance-status done";
    } else if (noBalance) {
      todayStatus.textContent = "انتهى رصيد اشتراكك.";
      todayStatus.className = "attendance-status";
    } else {
      todayStatus.textContent = "لم تسجلي حضورك اليوم بعد";
      todayStatus.className = "attendance-status";
    }
  }

  const button = document.getElementById("attendance-btn");

  if (button) {
    button.disabled = hasToday || noBalance || inactive ||
      isFriday(todayKey);

    if (hasToday) {
      button.textContent = "تم تسجيل حضور اليوم ✓";
    } else if (noBalance) {
      button.textContent = "انتهى رصيد الاشتراك";
    } else if (inactive) {
      button.textContent = "الاشتراك غير نشط";
    } else if (isFriday(todayKey)) {
      button.textContent = "النادي مغلق يوم الجمعة";
    } else {
      button.textContent = "سجّلي حضوري اليوم";
    }
  }

  // عرض سجل الحضور
  if (listEl) {
    if (!dateKeys.length) {
      listEl.innerHTML =
        '<div class="attendance-empty">ما عندك سجل حضور حتى الآن.</div>';
    } else {
      listEl.innerHTML = dateKeys.slice(0, 10).map(key => {
        const date = dateFromKey(key);

        return `
          <div class="attendance-row">
            <span>
              ${date.toLocaleDateString("ar-SA", {
                timeZone: TIME_ZONE,
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
              })}
            </span>
            <strong>✓ حضور</strong>
          </div>
        `;
      }).join("");
    }
  }
}


// ======================================
// REGISTER ATTENDANCE
// ======================================

async function registerAttendance() {
  const user = firebase.auth().currentUser;

  if (!user) {
    updateAttendanceMessage(
      "سجّلي الدخول أولًا.",
      "error"
    );
    return;
  }

  const button = document.getElementById("attendance-btn");

  if (button) {
    button.disabled = true;
  }

  const todayKey = localDateKey();

  if (isFriday(todayKey)) {
    updateAttendanceMessage(
      "النادي مغلق يوم الجمعة، لذلك لا يوجد تسجيل حضور اليوم.",
      "info"
    );

    if (button) button.disabled = true;

    return;
  }

  const db = firebase.firestore();

  const memberRef = db.collection("members").doc(user.uid);

  const attendanceRef = memberRef
    .collection("attendance")
    .doc(todayKey);

  try {
    const result = await db.runTransaction(async transaction => {

      // قراءة بيانات العضوة
      const memberSnapshot = await transaction.get(memberRef);

      if (!memberSnapshot.exists) {
        throw new Error("MEMBER_NOT_FOUND");
      }

      const member = memberSnapshot.data();

      // التأكد من أن الاشتراك نشط
      if (
        member.active === false ||
        member.membershipActive === false
      ) {
        throw new Error("MEMBERSHIP_INACTIVE");
      }

      // قراءة سجل حضور اليوم
      const attendanceSnapshot = await transaction.get(
        attendanceRef
      );

      if (attendanceSnapshot.exists) {
        throw new Error("ALREADY_ATTENDED");
      }

      const planStarted = Boolean(
        member.attendancePlanStartedAt
      );

      let remaining;
      let grace;

      const updates = {};

      // أول حضور: بدء خطة الاشتراك
      if (!planStarted) {

        remaining = ATTENDANCE_DAYS;
        grace = GRACE_DAYS;

        updates.attendancePlanStartedAt =
          firebase.firestore.FieldValue.serverTimestamp();

        updates.attendanceDaysRemaining = ATTENDANCE_DAYS;

        updates.graceAbsenceDaysRemaining = GRACE_DAYS;

        // يبدأ المعالج من اليوم التالي لتاريخ اليوم السابق
        // حتى يعالج يوم أول حضور في تشغيله القادم.
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        updates.attendanceLastProcessedDate =
          localDateKey(yesterday);

      } else {

        remaining = Number.isFinite(
          member.attendanceDaysRemaining
        )
          ? member.attendanceDaysRemaining
          : 0;

        grace = Number.isFinite(
          member.graceAbsenceDaysRemaining
        )
          ? member.graceAbsenceDaysRemaining
          : 0;

        if (remaining <= 0) {
          throw new Error("NO_BALANCE");
        }
      }

      // تسجيل الحضور
      transaction.set(attendanceRef, {
        uid: user.uid,
        dateKey: todayKey,
        timestamp:
          firebase.firestore.FieldValue.serverTimestamp()
      });

      // تهيئة بيانات الاشتراك عند أول حضور فقط
      if (!planStarted) {
        transaction.set(memberRef, updates, {
          merge: true
        });
      }

      return {
        firstAttendance: !planStarted
      };
    });

    if (result.firstAttendance) {
      updateAttendanceMessage(
        "تم تسجيل حضورك وبدأ اشتراكك بنجاح! رصيدك 30 يومًا و7 أيام سماح 💙",
        "success"
      );
    } else {
      updateAttendanceMessage(
        "تم تسجيل حضورك بنجاح! استمري 💙",
        "success"
      );
    }

    await loadAttendance();

  } catch (error) {
    console.error("Attendance write error:", error);

    if (error.message === "ALREADY_ATTENDED") {
      updateAttendanceMessage(
        "تم تسجيل حضورك اليوم بالفعل ✓",
        "success"
      );

      await loadAttendance();

    } else if (error.message === "NO_BALANCE") {
      updateAttendanceMessage(
        "انتهى رصيد اشتراكك. راجعي الإدارة لتجديد الاشتراك.",
        "error"
      );

      await loadAttendance();

    } else if (error.message === "MEMBERSHIP_INACTIVE") {
      updateAttendanceMessage(
        "اشتراكك غير نشط حاليًا. راجعي الإدارة.",
        "error"
      );

      await loadAttendance();

    } else if (error.message === "MEMBER_NOT_FOUND") {
      updateAttendanceMessage(
        "لم يتم العثور على بيانات عضويتك.",
        "error"
      );

    } else {
      updateAttendanceMessage(
        "تعذر تسجيل الحضور. تأكدي من الاتصال وحاولي مرة أخرى.",
        "error"
      );

      await loadAttendance();
    }
  }
}


// ======================================
// INITIALIZE
// ======================================

function initAttendance() {
  const button = document.getElementById("attendance-btn");

  if (button) {
    button.addEventListener("click", registerAttendance);
  }

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      loadAttendance();
    }
  });
}

document.addEventListener(
  "DOMContentLoaded",
  initAttendance
);
