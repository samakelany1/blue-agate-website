// Blue Agate - Attendance & Streak
// لا يغيّر script.js، ويعتمد على Firebase Auth + Firestore.

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateFromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isFriday(date) {
  return date.getDay() === 5;
}

function previousClubDay(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);

  // الجمعة إجازة ولا تدخل في حساب الـStreak
  if (isFriday(d)) {
    d.setDate(d.getDate() - 1);
  }

  return d;
}

function updateAttendanceMessage(message, type = "info") {
  const box = document.getElementById("attendance-message");
  if (!box) return;
  box.textContent = message;
  box.className = `attendance-message ${type}`;
  box.hidden = false;
}

async function loadAttendance() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const db = firebase.firestore();

  try {
    const snapshot = await db
      .collection("members")
      .doc(user.uid)
      .collection("attendance")
      .orderBy("dateKey", "desc")
      .get();

    const dates = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.dateKey) dates.push(data.dateKey);
    });

    renderAttendance(dates);
  } catch (error) {
    console.error("Attendance load error:", error);
    updateAttendanceMessage("تعذر تحميل سجل الحضور حاليًا.", "error");
  }
}

function calculateStreak(dateKeys) {
  const uniqueDates = [...new Set(dateKeys)].sort().reverse();
  if (!uniqueDates.length) return 0;

  const today = new Date();
  const todayKey = localDateKey(today);

  // إذا لم تسجل العضوة اليوم، يبدأ العد من آخر حضور.
  let current = uniqueDates.includes(todayKey)
    ? dateFromKey(todayKey)
    : dateFromKey(uniqueDates[0]);

  let streak = 0;

  while (true) {
    const key = localDateKey(current);

    if (uniqueDates.includes(key)) {
      streak++;
    } else if (isFriday(current)) {
      // الجمعة لا تكسر الـStreak
    } else {
      break;
    }

    const previous = previousClubDay(current);
    if (previous.getTime() === current.getTime()) break;
    current = previous;
  }

  return streak;
}

function renderAttendance(dateKeys) {
  const streakEl = document.getElementById("streak-number");
  const totalEl = document.getElementById("attendance-total");
  const listEl = document.getElementById("attendance-list");
  const todayStatus = document.getElementById("attendance-today-status");

  const todayKey = localDateKey();
  const hasToday = dateKeys.includes(todayKey);
  const streak = calculateStreak(dateKeys);

  if (streakEl) streakEl.textContent = streak;
  if (totalEl) totalEl.textContent = dateKeys.length;

  if (todayStatus) {
    todayStatus.textContent = hasToday
      ? "تم تسجيل حضورك اليوم ✓"
      : "لم تسجلي حضورك اليوم بعد";
    todayStatus.className = hasToday
      ? "attendance-status done"
      : "attendance-status";
  }

  const button = document.getElementById("attendance-btn");
  if (button) {
    button.disabled = hasToday;
    button.textContent = hasToday
      ? "تم تسجيل حضور اليوم ✓"
      : "سجّلي حضوري اليوم";
  }

  if (listEl) {
    if (!dateKeys.length) {
      listEl.innerHTML = '<div class="attendance-empty">ما عندك سجل حضور حتى الآن.</div>';
      return;
    }

    listEl.innerHTML = dateKeys.slice(0, 10).map(key => {
      const d = dateFromKey(key);
      return `
        <div class="attendance-row">
          <span>${d.toLocaleDateString("ar-SA", {
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

async function registerAttendance() {
  const user = firebase.auth().currentUser;
  if (!user) {
    updateAttendanceMessage("سجّلي الدخول أولًا.", "error");
    return;
  }

  const button = document.getElementById("attendance-btn");
  if (button) button.disabled = true;

  const todayKey = localDateKey();

  // الجمعة يوم إجازة
  if (isFriday(new Date())) {
    updateAttendanceMessage("النادي مغلق يوم الجمعة، لذلك لا يوجد تسجيل حضور اليوم.", "info");
    if (button) button.disabled = false;
    return;
  }

  const db = firebase.firestore();
  const attendanceRef = db
    .collection("members")
    .doc(user.uid)
    .collection("attendance")
    .doc(todayKey);

  try {
    const existing = await attendanceRef.get();

    if (existing.exists) {
      updateAttendanceMessage("تم تسجيل حضورك اليوم بالفعل ✓", "success");
      await loadAttendance();
      return;
    }

    await attendanceRef.set({
      uid: user.uid,
      dateKey: todayKey,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    updateAttendanceMessage("تم تسجيل حضورك بنجاح! استمري 💙", "success");
    await loadAttendance();
  } catch (error) {
    console.error("Attendance write error:", error);
    updateAttendanceMessage(
      "تعذر تسجيل الحضور. إذا ظهرت هذه الرسالة بشكل مستمر نحتاج نضبط صلاحيات Firestore.",
      "error"
    );
    if (button) button.disabled = false;
  }
}

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

document.addEventListener("DOMContentLoaded", initAttendance);
