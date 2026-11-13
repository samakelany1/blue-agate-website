// Blue Agate - Member absence requests, limited to 7 days per subscription month.
// Each subscription month runs from the activation-date anniversary to the next anniversary (Asia/Riyadh date keys).
(function () {
  const TOTAL_GRACE_DAYS = 7;
  const TZ = "Asia/Riyadh";
  const el = id => document.getElementById(id);

  function localDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }
  function dateKeyFromValue(value) {
    if (!value) return null;
    const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return localDateKey(date);
  }
  function addMonthsToKey(key, count) {
    const [year, month, day] = key.split("-").map(Number);
    const first = new Date(Date.UTC(year, month - 1 + count, 1));
    const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    first.setUTCDate(Math.min(day, lastDay));
    return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}-${String(first.getUTCDate()).padStart(2, "0")}`;
  }
  function cycleStartForDate(startKey, targetKey) {
    if (!startKey || !targetKey || targetKey < startKey) return null;
    const [sy, sm] = startKey.split("-").map(Number);
    const [ty, tm] = targetKey.split("-").map(Number);
    let months = (ty - sy) * 12 + (tm - sm);
    if (addMonthsToKey(startKey, months) > targetKey) months--;
    return addMonthsToKey(startKey, Math.max(0, months));
  }
  function addDaysToKey(key, count) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + count));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  }
  function showMessage(id, message, type = "info") {
    const box = el(id); if (!box) return;
    box.textContent = message; box.className = `request-message ${type}`; box.hidden = false;
  }
  function dateLabel(key) {
    if (!key) return "—";
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
  }
  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function statusLabel(status) { return ({ pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" })[status] || "غير معروف"; }
  function requestCardHtml(item) {
    const note = item.reviewNote ? `<p class="request-review-note">ملاحظة الإدارة: ${escapeHtml(item.reviewNote)}</p>` : "";
    return `<article class="member-request-item"><div class="member-request-top"><strong>طلب غياب</strong><span class="request-status status-${escapeHtml(item.status || "pending")}">${statusLabel(item.status)}</span></div><p class="request-date">${dateLabel(item.dateKey)}</p><p>${escapeHtml(item.reason || "")}</p>${note}</article>`;
  }
  function memberCycleKeys(member, targetKey) {
    const startKey = dateKeyFromValue(member.startDate);
    const endKey = dateKeyFromValue(member.endDate);
    if (!startKey || !endKey || targetKey < startKey || targetKey > endKey) return null;
    const cycleStart = cycleStartForDate(startKey, targetKey);
    const cycleEnd = addDaysToKey(addMonthsToKey(startKey, (() => {
      const [sy, sm] = startKey.split("-").map(Number), [ty, tm] = targetKey.split("-").map(Number);
      let diff = (ty - sy) * 12 + (tm - sm);
      if (addMonthsToKey(startKey, diff) > targetKey) diff--;
      return Math.max(0, diff) + 1;
    })()), -1);
    return { startKey, endKey, cycleStart, cycleEnd };
  }
  function balanceCycleKey(member, startKey) {
    if (typeof member.graceAbsenceCycleStartDate === "string") return member.graceAbsenceCycleStartDate;
    const last = typeof member.attendanceLastProcessedDate === "string" ? member.attendanceLastProcessedDate : startKey;
    return cycleStartForDate(startKey, last) || startKey;
  }
  async function getCycleUsage(memberRef, member, cycle) {
    const [requestSnap, manualSnap] = await Promise.all([
      memberRef.collection("absenceRequests").get(),
      memberRef.collection("subscriptionAdjustments").get()
    ]);
    const reservedRequestDates = new Set();
    const lastProcessed = typeof member.attendanceLastProcessedDate === "string" ? member.attendanceLastProcessedDate : "";
    requestSnap.forEach(doc => {
      const item = doc.data();
      const active = (item.status || "pending") !== "rejected";
      const alreadyCharged = item.balanceApplied === true || (lastProcessed && item.dateKey <= lastProcessed);
      if (active && !alreadyCharged && item.dateKey >= cycle.cycleStart && item.dateKey <= cycle.cycleEnd) reservedRequestDates.add(item.dateKey);
    });
    const cycleKey = balanceCycleKey(member, cycle.startKey);
    const rawRemaining = Number(member.graceAbsenceDaysRemaining ?? member.absenceAllowanceDaysRemaining ?? TOTAL_GRACE_DAYS);
    const remaining = Number.isFinite(rawRemaining) ? Math.max(0, Math.min(TOTAL_GRACE_DAYS, rawRemaining)) : TOTAL_GRACE_DAYS;
    const usedByBalance = cycleKey === cycle.cycleStart ? TOTAL_GRACE_DAYS - remaining : 0;
    // The member balance includes already processed and manually entered absences.
    // Add only pending/unprocessed request dates to reserve their days in advance.
    return usedByBalance + reservedRequestDates.size;
  }
  async function refreshCycleLimit(memberRef, member, targetKey) {
    const counter = el("absence-cycle-counter");
    const submit = el("absence-submit-btn");
    const cycle = memberCycleKeys(member, targetKey || localDateKey());
    const dateInput = el("absence-date");
    if (dateInput) dateInput.max = cycle ? cycle.endKey : "";
    if (!cycle) {
      if (counter) counter.textContent = "لا يوجد اشتراك سارٍ يغطي تاريخ الغياب المحدد.";
      if (submit) submit.disabled = true;
      return { count: 0, reached: true, cycle: null };
    }
    const count = await getCycleUsage(memberRef, member, cycle);
    const reached = count >= TOTAL_GRACE_DAYS;
    if (counter) counter.textContent = `استخدمتِ ${count} من 7 أيام غياب في دورة اشتراكك (${dateLabel(cycle.cycleStart)} – ${dateLabel(cycle.cycleEnd)})`;
    if (submit) {
      submit.disabled = reached;
      submit.textContent = reached ? "اكتمل رصيد الغياب لهذه الدورة" : "إرسال طلب الغياب";
    }
    if (reached) showMessage("absence-request-message", "وصلتِ إلى الحد الأقصى وهو 7 أيام غياب خلال دورة اشتراكك الحالية. يتجدد الرصيد مع بداية دورة الاشتراك التالية.", "error");
    return { count, reached, cycle };
  }
  async function loadMyRequests() {
    const user = firebase.auth().currentUser, list = el("member-requests-list");
    if (!user || !list) return;
    list.innerHTML = '<div class="request-empty">جاري تحميل طلباتكِ...</div>';
    try {
      const memberRef = firebase.firestore().collection("members").doc(user.uid);
      const [memberSnap, requestSnap] = await Promise.all([memberRef.get(), memberRef.collection("absenceRequests").orderBy("createdAt", "desc").get()]);
      if (memberSnap.exists) await refreshCycleLimit(memberRef, memberSnap.data(), el("absence-date")?.value || localDateKey());
      const items = requestSnap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      list.innerHTML = items.length ? items.map(requestCardHtml).join("") : '<div class="request-empty">لا توجد طلبات حتى الآن.</div>';
    } catch (error) {
      console.error("Load member absence requests error:", error);
      list.innerHTML = '<div class="request-empty error">تعذر تحميل الطلبات. حاولي تحديث الصفحة.</div>';
    }
  }
  async function submitAbsence(event) {
    event.preventDefault();
    const user = firebase.auth().currentUser; if (!user) return;
    const dateKey = el("absence-date").value, reason = el("absence-reason").value.trim();
    if (!dateKey || !reason) { showMessage("absence-request-message", "أكملي التاريخ والسبب.", "error"); return; }
    const button = event.submitter; if (button) button.disabled = true;
    try {
      const memberRef = firebase.firestore().collection("members").doc(user.uid);
      const memberSnap = await memberRef.get();
      if (!memberSnap.exists) throw new Error("MEMBER_NOT_FOUND");
      const member = memberSnap.data();
      if (dateKey < localDateKey()) throw new Error("PAST_DATE");
      const cycle = memberCycleKeys(member, dateKey);
      if (!cycle) throw new Error("OUTSIDE_SUBSCRIPTION");
      const [usage, requestSnap, manualDoc, attendanceDoc] = await Promise.all([
        getCycleUsage(memberRef, member, cycle),
        memberRef.collection("absenceRequests").get(),
        memberRef.collection("subscriptionAdjustments").doc(`manual_absence_${dateKey}`).get(),
        memberRef.collection("attendance").doc(dateKey).get()
      ]);
      if (manualDoc.exists || attendanceDoc.exists || requestSnap.docs.some(doc => doc.data().dateKey === dateKey && (doc.data().status || "pending") !== "rejected")) throw new Error("DATE_ALREADY_RECORDED");
      if (usage >= TOTAL_GRACE_DAYS) throw new Error("CYCLE_LIMIT_REACHED");
      await memberRef.collection("absenceRequests").add({
        uid: user.uid, memberName: member.name || user.displayName || "", type: "absence", dateKey, reason,
        subscriptionCycleStartDate: cycle.cycleStart,
        status: "pending", createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      el("absence-request-form").reset();
      el("absence-date").min = localDateKey();
      showMessage("absence-request-message", "تم إرسال طلب الغياب بنجاح. سيظهر لكِ بعد مراجعته.", "success");
      await loadMyRequests();
    } catch (error) {
      console.error("Submit absence request error:", error);
      const message = error.message === "CYCLE_LIMIT_REACHED" ? "وصلتِ إلى الحد الأقصى وهو 7 أيام غياب خلال دورة اشتراكك. يتجدد الرصيد مع بداية دورة الاشتراك التالية."
        : error.message === "OUTSIDE_SUBSCRIPTION" ? "تاريخ الغياب المحدد خارج مدة اشتراكك. اختاري تاريخًا داخل اشتراكك الحالي."
        : error.message === "DATE_ALREADY_RECORDED" ? "يوجد حضور أو طلب غياب مسجل لهذا التاريخ بالفعل."
        : error.message === "PAST_DATE" ? "لا يمكن تقديم طلب غياب بتاريخ سابق لليوم."
        : "تعذر إرسال الطلب. تحققي من اتصالك ثم حاولي مجددًا.";
      showMessage("absence-request-message", message, "error");
    } finally { if (button) button.disabled = false; }
  }
  async function refreshForSelectedDate() {
    const user = firebase.auth().currentUser; if (!user) return;
    try {
      const ref = firebase.firestore().collection("members").doc(user.uid), snap = await ref.get();
      if (snap.exists) await refreshCycleLimit(ref, snap.data(), el("absence-date")?.value || localDateKey());
    } catch (error) { console.warn("Refresh absence cycle limit failed", error); }
  }
  function init() {
    const form = el("absence-request-form"); if (form) form.addEventListener("submit", submitAbsence);
    const refresh = el("refresh-member-requests"); if (refresh) refresh.addEventListener("click", loadMyRequests);
    if (el("absence-date")) {
      el("absence-date").min = localDateKey();
      el("absence-date").addEventListener("change", refreshForSelectedDate);
    }
    firebase.auth().onAuthStateChanged(user => { if (user) loadMyRequests(); });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
