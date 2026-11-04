// Blue Agate - Member absence requests only
// Firestore: members/{uid}/absenceRequests
(function () {
  function el(id) { return document.getElementById(id); }

  function localDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function showMessage(id, message, type = "info") {
    const box = el(id);
    if (!box) return;
    box.textContent = message;
    box.className = `request-message ${type}`;
    box.hidden = false;
  }

  function dateLabel(key) {
    if (!key) return "—";
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("ar-SA", {
      year: "numeric", month: "long", day: "numeric"
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function statusLabel(status) {
    return ({ pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" })[status] || "غير معروف";
  }

  function requestCardHtml(item) {
    const note = item.reviewNote
      ? `<p class="request-review-note">ملاحظة الإدارة: ${escapeHtml(item.reviewNote)}</p>` : "";
    return `<article class="member-request-item">
      <div class="member-request-top">
        <strong>طلب غياب</strong>
        <span class="request-status status-${escapeHtml(item.status || "pending")}">${statusLabel(item.status)}</span>
      </div>
      <p class="request-date">${dateLabel(item.dateKey)}</p>
      <p>${escapeHtml(item.reason || "")}</p>
      ${note}
    </article>`;
  }

  async function loadMyRequests() {
    const user = firebase.auth().currentUser;
    const list = el("member-requests-list");
    if (!user || !list) return;
    list.innerHTML = '<div class="request-empty">جاري تحميل طلباتكِ...</div>';
    try {
      const snap = await firebase.firestore().collection("members").doc(user.uid)
        .collection("absenceRequests").orderBy("createdAt", "desc").get();
      const items = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      list.innerHTML = items.length
        ? items.map(requestCardHtml).join("")
        : '<div class="request-empty">لا توجد طلبات حتى الآن.</div>';
    } catch (error) {
      console.error("Load member absence requests error:", error);
      list.innerHTML = '<div class="request-empty error">تعذر تحميل الطلبات. حاولي تحديث الصفحة.</div>';
    }
  }

  async function submitAbsence(event) {
    event.preventDefault();
    const user = firebase.auth().currentUser;
    if (!user) return;
    const dateKey = el("absence-date").value;
    const reason = el("absence-reason").value.trim();
    if (!dateKey || !reason) {
      showMessage("absence-request-message", "أكملي التاريخ والسبب.", "error");
      return;
    }
    const button = event.submitter;
    if (button) button.disabled = true;
    try {
      const memberRef = firebase.firestore().collection("members").doc(user.uid);
      const memberSnap = await memberRef.get();
      const member = memberSnap.exists ? memberSnap.data() : {};
      await memberRef.collection("absenceRequests").add({
        uid: user.uid,
        memberName: member.name || user.displayName || "",
        type: "absence",
        dateKey,
        reason,
        status: "pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      el("absence-request-form").reset();
      showMessage("absence-request-message", "تم إرسال طلب الغياب بنجاح. سيظهر لكِ بعد مراجعته.", "success");
      await loadMyRequests();
    } catch (error) {
      console.error("Submit absence request error:", error);
      showMessage("absence-request-message", "تعذر إرسال الطلب. تحققي من اتصالك ثم حاولي مجددًا.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function init() {
    const form = el("absence-request-form");
    if (form) form.addEventListener("submit", submitAbsence);
    const refresh = el("refresh-member-requests");
    if (refresh) refresh.addEventListener("click", loadMyRequests);
    if (el("absence-date")) el("absence-date").min = localDateKey();
    firebase.auth().onAuthStateChanged(user => { if (user) loadMyRequests(); });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
