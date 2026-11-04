// Blue Agate - subscription days remaining (Asia/Riyadh)
(function () {
  function el(id) { return document.getElementById(id); }

  function dateKeyInRiyadh(date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function dayNumber(key) {
    const [year, month, day] = key.split("-").map(Number);
    return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  }

  async function updateCountdown(user) {
    const number = el("subscription-days-remaining");
    const note = el("subscription-countdown-note");
    const box = el("subscription-countdown");
    if (!number || !note || !box) return;
    if (!user) {
      number.textContent = "—";
      note.textContent = "سجّلي الدخول لعرض مدة اشتراككِ.";
      return;
    }
    try {
      const snap = await firebase.firestore().collection("members").doc(user.uid).get();
      if (!snap.exists) throw new Error("Member record not found");
      const member = snap.data();
      const endDate = toDate(member.endDate);
      if (!endDate) {
        number.textContent = "—";
        note.textContent = "تاريخ انتهاء الاشتراك غير مسجل.";
        return;
      }
      const todayKey = dateKeyInRiyadh(new Date());
      const endKey = dateKeyInRiyadh(endDate);
      const remaining = dayNumber(endKey) - dayNumber(todayKey);
      if (remaining < 0) {
        number.textContent = "0";
        note.textContent = "انتهى اشتراككِ. راجعي الإدارة للتجديد.";
        box.classList.add("subscription-countdown-expired");
      } else if (remaining === 0) {
        number.textContent = "اليوم";
        note.textContent = "ينتهي اشتراككِ اليوم.";
        box.classList.remove("subscription-countdown-expired");
      } else {
        number.textContent = `${remaining} يوم`;
        note.textContent = `تاريخ انتهاء الاشتراك: ${new Intl.DateTimeFormat("ar-SA", {
          timeZone: "Asia/Riyadh", year: "numeric", month: "long", day: "numeric"
        }).format(endDate)}`;
        box.classList.remove("subscription-countdown-expired");
      }
    } catch (error) {
      console.error("Subscription countdown error:", error);
      number.textContent = "—";
      note.textContent = "تعذر تحميل مدة الاشتراك. حدّثي الصفحة.";
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.firebase || !firebase.auth || !firebase.firestore) return;
    firebase.auth().onAuthStateChanged(updateCountdown);
  });
})();
