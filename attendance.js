// Blue Agate - Attendance & Membership
// يعتمد على Firebase Auth + Firestore.
// مدة الاشتراك وتاريخ انتهائه تُدار من لوحة الإدارة.
// رصيد الغياب لا يمنع تسجيل الحضور؛ عند نفاده يمدد المعالج نهاية الاشتراك عن أيام الغياب الإضافية.
// التوقيت المعتمد: Asia/Riyadh.

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

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
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
  if (previous.getUTCDay() === 5) previous.setUTCDate(previous.getUTCDate() - 1);
  return previous;
}

function firestoreValueToDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function memberDateKey(value) {
  const date = firestoreValueToDate(value);
  return date ? localDateKey(date) : null;
}

function membershipStatus(member, todayKey = localDateKey()) {
  if (member.active === false || member.membershipActive === false) {
    return "inactive";
  }

  const startKey = memberDateKey(member.startDate);
  const endKey = memberDateKey(member.endDate);

  if (!startKey || !endKey) return "missing-dates";
  if (todayKey < startKey) return "not-started";
  if (todayKey > endKey) return "expired";
  return "active";
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
      memberRef.collection("attendance").orderBy("dateKey", "desc").get()
    ]);

    if (!memberSnapshot.exists) {
      updateAttendanceMessage("تعذر العثور على بيانات العضوية.", "error");
      return;
    }

    const dates = [];
    attendanceSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.dateKey) dates.push(data.dateKey);
    });

    renderAttendance(dates, memberSnapshot.data());
  } catch (error) {
    console.error("Attendance load error:", error);
    updateAttendanceMessage("تعذر تحميل سجل الحضور حاليًا.", "error");
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
    } else if (current.getUTCDay() !== 5) {
      break;
    }

    const previous = previousClubDay(current);
    if (previous.getTime() === current.getTime()) break;
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
  const todayStatus = document.getElementById("attendance-today-status");
  const todayKey = localDateKey();
  const hasToday = dateKeys.includes(todayKey);
  const streak = calculateStreak(dateKeys);
  const status = membershipStatus(member, todayKey);

  if (streakEl) streakEl.textContent = streak;
  if (totalEl) totalEl.textContent = dateKeys.length;

  if (todayStatus) {
    if (hasToday) {
      todayStatus.textContent = "تم تسجيل حضورك اليوم ✓";
      todayStatus.className = "attendance-status done";
    } else if (status === "expired") {
      todayStatus.textContent = "انتهى اشتراكك. راجعي الإدارة للتجديد.";
      todayStatus.className = "attendance-status";
    } else if (status === "not-started") {
      todayStatus.textContent = "لم يبدأ اشتراكك بعد.";
      todayStatus.className = "attendance-status";
    } else if (status !== "active") {
      todayStatus.textContent = "الاشتراك غير نشط أو بيانات تواريخه غير مكتملة.";
      todayStatus.className = "attendance-status";
    } else {
      todayStatus.textContent = "لم تسجلي حضورك اليوم بعد";
      todayStatus.className = "attendance-status";
    }
  }

  const button = document.getElementById("attendance-btn");
  if (button) {
    button.disabled = hasToday || status !== "active" || isFriday(todayKey);

    if (hasToday) button.textContent = "تم تسجيل حضور اليوم ✓";
    else if (status === "expired") button.textContent = "انتهى الاشتراك";
    else if (status === "not-started") button.textContent = "لم يبدأ الاشتراك";
    else if (status !== "active") button.textContent = "راجعي الإدارة";
    else if (isFriday(todayKey)) button.textContent = "النادي مغلق يوم الجمعة";
    else button.textContent = "سجّلي حضوري اليوم";
  }

  if (listEl) {
    if (!dateKeys.length) {
      listEl.innerHTML = '<div class="attendance-empty">ما عندك سجل حضور حتى الآن.</div>';
    } else {
      listEl.innerHTML = dateKeys.slice(0, 10).map(key => {
        const date = dateFromKey(key);
        return `
          <div class="attendance-row">
            <span>${date.toLocaleDateString("ar-SA", {
              timeZone: TIME_ZONE,
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric"
            })}</span>
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
    updateAttendanceMessage("سجّلي الدخول أولًا.", "error");
    return;
  }

  const button = document.getElementById("attendance-btn");
  if (button) button.disabled = true;

  const todayKey = localDateKey();
  if (isFriday(todayKey)) {
    updateAttendanceMessage("النادي مغلق يوم الجمعة، لذلك لا يوجد تسجيل حضور اليوم.", "info");
    if (button) button.disabled = true;
    return;
  }

  const db = firebase.firestore();
  const memberRef = db.collection("members").doc(user.uid);
  const attendanceRef = memberRef.collection("attendance").doc(todayKey);
  const calendarRef = db.collection("clubCalendar").doc(todayKey);

  try {
    await db.runTransaction(async transaction => {
      // جميع القراءات تسبق الكتابة داخل المعاملة.
      const memberSnapshot = await transaction.get(memberRef);
      if (!memberSnapshot.exists) throw new Error("MEMBER_NOT_FOUND");

      const member = memberSnapshot.data();
      const status = membershipStatus(member, todayKey);
      if (status === "inactive") throw new Error("MEMBERSHIP_INACTIVE");
      if (status === "expired") throw new Error("MEMBERSHIP_EXPIRED");
      if (status === "not-started") throw new Error("MEMBERSHIP_NOT_STARTED");
      if (status !== "active") throw new Error("MEMBERSHIP_DATES_MISSING");

      const attendanceSnapshot = await transaction.get(attendanceRef);
      if (attendanceSnapshot.exists) throw new Error("ALREADY_ATTENDED");

      const calendarSnapshot = await transaction.get(calendarRef);
      const calendar = calendarSnapshot.exists ? calendarSnapshot.data() : {};
      if (calendar.closed === true || calendar.type === "closed") {
        throw new Error("CLUB_CLOSED");
      }

      // لا نستهلك رصيد الغياب عند الحضور.
      // ولا نعيد تهيئة رصيد الغياب عند أول حضور؛ الإدارة هي مصدر الاشتراك.
      transaction.set(attendanceRef, {
        uid: user.uid,
        dateKey: todayKey,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    updateAttendanceMessage("تم تسجيل حضورك بنجاح! استمري 💙", "success");
    await loadAttendance();
  } catch (error) {
    console.error("Attendance write error:", error);

    const messages = {
      ALREADY_ATTENDED: ["تم تسجيل حضورك اليوم بالفعل ✓", "success"],
      MEMBERSHIP_INACTIVE: ["اشتراكك غير نشط حاليًا. راجعي الإدارة.", "error"],
      MEMBERSHIP_EXPIRED: ["انتهى اشتراكك. راجعي الإدارة للتجديد.", "error"],
      MEMBERSHIP_NOT_STARTED: ["لم يبدأ اشتراكك بعد. راجعي الإدارة إذا كان هذا غير صحيح.", "error"],
      MEMBERSHIP_DATES_MISSING: ["تواريخ اشتراكك غير مكتملة. راجعي الإدارة.", "error"],
      MEMBER_NOT_FOUND: ["لم يتم العثور على بيانات عضويتك.", "error"],
      CLUB_CLOSED: ["النادي مغلق اليوم، ولا يمكن تسجيل الحضور.", "info"]
    };

    const [message, type] = messages[error.message] || [
      "تعذر تسجيل الحضور. قد تكون صلاحيات قراءة تقويم النادي غير متاحة؛ راجعي الإدارة.",
      "error"
    ];
    updateAttendanceMessage(message, type);
    await loadAttendance();
  }
}

// ======================================
// INITIALIZE
// ======================================

function initAttendance() {
  const button = document.getElementById("attendance-btn");
  if (button) button.addEventListener("click", registerAttendance);

  firebase.auth().onAuthStateChanged(user => {
    if (user) loadAttendance();
  });
}

document.addEventListener("DOMContentLoaded", initAttendance);
