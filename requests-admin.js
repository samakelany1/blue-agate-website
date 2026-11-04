// Blue Agate - Admin review for absence requests only
(function () {
  let allRequests = [];
  let activeFilter = "pending";
  const el = id => document.getElementById(id);

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function dateLabel(key) {
    if (!key) return "—";
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
  }
  function statusLabel(status) {
    return ({ pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" })[status] || "غير معروف";
  }
  function showMessage(message, type = "info") {
    const box = el("admin-requests-message");
    if (!box) return;
    box.textContent = message;
    box.className = `admin-message ${type}`;
    box.hidden = false;
  }
  async function isAdmin(user) {
    if (!user) return false;
    const snap = await firebase.firestore().collection("admins").doc(user.uid).get();
    return snap.exists && snap.data().role === "admin";
  }
  async function loadRequests() {
    const list = el("admin-requests-list");
    if (!list) return;
    list.innerHTML = '<div class="empty-state">جاري تحميل الطلبات...</div>';
    try {
      const db = firebase.firestore();
      const membersSnap = await db.collection("members").get();
      const tasks = [];
      for (const memberDoc of membersSnap.docs) {
        const snap = await memberDoc.ref.collection("absenceRequests").get();
        snap.forEach(doc => tasks.push({
          id: doc.id,
          uid: memberDoc.id,
          memberName: memberDoc.data().name || doc.data().memberName || "عضوة",
          requestType: "absence",
          ref: doc.ref,
          ...doc.data()
        }));
      }
      tasks.sort((a, b) => {
        const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bt - at;
      });
      allRequests = tasks;
      renderRequests();
    } catch (error) {
      console.error("Load admin absence requests error:", error);
      list.innerHTML = '<div class="empty-state error-state">تعذر تحميل الطلبات. تأكدي من صلاحيات Firestore.</div>';
    }
  }
  function renderRequests() {
    const list = el("admin-requests-list");
    if (!list) return;
    const filtered = activeFilter === "pending"
      ? allRequests.filter(r => (r.status || "pending") === "pending") : allRequests;
    if (!filtered.length) {
      list.innerHTML = '<div class="empty-state">لا توجد طلبات في هذا التصنيف.</div>';
      return;
    }
    list.innerHTML = filtered.map(r => {
      const actions = (r.status || "pending") === "pending"
        ? `<div class="admin-request-actions">
             <button class="approve-request-btn" type="button" data-review="${escapeHtml(r.id)}">موافقة</button>
             <button class="reject-request-btn" type="button" data-review="${escapeHtml(r.id)}">رفض</button>
           </div>
           <label class="request-note-label">ملاحظة (اختياري)</label>
           <input class="request-review-input" data-note="${escapeHtml(r.id)}" placeholder="سبب الرفض أو ملاحظة للعضوة">`
        : `<span class="request-status status-${escapeHtml(r.status)}">${statusLabel(r.status)}</span>
           ${r.reviewNote ? `<p class="request-review-note">الملاحظة: ${escapeHtml(r.reviewNote)}</p>` : ""}`;
      return `<article class="admin-request-item">
        <div class="admin-request-top">
          <div><strong>طلب غياب</strong><span class="admin-request-member">${escapeHtml(r.memberName)} • ${escapeHtml(r.uid)}</span></div>
          <span class="request-status status-${escapeHtml(r.status || "pending")}">${statusLabel(r.status || "pending")}</span>
        </div>
        <p class="request-date">${dateLabel(r.dateKey)}</p>
        <p class="admin-request-reason">${escapeHtml(r.reason || "")}</p>
        ${actions}
      </article>`;
    }).join("");
    list.querySelectorAll("[data-review]").forEach(btn => {
      btn.addEventListener("click", () => reviewRequest(btn.dataset.review,
        btn.classList.contains("approve-request-btn") ? "approved" : "rejected"));
    });
  }
  async function reviewRequest(id, status) {
    const request = allRequests.find(r => r.id === id);
    if (!request) return;
    const noteInput = document.querySelector(`[data-note="${CSS.escape(id)}"]`);
    const reviewNote = noteInput ? noteInput.value.trim() : "";
    const user = firebase.auth().currentUser;
    if (!(await isAdmin(user))) {
      showMessage("ليس لديكِ صلاحية مراجعة الطلبات.", "error");
      return;
    }
    try {
      const snap = await request.ref.get();
      if (!snap.exists || (snap.data().status || "pending") !== "pending") {
        showMessage("تمت مراجعة هذا الطلب مسبقًا.", "error");
        await loadRequests();
        return;
      }
      const db = firebase.firestore();
      const memberRef = db.collection("members").doc(request.uid);
      await db.runTransaction(async tx => {
        const [freshRequest, memberSnap] = await Promise.all([tx.get(request.ref), tx.get(memberRef)]);
        if (!freshRequest.exists || (freshRequest.data().status || "pending") !== "pending") {
          throw new Error("REQUEST_ALREADY_REVIEWED");
        }
        const requestData = freshRequest.data();
        const update = {
          status,
          reviewNote,
          reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
          reviewedBy: user.uid
        };
        const todayParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
        const todayValues = Object.fromEntries(todayParts.map(p => [p.type, p.value]));
        const todayKey = `${todayValues.year}-${todayValues.month}-${todayValues.day}`;
        if (status === "approved" && memberSnap.exists) {
          const member = memberSnap.data();
          if (requestData.dateKey < todayKey && typeof member.attendanceLastProcessedDate === "string" && member.attendanceLastProcessedDate >= requestData.dateKey) {
            throw new Error("ABSENCE_DATE_ALREADY_PROCESSED");
          }
          if (requestData.dateKey === todayKey) {
            const attendanceSnap = await tx.get(memberRef.collection("attendance").doc(todayKey));
            if (attendanceSnap.exists) throw new Error("MEMBER_ALREADY_ATTENDED");
            const grace = Number.isFinite(member.graceAbsenceDaysRemaining) ? Math.max(0, member.graceAbsenceDaysRemaining) : 7;
            if (grace > 0) tx.update(memberRef, { graceAbsenceDaysRemaining: grace - 1 });
            update.balanceApplied = true;
          }
        }
        tx.update(request.ref, update);
      });
      showMessage(status === "approved" ? "تمت الموافقة على طلب الغياب. خُصم اليوم من أيام السماح فقط، ولم يتغير رصيد الـ30 يومًا." : "تم رفض طلب الغياب.", "success");
      await loadRequests();
    } catch (error) {
      console.error("Review absence request error:", error);
      const message = error.message === "ABSENCE_DATE_ALREADY_PROCESSED"
        ? "هذا التاريخ تمت معالجته بالفعل. لا يمكن اعتماد الطلب بأمان بعد إغلاق المعالجة اليومية."
        : error.message === "MEMBER_ALREADY_ATTENDED"
          ? "لا يمكن اعتماد غياب لهذا اليوم؛ يوجد حضور مسجل للعضوة بالفعل."
          : "تعذرت مراجعة الطلب. تحققي من قواعد Firestore ثم حاولي مجددًا.";
      showMessage(message, "error");
    }
  }
  function init() {
    if (!el("admin-requests-list")) return;
    const refresh = el("refresh-admin-requests");
    if (refresh) refresh.addEventListener("click", loadRequests);
    document.querySelectorAll("[data-request-filter]").forEach(btn => {
      btn.addEventListener("click", () => {
        activeFilter = btn.dataset.requestFilter;
        document.querySelectorAll("[data-request-filter]").forEach(b => b.classList.toggle("active", b === btn));
        renderRequests();
      });
    });
    firebase.auth().onAuthStateChanged(async user => { if (await isAdmin(user)) loadRequests(); });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
