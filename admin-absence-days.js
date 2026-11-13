// Blue Agate - Admin manual absence-day controls (one dated absence per entry).
(function () {
  const TOTAL_GRACE_DAYS = 7;
  const TZ = "Asia/Riyadh";
  const el = id => document.getElementById(id);
  let selectedUid = null;

  function localDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }
  function toKey(value) {
    if (!value) return null;
    const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return localDateKey(date);
  }
  function addMonthsToKey(key, count) {
    const [year, month, day] = key.split("-").map(Number);
    const first = new Date(Date.UTC(year, month - 1 + count, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    first.setUTCDate(Math.min(day, last));
    return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}-${String(first.getUTCDate()).padStart(2, "0")}`;
  }
  function cycleStartForDate(startKey, targetKey) {
    if (!startKey || !targetKey || targetKey < startKey) return null;
    const [sy, sm] = startKey.split("-").map(Number), [ty, tm] = targetKey.split("-").map(Number);
    let months = (ty - sy) * 12 + (tm - sm);
    if (addMonthsToKey(startKey, months) > targetKey) months--;
    return addMonthsToKey(startKey, Math.max(0, months));
  }
  function dateLabel(key) {
    if (!key) return "—";
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
  }
  function safe(value) { return String(value ?? "—").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function message(text, type = "info") {
    const box = el("admin-manual-absence-message"); if (!box) return;
    box.textContent = text; box.className = `admin-message ${type}`; box.hidden = false;
  }
  function balanceCycleKey(member, startKey) {
    if (typeof member.graceAbsenceCycleStartDate === "string") return member.graceAbsenceCycleStartDate;
    const last = typeof member.attendanceLastProcessedDate === "string" ? member.attendanceLastProcessedDate : startKey;
    return cycleStartForDate(startKey, last) || startKey;
  }
  function getCycleForToday(member) {
    const startKey = toKey(member.startDate), endKey = toKey(member.endDate), today = localDateKey();
    if (!startKey || !endKey || today < startKey || today > endKey) return null;
    return { startKey, endKey, cycleStart: cycleStartForDate(startKey, today) };
  }
  async function loadAdminAbsenceControls(uid) {
    selectedUid = uid;
    const db = firebase.firestore(), memberRef = db.collection("members").doc(uid);
    const balance = el("admin-manual-absence-balance"), list = el("admin-manual-absence-list"), dateInput = el("admin-manual-absence-date");
    if (list) list.innerHTML = '<div class="mini-empty">جاري تحميل سجل الغياب اليدوي...</div>';
    try {
      const [memberSnap, manualSnap] = await Promise.all([memberRef.get(), memberRef.collection("subscriptionAdjustments").where("type", "==", "manual-absence").get()]);
      if (!memberSnap.exists) throw new Error("MEMBER_NOT_FOUND");
      const member = memberSnap.data(), cycle = getCycleForToday(member);
      if (cycle) {
        const storedCycle = balanceCycleKey(member, cycle.startKey);
        const remaining = storedCycle === cycle.cycleStart
          ? Math.max(0, Math.min(TOTAL_GRACE_DAYS, Number(member.graceAbsenceDaysRemaining ?? member.absenceAllowanceDaysRemaining ?? TOTAL_GRACE_DAYS)))
          : TOTAL_GRACE_DAYS;
        if (balance) balance.textContent = `رصيد دورة الاشتراك الحالية: ${remaining} من 7 أيام متبقية • من ${dateLabel(cycle.cycleStart)}`;
        const submitButton = el("admin-manual-absence-form")?.querySelector('button[type="submit"]');
        if (submitButton) submitButton.disabled = remaining <= 0;
        if (dateInput) { dateInput.min = cycle.cycleStart; dateInput.max = localDateKey(); }
      } else {
        if (balance) balance.textContent = "لا يوجد اشتراك سارٍ اليوم أو تواريخ الاشتراك غير مكتملة.";
        const submitButton = el("admin-manual-absence-form")?.querySelector('button[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        if (dateInput) { dateInput.min = toKey(member.startDate) || localDateKey(); dateInput.max = localDateKey(); }
      }
      const records = manualSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => String(b.dateKey || "").localeCompare(String(a.dateKey || "")));
      if (list) list.innerHTML = records.length ? records.map(item => `<div class="manual-absence-row"><div><strong>${safe(dateLabel(item.dateKey))}</strong><small>${safe(item.reason || "غياب أضافته الإدارة")}</small></div><span>− يوم من الرصيد</span></div>`).join("") : '<div class="mini-empty">لا توجد أيام غياب أضافتها الإدارة يدويًا.</div>';
    } catch (error) {
      console.error("Load manual absence controls error:", error);
      if (list) list.innerHTML = '<div class="mini-empty">تعذر تحميل سجل الغياب اليدوي.</div>';
      if (balance) balance.textContent = "تعذر قراءة رصيد الغياب.";
    }
  }
  async function addManualAbsence(event) {
    event.preventDefault();
    if (!selectedUid) return;
    const dateKey = el("admin-manual-absence-date").value;
    const reason = el("admin-manual-absence-reason").value.trim();
    const button = event.submitter;
    if (!dateKey || !reason) { message("حددي تاريخ الغياب واكتبي السبب.", "error"); return; }
    if (button) button.disabled = true;
    try {
      const user = firebase.auth().currentUser;
      if (!user) throw new Error("NOT_SIGNED_IN");
      const db = firebase.firestore();
      const adminSnap = await db.collection("admins").doc(user.uid).get();
      if (!adminSnap.exists || adminSnap.data().role !== "admin") throw new Error("NOT_ADMIN");
      const memberRef = db.collection("members").doc(selectedUid);
      const memberSnap = await memberRef.get();
      if (!memberSnap.exists) throw new Error("MEMBER_NOT_FOUND");
      const member = memberSnap.data();
      const startKey = toKey(member.startDate), endKey = toKey(member.endDate), today = localDateKey();
      if (!startKey || !endKey || dateKey < startKey || dateKey > endKey || dateKey > today) throw new Error("DATE_OUTSIDE_ACTIVE_CYCLE");
      const cycleStart = cycleStartForDate(startKey, dateKey);
      const currentCycleStart = cycleStartForDate(startKey, today);
      if (cycleStart !== currentCycleStart) throw new Error("NOT_CURRENT_CYCLE");
      const date = new Date(`${dateKey}T00:00:00Z`);
      if (date.getUTCDay() === 5) throw new Error("FRIDAY_CLOSED");
      const requestsSnap = await memberRef.collection("absenceRequests").get();
      const existingRequest = requestsSnap.docs.some(doc => doc.data().dateKey === dateKey && (doc.data().status || "pending") !== "rejected");
      if (existingRequest) throw new Error("REQUEST_EXISTS");

      await db.runTransaction(async tx => {
        const fresh = await tx.get(memberRef);
        const attendanceRef = memberRef.collection("attendance").doc(dateKey);
        const manualRef = memberRef.collection("subscriptionAdjustments").doc(`manual_absence_${dateKey}`);
        const calendarRef = db.collection("clubCalendar").doc(dateKey);
        const [attendanceSnap, manualSnap, calendarSnap] = await Promise.all([tx.get(attendanceRef), tx.get(manualRef), tx.get(calendarRef)]);
        if (!fresh.exists) throw new Error("MEMBER_NOT_FOUND");
        if (attendanceSnap.exists) throw new Error("ATTENDANCE_EXISTS");
        if (manualSnap.exists) throw new Error("MANUAL_EXISTS");
        if (calendarSnap.exists && (calendarSnap.data().closed === true || calendarSnap.data().type === "closed")) throw new Error("CLUB_CLOSED");
        const freshMember = fresh.data();
        if (freshMember.attendanceLastProcessedDate && dateKey <= freshMember.attendanceLastProcessedDate) throw new Error("DATE_ALREADY_PROCESSED");
        const freshStart = toKey(freshMember.startDate);
        const freshCycle = cycleStartForDate(freshStart, dateKey);
        const freshCurrentCycle = cycleStartForDate(freshStart, today);
        if (freshCycle !== freshCurrentCycle) throw new Error("NOT_CURRENT_CYCLE");
        const storedCycle = balanceCycleKey(freshMember, freshStart);
        const remaining = storedCycle === freshCycle
          ? Math.max(0, Math.min(TOTAL_GRACE_DAYS, Number(freshMember.graceAbsenceDaysRemaining ?? freshMember.absenceAllowanceDaysRemaining ?? TOTAL_GRACE_DAYS)))
          : TOTAL_GRACE_DAYS;
        if (remaining <= 0) throw new Error("BALANCE_EMPTY");
        tx.update(memberRef, {
          graceAbsenceCycleStartDate: freshCycle,
          graceAbsenceDaysRemaining: remaining - 1,
          graceAbsenceDaysConsumed: TOTAL_GRACE_DAYS - (remaining - 1),
          absenceAllowanceDays: TOTAL_GRACE_DAYS,
          absenceAllowanceDaysRemaining: remaining - 1,
          excludedAbsenceDates: firebase.firestore.FieldValue.arrayUnion(dateKey)
        });
        tx.set(manualRef, {
          dateKey, reason, type: "manual-absence", cycleStartDate: freshCycle,
          days: 1, visibleToMember: true,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: user.uid,
          createdByName: adminSnap.data().name || user.displayName || "الإدارة"
        });
      });
      el("admin-manual-absence-form").reset();
      message("تم تسجيل يوم الغياب وخصمه من رصيد الأيام السبعة بنجاح.", "success");
      await loadAdminAbsenceControls(selectedUid);
    } catch (error) {
      console.error("Add manual absence error:", error);
      const messages = {
        NOT_ADMIN: "هذا الإجراء متاح لحساب الإدارة فقط.",
        DATE_OUTSIDE_ACTIVE_CYCLE: "اختاري تاريخًا داخل مدة الاشتراك الحالية وحتى تاريخ اليوم.",
        NOT_CURRENT_CYCLE: "يمكن إضافة أيام يدويًا ضمن دورة الاشتراك الحالية فقط.",
        FRIDAY_CLOSED: "يوم الجمعة إجازة أسبوعية ولا يُسجل كيوم غياب.",
        REQUEST_EXISTS: "يوجد طلب غياب غير مرفوض لهذا التاريخ بالفعل.",
        ATTENDANCE_EXISTS: "يوجد حضور مسجل لهذا التاريخ؛ احذفي الحضور الخاطئ أولًا إذا لم تكن المشتركة قد حضرت.",
        MANUAL_EXISTS: "هذا اليوم مسجل مسبقًا كغياب يدوي.",
        CLUB_CLOSED: "النادي مغلق في هذا التاريخ، ولا يُخصم كيوم غياب.",
        DATE_ALREADY_PROCESSED: "تمت معالجة هذا التاريخ مسبقًا بواسطة النظام اليومي؛ لا يمكن خصمه مرة ثانية.",
        BALANCE_EMPTY: "استهلكت المشتركة رصيد الأيام السبعة لهذه الدورة.",
        MEMBER_NOT_FOUND: "لم يتم العثور على بيانات المشتركة.",
        NOT_SIGNED_IN: "انتهت جلسة الدخول. سجلي الدخول مرة أخرى."
      };
      message(messages[error.message] || "تعذر تسجيل يوم الغياب. تحققي من الاتصال وقواعد Firestore.", "error");
    } finally { if (button) button.disabled = false; }
  }
  function init() {
    const form = el("admin-manual-absence-form");
    if (form) form.addEventListener("submit", addManualAbsence);
    document.addEventListener("blueagate:member-editor-opened", event => loadAdminAbsenceControls(event.detail.uid));
  }
  window.loadAdminAbsenceControls = loadAdminAbsenceControls;
  document.addEventListener("DOMContentLoaded", init);
})();
