// Blue Agate - Admin renewal requests: verify actual renewal outcome.
(function () {
  let allRequests = [];
  let activeFilter = "pending";
  const $ = id => document.getElementById(id);

  function esc(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function asDate(value) {
    if (!value) return null;
    const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dateLabel(value) {
    const date = asDate(value);
    return date ? date.toLocaleDateString("ar-SA", {
      year: "numeric", month: "long", day: "numeric"
    }) : "—";
  }

  function millis(value) {
    const date = asDate(value);
    return date ? date.getTime() : null;
  }

  function statusLabel(status) {
    return ({
      pending: "قيد المتابعة",
      renewed: "تم التجديد فعليًا",
      not_renewed: "لم يتم التجديد"
    })[status] || "حالة غير معروفة";
  }

  function showMessage(message, type = "info") {
    const box = $("admin-renewal-requests-message");
    if (!box) return;
    box.textContent = message;
    box.className = `admin-message ${type}`;
    box.hidden = false;
  }

  async function isAdmin(user) {
    if (!user) return false;
    const doc = await firebase.firestore().collection("admins").doc(user.uid).get();
    return doc.exists && doc.data().role === "admin";
  }

  async function loadRequests() {
    const list = $("admin-renewal-requests-list");
    if (!list) return;
    list.innerHTML = '<div class="empty-state">جاري تحميل طلبات التجديد...</div>';

    try {
      const db = firebase.firestore();
      const members = await db.collection("members").get();
      const rows = [];

      for (const memberDoc of members.docs) {
        const requests = await memberDoc.ref.collection("renewalRequests").get();
        requests.forEach(doc => {
          const data = doc.data();
          rows.push({
            id: doc.id,
            uid: memberDoc.id,
            name: memberDoc.data().name || data.memberName || "عضوة",
            ref: doc.ref,
            ...data
          });
        });
      }

      rows.sort((a, b) => (millis(b.createdAt) || 0) - (millis(a.createdAt) || 0));
      allRequests = rows;
      renderRequests();
    } catch (error) {
      console.error("Load renewal requests error:", error);
      list.innerHTML = '<div class="empty-state error-state">تعذر تحميل طلبات التجديد. تحققي من صلاحيات Firestore.</div>';
    }
  }

  function renderRequests() {
    const list = $("admin-renewal-requests-list");
    if (!list) return;

    const filtered = activeFilter === "pending"
      ? allRequests.filter(request => (request.status || "pending") === "pending")
      : allRequests;

    if (!filtered.length) {
      list.innerHTML = activeFilter === "pending"
        ? '<div class="empty-state">لا توجد طلبات تجديد قيد المتابعة حاليًا.</div>'
        : '<div class="empty-state">لا توجد طلبات تجديد حتى الآن.</div>';
      return;
    }

    list.innerHTML = filtered.map(request => {
      const status = request.status || "pending";
      const statusClass = status === "renewed" ? "status-renewed"
        : status === "not_renewed" ? "status-not-renewed" : "status-pending";
      const pendingActions = status === "pending" ? `
        <div class="renewal-request-actions">
          <button class="renewal-open-member" type="button" data-open-member="${esc(request.uid)}">فتح ملف العضوة</button>
          <button class="renewal-mark-done" type="button" data-renewal-result="renewed" data-request-id="${esc(request.id)}">تم التجديد فعليًا</button>
          <button class="renewal-mark-no" type="button" data-renewal-result="not_renewed" data-request-id="${esc(request.id)}">لم يتم التجديد</button>
        </div>
        <label class="renewal-admin-note-label" for="renewal-note-${esc(request.id)}">ملاحظة الإدارة (اختياري)</label>
        <textarea id="renewal-note-${esc(request.id)}" class="renewal-admin-note" data-renewal-note="${esc(request.id)}" rows="2" placeholder="اكتبي ملاحظة عند الحاجة..."></textarea>
        <p class="renewal-action-hint">لتأكيد التجديد، نفّذي التجديد أولًا من ملف العضوة، ثم اضغطي «تم التجديد فعليًا».</p>
      ` : `
        <div class="renewal-result-details">
          <strong>${statusLabel(status)}</strong>
          ${request.verifiedEndDate ? `<span>نهاية الاشتراك بعد التجديد: ${dateLabel(request.verifiedEndDate)}</span>` : ""}
          ${request.adminNote ? `<span>ملاحظة الإدارة: ${esc(request.adminNote)}</span>` : ""}
          ${request.reviewedAt ? `<span>تاريخ تحديث الحالة: ${dateLabel(request.reviewedAt)}</span>` : ""}
        </div>
      `;

      return `<article class="admin-request-item renewal-request-item">
        <div class="admin-request-top">
          <div class="renewal-member-info">
            <strong>طلب تجديد اشتراك</strong>
            <span class="admin-request-member">${esc(request.name)} <span class="renewal-uid">• ${esc(request.uid)}</span></span>
          </div>
          <span class="request-status ${statusClass}">${statusLabel(status)}</span>
        </div>
        <div class="renewal-request-meta">
          <span><b>تاريخ الطلب</b>${dateLabel(request.createdAt)}</span>
          <span><b>نهاية الاشتراك عند الطلب</b>${dateLabel(request.currentEndDate)}</span>
        </div>
        ${pendingActions}
      </article>`;
    }).join("");

    list.querySelectorAll("[data-open-member]").forEach(button => {
      button.addEventListener("click", () => {
        const uid = button.dataset.openMember;
        if (typeof window.openMemberEditor === "function") {
          window.openMemberEditor(uid);
        } else {
          showMessage("تعذر فتح ملف العضوة. حدّثي الصفحة وحاولي مجددًا.", "error");
        }
      });
    });

    list.querySelectorAll("[data-renewal-result]").forEach(button => {
      button.addEventListener("click", () => updateRequestResult(
        button.dataset.requestId,
        button.dataset.renewalResult,
        button
      ));
    });
  }

  async function updateRequestResult(requestId, result, button) {
    const request = allRequests.find(item => item.id === requestId);
    if (!request || !["renewed", "not_renewed"].includes(result)) return;

    const user = firebase.auth().currentUser;
    if (!(await isAdmin(user))) {
      showMessage("ليس لديكِ صلاحية تحديث طلبات التجديد.", "error");
      return;
    }

    const noteInput = document.querySelector(`[data-renewal-note="${CSS.escape(requestId)}"]`);
    const adminNote = noteInput ? noteInput.value.trim() : "";

    if (result === "not_renewed" &&
        !window.confirm("تأكيد تسجيل أن الاشتراك لم يتم تجديده؟")) return;

    button.disabled = true;

    try {
      const db = firebase.firestore();
      const memberRef = db.collection("members").doc(request.uid);
      const [requestSnap, memberSnap] = await Promise.all([
        request.ref.get(),
        memberRef.get()
      ]);

      if (!requestSnap.exists || (requestSnap.data().status || "pending") !== "pending") {
        showMessage("تم تحديث هذا الطلب مسبقًا.", "error");
        await loadRequests();
        return;
      }

      if (!memberSnap.exists) {
        showMessage("لم يتم العثور على ملف العضوة.", "error");
        button.disabled = false;
        return;
      }

      const member = memberSnap.data();
      const currentEndDate = member.endDate || null;

      if (result === "renewed") {
        const before = millis(requestSnap.data().currentEndDate);
        const after = millis(currentEndDate);

        // Do not allow an admin to label a request renewed unless the member's
        // subscription end date was actually changed after the request arrived.
        if (after === null || (before !== null && after <= before)) {
          showMessage("لم يتغير تاريخ نهاية الاشتراك. افتحي ملف العضوة ونفّذي التجديد أولًا، ثم أكّدي النتيجة.", "error");
          button.disabled = false;
          return;
        }
      }

      const update = {
        status: result,
        adminNote,
        reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
        reviewedBy: user.uid
      };

      if (result === "renewed") {
        update.verifiedEndDate = currentEndDate;
        update.renewedAt = firebase.firestore.FieldValue.serverTimestamp();
      }

      await request.ref.update(update);
      showMessage(
        result === "renewed"
          ? "تم تسجيل التجديد بعد التحقق من تحديث تاريخ نهاية الاشتراك."
          : "تم تسجيل أن الاشتراك لم يتم تجديده.",
        "success"
      );
      await loadRequests();
    } catch (error) {
      console.error("Update renewal result error:", error);
      showMessage("تعذر تحديث حالة الطلب. تحققي من قواعد Firestore وحاولي مجددًا.", "error");
      button.disabled = false;
    }
  }

  function init() {
    if (!$("admin-renewal-requests-list")) return;

    $("refresh-renewal-requests")?.addEventListener("click", loadRequests);

    document.querySelectorAll("[data-renewal-filter]").forEach(button => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.renewalFilter;
        document.querySelectorAll("[data-renewal-filter]").forEach(item => {
          item.classList.toggle("active", item === button);
        });
        renderRequests();
      });
    });

    firebase.auth().onAuthStateChanged(async user => {
      if (await isAdmin(user)) loadRequests();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
