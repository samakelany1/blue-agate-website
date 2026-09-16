// Blue Agate - Admin Dashboard
// صلاحية الإدارة يتم التحقق منها من Firestore: admins/{UID} مع role = "admin".

let allMembers = [];
let currentEditingUid = null;

function adminMessage(message, type = "info") {
  const box = document.getElementById("admin-login-message");
  if (!box) return;
  box.textContent = message;
  box.className = `admin-message ${type}`;
  box.hidden = false;
}

function editorMessage(message, type = "info") {
  const box = document.getElementById("editor-message");
  if (!box) return;
  box.textContent = message;
  box.className = `admin-message ${type}`;
  box.hidden = false;
}

function toDateObject(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value) {
  const d = toDateObject(value);
  if (!d) return "غير مضاف";
  return d.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function dateKeyToArabic(key) {
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString("ar-SA", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });
}

function subscriptionState(endDateValue) {
  const end = toDateObject(endDateValue);
  if (!end) return "unknown";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return end < today ? "expired" : "active";
}

async function isCurrentUserAdmin(user) {
  if (!user) return false;

  const doc = await firebase.firestore()
    .collection("admins")
    .doc(user.uid)
    .get();

  return doc.exists && doc.data().role === "admin";
}

async function loadMembers() {
  const list = document.getElementById("members-list");
  list.innerHTML = '<div class="empty-state">جاري تحميل المشتركات...</div>';

  try {
    const snapshot = await firebase.firestore()
      .collection("members")
      .orderBy("name")
      .get();

    allMembers = [];
    snapshot.forEach(doc => {
      allMembers.push({
        uid: doc.id,
        ...doc.data()
      });
    });

    updateStats();
    renderMembers();
  } catch (error) {
    console.error(error);
    list.innerHTML = '<div class="empty-state error-state">تعذر تحميل المشتركات. تأكدي من نشر قواعد Firestore الجديدة.</div>';
  }
}

function updateStats() {
  const active = allMembers.filter(m => subscriptionState(m.endDate) === "active").length;
  const expired = allMembers.filter(m => subscriptionState(m.endDate) === "expired").length;

  document.getElementById("members-count").textContent = allMembers.length;
  document.getElementById("active-count").textContent = active;
  document.getElementById("expired-count").textContent = expired;
}

function renderMembers() {
  const list = document.getElementById("members-list");
  const term = document.getElementById("member-search").value.trim().toLowerCase();

  const filtered = allMembers.filter(member => {
    const text = [
      member.name,
      member.email,
      member.phone,
      member.membershipType
    ].filter(Boolean).join(" ").toLowerCase();

    return text.includes(term);
  });

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">لا توجد عضوات مطابقة للبحث.</div>';
    return;
  }

  list.innerHTML = filtered.map(member => {
    const state = subscriptionState(member.endDate);
    const stateText = state === "active" ? "نشط" : state === "expired" ? "منتهي" : "غير مكتمل";
    const stateClass = state === "active" ? "active" : state === "expired" ? "expired" : "unknown";

    return `
      <button class="member-row" type="button" data-uid="${member.uid}">
        <div class="member-main">
          <strong>${escapeHtml(member.name || "بدون اسم")}</strong>
          <span>${escapeHtml(member.email || member.phone || "بدون بيانات تواصل")}</span>
        </div>
        <div class="member-meta">
          <span class="status-pill ${stateClass}">${stateText}</span>
          <span>${escapeHtml(member.membershipType || "نوع الاشتراك غير مضاف")}</span>
        </div>
      </button>
    `;
  }).join("");

  list.querySelectorAll(".member-row").forEach(row => {
    row.addEventListener("click", () => openMemberEditor(row.dataset.uid));
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function openMemberEditor(uid) {
  const member = allMembers.find(m => m.uid === uid);
  if (!member) return;

  currentEditingUid = uid;

  document.getElementById("member-editor").hidden = false;
  document.getElementById("editing-member-id").textContent = `UID: ${uid}`;

  document.getElementById("edit-uid").value = uid;
  document.getElementById("edit-name").value = member.name || "";
  document.getElementById("edit-email").value = member.email || "";
  document.getElementById("edit-phone").value = member.phone || "";
  document.getElementById("edit-membership").value = member.membershipType || "";
  document.getElementById("edit-start").value = firestoreDateToInput(member.startDate);
  document.getElementById("edit-end").value = firestoreDateToInput(member.endDate);

  editorMessage("", "info");
  document.getElementById("editor-message").hidden = true;

  await loadMemberAttendance(uid);
  document.getElementById("member-editor").scrollIntoView({ behavior: "smooth", block: "start" });
}

function firestoreDateToInput(value) {
  const d = toDateObject(value);
  if (!d) return "";

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function saveMember(event) {
  event.preventDefault();
  if (!currentEditingUid) return;

  const button = event.submitter;
  if (button) button.disabled = true;

  try {
    const data = {
      name: document.getElementById("edit-name").value.trim(),
      email: document.getElementById("edit-email").value.trim(),
      phone: document.getElementById("edit-phone").value.trim(),
      membershipType: document.getElementById("edit-membership").value
    };

    const start = document.getElementById("edit-start").value;
    const end = document.getElementById("edit-end").value;

    data.startDate = start
      ? firebase.firestore.Timestamp.fromDate(new Date(`${start}T00:00:00`))
      : null;

    data.endDate = end
      ? firebase.firestore.Timestamp.fromDate(new Date(`${end}T23:59:59`))
      : null;

    await firebase.firestore()
      .collection("members")
      .doc(currentEditingUid)
      .set(data, { merge: true });

    editorMessage("تم حفظ بيانات العضوة بنجاح ✓", "success");
    await loadMembers();
    const updated = allMembers.find(m => m.uid === currentEditingUid);
    if (updated) {
      document.getElementById("edit-name").value = updated.name || "";
    }
  } catch (error) {
    console.error(error);
    editorMessage("تعذر حفظ البيانات. تأكدي من قواعد Firestore.", "error");
  } finally {
    if (button) button.disabled = false;
  }
}

async function loadMemberAttendance(uid) {
  const list = document.getElementById("editor-attendance-list");
  const total = document.getElementById("editor-attendance-total");

  list.innerHTML = '<div class="mini-empty">جاري التحميل...</div>';

  try {
    const snapshot = await firebase.firestore()
      .collection("members")
      .doc(uid)
      .collection("attendance")
      .orderBy("dateKey", "desc")
      .get();

    const dates = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.dateKey) dates.push(data.dateKey);
    });

    total.textContent = `${dates.length} حضور`;

    list.innerHTML = dates.length
      ? dates.slice(0, 15).map(key => `<span>${dateKeyToArabic(key)} ✓</span>`).join("")
      : '<div class="mini-empty">لا يوجد حضور مسجل.</div>';
  } catch (error) {
    console.error(error);
    list.innerHTML = '<div class="mini-empty">تعذر تحميل سجل الحضور.</div>';
  }
}

