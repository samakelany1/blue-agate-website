// Blue Agate - Admin review for member absence and medical requests
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
    return new Date(y, m - 1, d).toLocaleDateString("ar-SA", {
      year: "numeric", month: "long", day: "numeric"
    });
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
        const member = memberDoc.data();
        for (const type of ["absenceRequests", "medicalRequests"]) {
          const snap = await memberDoc.ref.collection(type).get();
          snap.forEach(doc => tasks.push({
            id: doc.id,
            uid: memberDoc.id,
            memberName: member.name || doc.data().memberName || "عضوة",
            requestType: type === "medicalRequests" ? "medical" : "absence",
            ref: doc.ref,
            ...doc.data()
          }));
        }
      }
      tasks.sort((a, b) => {
        const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bt - at;
      });
      allRequests = tasks;
      renderRequests();
    } catch (error) {
      console.error("Load admin requests error:", error);
      list.innerHTML = '<div class="empty-state error-state">تعذر تحميل الطلبات. تأكدي من نشر قواعد Firestore الجديدة.</div>';
    }
  }

  function renderRequests() {
    const list = el("admin-requests-list");
    if (!list) return;
    const filtered = activeFilter === "pending"
      ? allRequests.filter(r => (r.status || "pending") === "pending")
      : allRequests;
    if (!filtered.length) {
      list.innerHTML = '<div class="empty-state">لا توجد طلبات في هذا التصنيف.</div>';
      return;
    }
    list.innerHTML = filtered.map(r => {
      const medical = r.requestType === "medical";
      const dates = medical
        ? `${dateLabel(r.startDate)} – ${dateLabel(r.endDate)}`
        : dateLabel(r.dateKey);
      const attachment = medical && r.attachmentPath
        ? `<button class="request-file-link" type="button" data-open-file="${escapeHtml(r.id)}">فتح المرفق: ${escapeHtml(r.attachmentName || "ملف طبي")}</button>`
        : "";
      const actions = (r.status || "pending") === "pending"
        ? `<div class="admin-request-actions">
             <button class="approve-request-btn" type="button" data-review="${escapeHtml(r.id)}" data-kind="${r.requestType}">موافقة</button>
             <button class="reject-request-btn" type="button" data-review="${escapeHtml(r.id)}" data-kind="${r.requestType}">رفض</button>
           </div>
           <label class="request-note-label">ملاحظة (اختياري)</label>
           <input class="request-review-input" data-note="${escapeHtml(r.id)}" placeholder="سبب الرفض أو ملاحظة للعضوة">`
        : `<span class="request-status status-${escapeHtml(r.status)}">${statusLabel(r.status)}</span>
           ${r.reviewNote ? `<p class="request-review-note">الملاحظة: ${escapeHtml(r.reviewNote)}</p>` : ""}`;
      return `<article class="admin-request-item">
        <div class="admin-request-top">
          <div><strong>${medical ? "عذر طبي" : "طلب غياب"}</strong><span class="admin-request-member">${escapeHtml(r.memberName)} • ${escapeHtml(r.uid)}</span></div>
          <span class="request-status status-${escapeHtml(r.status || "pending")}">${statusLabel(r.status || "pending")}</span>
        </div>
        <p class="request-date">${dates}</p>
        <p class="admin-request-reason">${escapeHtml(r.reason || "")}</p>
        ${attachment}
        ${actions}
      </article>`;
    }).join("");

    list.querySelectorAll("[data-open-file]").forEach(btn => {
      btn.addEventListener("click", () => openAttachment(btn.dataset.openFile));
    });
    list.querySelectorAll("[data-review]").forEach(btn => {
      btn.addEventListener("click", () => reviewRequest(btn.dataset.review, btn.dataset.kind, btn.classList.contains("approve-request-btn") ? "approved" : "rejected"));
    });
  }

  async function openAttachment(id) {
    const request = allRequests.find(r => r.id === id && r.requestType === "medical");
    if (!request || !request.attachmentPath) return;
    try {
      const url = await firebase.storage().ref().child(request.attachmentPath).getDownloadURL();
      window.open(url, "_blank", "noopener");
    } catch (error) {
      console.error("Open medical attachment error:", error);
      showMessage("تعذر فتح المرفق. تحققي من قواعد Firebase Storage.", "error");
    }
  }

  async function reviewRequest(id, kind, status) {
    const request = allRequests.find(r => r.id === id && r.requestType === kind);
    if (!request) return;
    const noteInput = document.querySelector(`[data-note="${CSS.escape(id)}"]`);
    const reviewNote = noteInput ? noteInput.value.trim() : "";
    const user = firebase.auth().currentUser;
    if (!(await isAdmin(user))) {
      showMessage("ليس لديكِ صلاحية مراجعة الطلبات.", "error");
      return;
    }

    try {
      const db = firebase.firestore();
      await db.runTransaction(async tx => {
        const requestSnap = await tx.get(request.ref);
        const memberRef = db.collection("members").doc(request.uid);
        const memberSnap = await tx.get(memberRef);
        if (!requestSnap.exists || !memberSnap.exists) throw new Error("REQUEST_OR_MEMBER_MISSING");
        const current = requestSnap.data();
        if ((current.status || "pending") !== "pending") throw new Error("ALREADY_REVIEWED");

        const updateRequest = {
          status,
          reviewNote,
          reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
          reviewedBy: user.uid
        };

        if (kind === "medical" && status === "approved") {
          const member = memberSnap.data();
          const ranges = Array.isArray(member.attendancePauseRanges) ? [...member.attendancePauseRanges] : [];
          const alreadyAdded = ranges.some(range => range && range.requestId === id);
          if (!alreadyAdded) {
            ranges.push({
              requestId: id,
              startDate: current.startDate,
              endDate: current.endDate,
              approved: true
            });
            tx.update(memberRef, { attendancePauseRanges: ranges });
          }
        }

        tx.update(request.ref, updateRequest);
      });

      showMessage(
        kind === "medical" && status === "approved"
          ? "تم اعتماد العذر الطبي. ستُطبق أيام التعويض عبر المعالجة اليومية."
          : status === "approved"
            ? "تمت الموافقة على الطلب. الغياب العادي يظل محسوبًا من الرصيد."
            : "تم رفض الطلب.",
        "success"
      );
      await loadRequests();
    } catch (error) {
      console.error("Review request error:", error);
      showMessage(
        error.message === "ALREADY_REVIEWED"
          ? "تمت مراجعة هذا الطلب مسبقًا."
          : "تعذرت مراجعة الطلب. تحققي من قواعد Firestore ثم حاولي مجددًا.",
        "error"
      );
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
    firebase.auth().onAuthStateChanged(async user => {
      if (await isAdmin(user)) loadRequests();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
