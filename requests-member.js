// Blue Agate - Member absence and medical requests
// Firestore: members/{uid}/absenceRequests and medicalRequests
// Storage: memberRequests/{uid}/{requestId}/{fileName}

(function () {
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

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

  function statusLabel(status) {
    return ({
      pending: "قيد المراجعة",
      approved: "مقبول",
      rejected: "مرفوض"
    })[status] || "غير معروف";
  }

  function requestCardHtml(item, type) {
    const medical = type === "medical";
    const dateText = medical
      ? `${dateLabel(item.startDate)} – ${dateLabel(item.endDate)}`
      : dateLabel(item.dateKey);
    const attachment = medical && item.attachmentName
      ? `<div class="request-attachment">المرفق: ${escapeHtml(item.attachmentName)}</div>`
      : "";
    const note = item.reviewNote
      ? `<p class="request-review-note">ملاحظة الإدارة: ${escapeHtml(item.reviewNote)}</p>`
      : "";
    return `
      <article class="member-request-item">
        <div class="member-request-top">
          <strong>${medical ? "عذر طبي" : "طلب غياب"}</strong>
          <span class="request-status status-${escapeHtml(item.status || "pending")}">${statusLabel(item.status)}</span>
        </div>
        <p class="request-date">${dateText}</p>
        <p>${escapeHtml(item.reason || "")}</p>
        ${attachment}
        ${note}
      </article>`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  async function loadMyRequests() {
    const user = firebase.auth().currentUser;
    const list = el("member-requests-list");
    if (!user || !list) return;
    list.innerHTML = '<div class="request-empty">جاري تحميل طلباتكِ...</div>';
    try {
      const memberRef = firebase.firestore().collection("members").doc(user.uid);
      const [absenceSnap, medicalSnap] = await Promise.all([
        memberRef.collection("absenceRequests").orderBy("createdAt", "desc").get(),
        memberRef.collection("medicalRequests").orderBy("createdAt", "desc").get()
      ]);
      const items = [];
      absenceSnap.forEach(doc => items.push({ ...doc.data(), id: doc.id, requestType: "absence" }));
      medicalSnap.forEach(doc => items.push({ ...doc.data(), id: doc.id, requestType: "medical" }));
      items.sort((a, b) => {
        const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bt - at;
      });
      list.innerHTML = items.length
        ? items.map(item => requestCardHtml(item, item.requestType)).join("")
        : '<div class="request-empty">لا توجد طلبات حتى الآن.</div>';
    } catch (error) {
      console.error("Load member requests error:", error);
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

  async function submitMedical(event) {
    event.preventDefault();
    const user = firebase.auth().currentUser;
    if (!user) return;
    const startDate = el("medical-start-date").value;
    const endDate = el("medical-end-date").value;
    const reason = el("medical-reason").value.trim();
    const file = el("medical-attachment").files[0];

    if (!startDate || !endDate || !reason || !file) {
      showMessage("medical-request-message", "أكملي جميع البيانات وأرفقي التقرير الطبي.", "error");
      return;
    }
    const today = localDateKey();
    if (startDate < today || endDate < startDate) {
      showMessage("medical-request-message", "اختاري تاريخ اليوم أو تاريخًا لاحقًا، وتأكدي من صحة فترة العذر.", "error");
      return;
    }
    const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1;
    if (days > 31) {
      showMessage("medical-request-message", "الفترة القصوى للطلب الواحد 31 يومًا.", "error");
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      showMessage("medical-request-message", "الصيغ المقبولة فقط JPG أو PNG أو PDF.", "error");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showMessage("medical-request-message", "حجم الملف يتجاوز 5 ميجابايت.", "error");
      return;
    }

    const button = event.submitter;
    if (button) button.disabled = true;
    let uploadedPath = null;
    try {
      if (!firebase.storage) throw new Error("Firebase Storage SDK is not loaded");
      const memberRef = firebase.firestore().collection("members").doc(user.uid);
      const memberSnap = await memberRef.get();
      const member = memberSnap.exists ? memberSnap.data() : {};
      const requestRef = memberRef.collection("medicalRequests").doc();
      const safeName = file.name.replace(/[^\w.\-ء-ي]/g, "_").slice(-100) || "medical-document";
      uploadedPath = `memberRequests/${user.uid}/${requestRef.id}/${safeName}`;
      const storageRef = firebase.storage().ref().child(uploadedPath);
      await storageRef.put(file, {
        contentType: file.type,
        customMetadata: { uid: user.uid, requestId: requestRef.id }
      });
      await requestRef.set({
        uid: user.uid,
        memberName: member.name || user.displayName || "",
        type: "medical",
        startDate,
        endDate,
        reason,
        attachmentPath: uploadedPath,
        attachmentName: file.name,
        attachmentType: file.type,
        attachmentSize: file.size,
        status: "pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      el("medical-request-form").reset();
      showMessage("medical-request-message", "تم إرسال العذر الطبي والمرفق بنجاح. الطلب الآن قيد المراجعة.", "success");
      await loadMyRequests();
    } catch (error) {
      console.error("Submit medical request error:", error);
      if (uploadedPath) {
        try { await firebase.storage().ref().child(uploadedPath).delete(); } catch (_) {}
      }
      showMessage("medical-request-message", "تعذر إرسال العذر الطبي. تأكدي من تفعيل Firebase Storage ونشر قواعده.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function init() {
    const absenceForm = el("absence-request-form");
    const medicalForm = el("medical-request-form");
    if (absenceForm) absenceForm.addEventListener("submit", submitAbsence);
    if (medicalForm) medicalForm.addEventListener("submit", submitMedical);
    const refresh = el("refresh-member-requests");
    if (refresh) refresh.addEventListener("click", loadMyRequests);
    const today = localDateKey();
    if (el("absence-date")) el("absence-date").min = today;
    if (el("medical-start-date")) el("medical-start-date").min = today;
    if (el("medical-end-date")) el("medical-end-date").min = today;
    if (el("medical-start-date")) {
      el("medical-start-date").addEventListener("change", () => {
        el("medical-end-date").min = el("medical-start-date").value || today;
        if (el("medical-end-date").value && el("medical-end-date").value < el("medical-start-date").value) {
          el("medical-end-date").value = el("medical-start-date").value;
        }
      });
    }
    firebase.auth().onAuthStateChanged(user => { if (user) loadMyRequests(); });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