function showAdminPanel() {
  document.getElementById("admin-login-section").hidden = true;
  document.getElementById("admin-panel").hidden = false;
  document.getElementById("admin-logout").hidden = false;
  loadMembers();
}

function showAdminLogin() {
  document.getElementById("admin-login-section").hidden = false;
  document.getElementById("admin-panel").hidden = true;
  document.getElementById("admin-logout").hidden = true;
}

async function loginAdmin(event) {
  event.preventDefault();

  const email = document.getElementById("admin-email").value.trim();
  const password = document.getElementById("admin-password").value;

  try {
    const result = await firebase.auth().signInWithEmailAndPassword(email, password);

    if (!(await isCurrentUserAdmin(result.user))) {
      await firebase.auth().signOut();
      adminMessage("هذا الحساب ليس لديه صلاحية دخول لوحة التحكم.", "error");
      return;
    }

    showAdminPanel();
  } catch (error) {
    console.error(error);
    adminMessage("تعذر تسجيل الدخول. تأكدي من البريد وكلمة المرور وصلاحية Admin.", "error");
  }
}

async function initAdmin() {
  firebase.initializeApp(firebaseConfig);

  document.getElementById("admin-login-form")
    .addEventListener("submit", loginAdmin);

  document.getElementById("member-search")
    .addEventListener("input", renderMembers);

  document.getElementById("refresh-members")
    .addEventListener("click", loadMembers);

  document.getElementById("member-form")
    .addEventListener("submit", saveMember);

  document.getElementById("close-editor")
    .addEventListener("click", () => {
      document.getElementById("member-editor").hidden = true;
      currentEditingUid = null;
    });

  document.getElementById("admin-logout")
    .addEventListener("click", () => firebase.auth().signOut());

  firebase.auth().onAuthStateChanged(async user => {
    if (!user) {
      showAdminLogin();
      return;
    }

    try {
      if (await isCurrentUserAdmin(user)) {
        showAdminPanel();
      } else {
        await firebase.auth().signOut();
        adminMessage("هذا الحساب ليس حساب إدارة.", "error");
      }
    } catch (error) {
      console.error(error);
      await firebase.auth().signOut();
      adminMessage("تعذر التحقق من صلاحية الإدارة.", "error");
    }
  });
}

document.addEventListener("DOMContentLoaded", initAdmin);
