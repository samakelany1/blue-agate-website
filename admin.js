// Blue Agate - Admin Dashboard
// صلاحية الإدارة يتم التحقق منها من Firestore: admins/{UID} مع role = "admin".

let allMembers = [];
let currentEditingUid = null;
let allTrainers = [];

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

function addMemberMessage(message, type = "info") {
  const box = document.getElementById("add-member-message");
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
  return d.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
}

function dateKeyToArabic(key) {
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString("ar-SA", { weekday: "short", day: "numeric", month: "short" });
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
  const doc = await firebase.firestore().collection("admins").doc(user.uid).get();
  return doc.exists && doc.data().role === "admin";
}

function localDateToTimestamp(dateString, endOfDay = false) {
  return firebase.firestore.Timestamp.fromDate(new Date(`${dateString}T${endOfDay ? "23:59:59" : "00:00:00"}`));
}

function dateToInputDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function previousDateKey(dateString) {
  const d = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() - 1);
  return dateToInputDate(d);
}

function todayInputDate() {
  return dateToInputDate(new Date());
}

function addCalendarMonths(date, months) {
  const result = new Date(date.getTime());
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

function subscriptionMonths(type) {
  const durations = { "شهر": 1, "شهرين": 2, "3 شهور": 3, "4 شهور": 4 };
  return durations[type] || 0;
}

function calculateEndDate(startString, type) {
  const start = new Date(`${startString}T00:00:00`);
  if (Number.isNaN(start.getTime())) return "";

  const months = subscriptionMonths(type);
  if (!months) return "";

  const end = addCalendarMonths(start, months);
  end.setDate(end.getDate() - 1);
  return dateToInputDate(end);
}

function nextRenewalStart(member) {
  const end = toDateObject(member.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (end) {
    end.setHours(0, 0, 0, 0);
    if (end >= today) {
      end.setDate(end.getDate() + 1);
      return end;
    }
  }
  return today;
}

async function loadMembers() {
  const list = document.getElementById("members-list");
  list.innerHTML = '<div class="empty-state">جاري تحميل المشتركات...</div>';

  try {
    const snapshot = await firebase.firestore().collection("members").orderBy("name").get();
    allMembers = [];
    snapshot.forEach(doc => { const data = doc.data(); if (!data.linkedToUid) allMembers.push({ uid: doc.id, ...data }); });
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
    const text = [member.name, member.email, member.phone, member.membershipType].filter(Boolean).join(" ").toLowerCase();
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
    return `<button class="member-row" type="button" data-uid="${escapeHtml(member.uid)}">
      <div class="member-main"><strong>${escapeHtml(member.name || "بدون اسم")}</strong><span>${escapeHtml(member.importedWithoutLogin ? "لا يوجد حساب دخول — مستوردة من نوشن" : (member.email || member.phone || "بدون بيانات تواصل"))}</span></div>
      <div class="member-meta"><span class="status-pill ${stateClass}">${stateText}</span><span>${escapeHtml(member.membershipType || "نوع الاشتراك غير مضاف")}</span></div>
    </button>`;
  }).join("");

  list.querySelectorAll(".member-row").forEach(row => row.addEventListener("click", () => openMemberEditor(row.dataset.uid)));
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

async function openMemberEditor(uid) {
  const member = allMembers.find(m => m.uid === uid);
  if (!member) return;
  currentEditingUid = uid;
  document.getElementById("add-member").hidden = true;
  document.getElementById("member-editor").hidden = false;
  document.getElementById("editing-member-id").textContent = `UID: ${uid}`;
  document.getElementById("edit-uid").value = uid;
  document.getElementById("edit-name").value = member.name || "";
  document.getElementById("edit-email").value = member.email || "";
  document.getElementById("edit-phone").value = member.phone || "";
  document.getElementById("edit-membership").value = member.membershipType || "";
  document.getElementById("edit-start").value = firestoreDateToInput(member.startDate);
  document.getElementById("edit-end").value = firestoreDateToInput(member.endDate);
  document.getElementById("activation-start-date").value = todayInputDate();
  document.getElementById("renewal-start-date").value = todayInputDate();
  document.getElementById("activation-duration").value = member.membershipType || "شهر";
  document.getElementById("renewal-duration").value = member.membershipType || "شهر";
  editorMessage("", "info");
  document.getElementById("editor-message").hidden = true;
  await Promise.all([loadMemberAttendance(uid), loadAdminMeasurements(uid)]);
  document.getElementById("measurement-date").value = todayInputDate();
  document.getElementById("member-editor").scrollIntoView({ behavior: "smooth", block: "start" });
}

function firestoreDateToInput(value) {
  const d = toDateObject(value);
  if (!d) return "";
  return dateToInputDate(d);
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
      phone: document.getElementById("edit-phone").value.trim()
    };
    await firebase.firestore().collection("members").doc(currentEditingUid).set(data, { merge: true });
    editorMessage("تم حفظ بيانات العضوة. تواريخ الاشتراك وأرصدتهما تُدار من زري التفعيل والتجديد.", "success");
    await loadMembers();
  } catch (error) {
    console.error(error);
    editorMessage("تعذر حفظ البيانات. تأكدي من قواعد Firestore.", "error");
  } finally {
    if (button) button.disabled = false;
  }
}

function openAddMember() {
  currentEditingUid = null;
  document.getElementById("member-editor").hidden = true;
  document.getElementById("add-member").hidden = false;
  document.getElementById("add-member-form").reset();
  addMemberMessage("", "info");
  document.getElementById("add-member-message").hidden = true;
  document.getElementById("add-member").scrollIntoView({ behavior: "smooth", block: "start" });
}


async function createMemberAccount(event) {
  event.preventDefault();
  const button = event.submitter;
  if (button) button.disabled = true;

  const name = document.getElementById("new-name").value.trim();
  const email = document.getElementById("new-email").value.trim();
  const phone = document.getElementById("new-phone").value.trim();
  const membershipType = document.getElementById("new-membership").value;
  const password = document.getElementById("new-password").value;

  if (!name || !email || !password) {
    addMemberMessage("أكملي الاسم والبريد وكلمة المرور.", "error");
    if (button) button.disabled = false;
    return;
  }

  let secondaryApp = null;
  try {
    addMemberMessage("جاري إنشاء حساب المشتركة...", "info");
    secondaryApp = firebase.app().name === "[DEFAULT]" ? firebase.initializeApp(firebaseConfig, `memberCreator_${Date.now()}`) : null;
    const authApp = secondaryApp || firebase.app();
    const result = await authApp.auth().createUserWithEmailAndPassword(email, password);
    const uid = result.user.uid;

    await firebase.firestore().collection("members").doc(uid).set({
      uid,
      name,
      email,
      phone,
      membershipType,
      subscriptionMonths: subscriptionMonths(membershipType) || null,
      absenceAllowanceDays: 7,
      absenceAllowanceDaysRemaining: 7,
      attendanceDaysRemaining: 30,
      graceAbsenceDaysRemaining: 7,
      attendancePlanStartedAt: null,
      attendanceLastProcessedDate: null,
      startDate: null,
      endDate: null,
      membershipActive: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    if (secondaryApp) await secondaryApp.delete();
    addMemberMessage("تم إنشاء المشتركة وحساب الدخول بنجاح ✓", "success");
    document.getElementById("add-member-form").reset();
    await loadMembers();
  } catch (error) {
    console.error(error);
    if (secondaryApp) {
      try { await secondaryApp.delete(); } catch (_) {}
    }
    const message = error.code === "auth/email-already-in-use"
      ? "هذا البريد مستخدم بالفعل في حساب آخر. استخدمي بريدًا مختلفًا."
      : error.code === "auth/weak-password"
        ? "كلمة المرور ضعيفة. استخدمي 6 أحرف على الأقل."
        : "تعذر إنشاء المشتركة. تأكدي من قواعد Firestore وبيانات الحساب.";
    addMemberMessage(message, "error");
  } finally {
    if (button) button.disabled = false;
  }
}

async function applySubscriptionCycle(mode) {
  if (!currentEditingUid) return;
  const member = allMembers.find(m => m.uid === currentEditingUid);
  if (!member) return;
  const isActivation = mode === "activation";
  const startString = document.getElementById(isActivation ? "activation-start-date" : "renewal-start-date").value;
  const label = document.getElementById(isActivation ? "activation-duration" : "renewal-duration").value;
  const months = subscriptionMonths(label);
  const endString = calculateEndDate(startString, label);
  if (!startString || !endString || !months) {
    editorMessage("حددي تاريخ البداية ومدة اشتراك صحيحة.", "error");
    return;
  }
  const actionLabel = isActivation ? "تفعيل" : "تجديد";
  const confirmed = window.confirm(`${actionLabel} اشتراك ${member.name || "العضوة"}؟\n\nالبداية: ${startString}\nالنهاية: ${endString}\nرصيد الحضور: 30 يومًا\nأيام السماح: 7 أيام`);
  if (!confirmed) return;
  const buttons = [document.getElementById("activate-subscription-btn"), document.getElementById("renew-subscription-btn")].filter(Boolean);
  buttons.forEach(btn => btn.disabled = true);
  try {
    const db = firebase.firestore();
    const memberRef = db.collection("members").doc(currentEditingUid);
    const cycleId = `${currentEditingUid}_${Date.now()}`;
    const cycleData = {
      uid: currentEditingUid,
      memberName: member.name || "",
      type: mode,
      membershipType: label,
      subscriptionMonths: months,
      startDate: localDateToTimestamp(startString),
      endDate: localDateToTimestamp(endString, true),
      attendanceDaysInitial: 30,
      attendanceDaysRemaining: 30,
      graceAbsenceDaysInitial: 7,
      graceAbsenceDaysRemaining: 7,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: firebase.auth().currentUser.uid
    };
    const batch = db.batch();
    batch.set(memberRef, {
      membershipType: label,
      subscriptionMonths: months,
      startDate: cycleData.startDate,
      endDate: cycleData.endDate,
      attendancePlanStartedAt: cycleData.startDate,
      attendanceDaysRemaining: 30,
      graceAbsenceDaysRemaining: 7,
      graceAbsenceDaysConsumed: 0,
      absenceAllowanceDays: 7,
      absenceAllowanceDaysRemaining: 7,
      attendanceLastProcessedDate: previousDateKey(startString),
      attendancePlanVersion: 2,
      active: true,
      membershipActive: true,
      lastActivatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      ...(isActivation ? { lastActivatedBy: firebase.auth().currentUser.uid } : { lastRenewedAt: firebase.firestore.FieldValue.serverTimestamp(), lastRenewedBy: firebase.auth().currentUser.uid })
    }, { merge: true });
    batch.set(db.collection("subscriptionRecords").doc(cycleId), cycleData);
    await batch.commit();
    editorMessage(`تم ${actionLabel} الاشتراك بنجاح ✓ من ${startString} إلى ${endString}. بدأ رصيد جديد: 30 يوم حضور و7 أيام سماح.`, "success");
    await loadMembers();
    await loadMemberAttendance(currentEditingUid);
  } catch (error) {
    console.error(error);
    editorMessage(`تعذر ${actionLabel} الاشتراك. تحققي من صلاحيات Firestore.`, "error");
  } finally {
    buttons.forEach(btn => btn.disabled = false);
  }
}

function closureMessage(message, type = "info") {
  const box = document.getElementById("closure-message");
  if (!box) return;
  box.textContent = message;
  box.className = `admin-message ${type}`;
  box.hidden = false;
}

function keyDate(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }

async function saveClubClosure(event) {
  event.preventDefault();
  const startKey = document.getElementById("closure-start").value;
  const endKey = document.getElementById("closure-end").value;
  const closureType = document.getElementById("closure-type").value;
  const note = document.getElementById("closure-note").value.trim();
  if (!startKey || !endKey || endKey < startKey || startKey < todayInputDate()) { closureMessage("اختاري تاريخًا من اليوم أو بعده، وتأكدي من ترتيب البداية والنهاية.", "error"); return; }
  const start = new Date(`${startKey}T00:00:00`), end = new Date(`${endKey}T00:00:00`);
  const keys = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
    keys.push(keyDate(d));
    if (keys.length > 90) break;
  }
  if (!keys.length || keys.length > 90) { closureMessage("يمكن تسجيل 90 يوم إغلاق كحد أقصى في العملية الواحدة.", "error"); return; }
  const button = event.submitter; if (button) button.disabled = true;
  try {
    const db = firebase.firestore();
    for (let offset = 0; offset < keys.length; offset += 400) {
      const batch = db.batch();
      keys.slice(offset, offset+400).forEach(key => batch.set(db.collection("clubCalendar").doc(key), {
        dateKey: key, closed: true, type: "closed", closureType, reason: note,
        closureCreatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        closureCreatedBy: firebase.auth().currentUser.uid
      }, { merge: true }));
      await batch.commit();
    }
    closureMessage(`تم تسجيل ${keys.length} يوم إغلاق. سيُمدد النظام نهاية الاشتراكات المؤهلة يومًا عن كل يوم إغلاق، دون المساس برصيد 30 أو 7.`, "success");
    document.getElementById("closure-form").reset();
    await loadClubClosures();
  } catch (error) {
    console.error(error); closureMessage("تعذر حفظ الإغلاق. تحققي من صلاحيات Firestore.", "error");
  } finally { if (button) button.disabled = false; }
}

async function loadClubClosures() {
  const list = document.getElementById("closures-list");
  if (!list) return;
  try {
    const snap = await firebase.firestore().collection("clubCalendar").limit(200).get();
    const closed = snap.docs.filter(doc => doc.data().closed === true).sort((a,b) => b.id.localeCompare(a.id)).slice(0,20);
    list.innerHTML = closed.length ? closed.map(doc => `<span>${escapeHtml(doc.id)} • ${escapeHtml(doc.data().reason || doc.data().closureType || "إغلاق النادي")}</span>`).join("") : '<span>لا توجد أيام إغلاق مسجلة.</span>';
  } catch (error) { console.warn("Could not load closure dates", error); list.innerHTML = ""; }
}

function measurementAdminMessage(message, type = "info") {
  const box = document.getElementById("measurement-admin-message");
  if (!box) return;
  box.textContent = message;
  box.className = `admin-message ${type}`;
  box.hidden = false;
}

function measurementNumber(id) {
  const raw = document.getElementById(id).value.trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error("تحققي من قيم القياسات المدخلة.");
  return value;
}

async function saveMemberMeasurement(event) {
  event.preventDefault();
  if (!currentEditingUid) return;
  const button = document.getElementById("save-measurement-btn");
  button.disabled = true;
  try {
    const dateKey = document.getElementById("measurement-date").value;
    if (!dateKey) throw new Error("حددي تاريخ القياس.");
    const record = {
      dateKey,
      height: measurementNumber("measurement-height"),
      weight: measurementNumber("measurement-weight"),
      neck: measurementNumber("measurement-neck"),
      upperArm: measurementNumber("measurement-upperarm"),
      forearm: measurementNumber("measurement-forearm"),
      chest: measurementNumber("measurement-chest"),
      waist: measurementNumber("measurement-waist"),
      abdomen: measurementNumber("measurement-abdomen"),
      hips: measurementNumber("measurement-hips"),
      thigh: measurementNumber("measurement-thigh"),
      calf: measurementNumber("measurement-calf"),
      ankle: measurementNumber("measurement-ankle"),
      notes: document.getElementById("measurement-notes").value.trim(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: firebase.auth().currentUser.uid
    };
    if (Object.entries(record).every(([key, value]) => ["dateKey", "createdAt", "createdBy"].includes(key) || value === null || value === "")) {
      throw new Error("أدخلي قياسًا واحدًا على الأقل قبل الحفظ.");
    }
    await firebase.firestore().collection("members").doc(currentEditingUid).collection("measurements").add(record);
    document.getElementById("measurement-form").reset();
    document.getElementById("measurement-date").value = todayInputDate();
    measurementAdminMessage("تم حفظ القياسات وإضافتها إلى حساب المشتركة بنجاح ✓", "success");
    await loadAdminMeasurements(currentEditingUid);
  } catch (error) {
    console.error("Save measurement error:", error);
    measurementAdminMessage(error.message || "تعذر حفظ القياسات. تحققي من صلاحيات Firestore.", "error");
  } finally { button.disabled = false; }
}

async function loadAdminMeasurements(uid) {
  const list = document.getElementById("admin-measurements-list");
  if (!list) return;
  list.innerHTML = '<div class="mini-empty">جاري تحميل القياسات...</div>';
  try {
    const snap = await firebase.firestore().collection("members").doc(uid).collection("measurements").get();
    const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => String(b.dateKey || "").localeCompare(String(a.dateKey || "")));
    if (!records.length) { list.innerHTML = '<div class="mini-empty">لا توجد قياسات مسجلة لهذه المشتركة.</div>'; return; }
    list.innerHTML = records.map(r => {
      const vals = [["الطول",r.height,"سم"],["الوزن",r.weight,"كجم"],["محيط الرقبة",r.neck,"سم"],["محيط العضد",r.upperArm,"سم"],["محيط الساعد",r.forearm,"سم"],["محيط الصدر",r.chest,"سم"],["محيط الوسط",r.waist,"سم"],["محيط البطن",r.abdomen,"سم"],["محيط الأرداف",r.hips,"سم"],["محيط الفخذ",r.thigh,"سم"],["محيط السمانة",r.calf,"سم"],["محيط العرقوب",r.ankle,"سم"]].filter(x => x[1] !== null && x[1] !== undefined && x[1] !== "");
      return `<div class="measurement-admin-item"><div><strong>${escapeHtml(r.dateKey || "بدون تاريخ")}</strong><span>${vals.map(v => `${v[0]}: ${escapeHtml(v[1])} ${v[2]}`).join(" • ") || "لا توجد قيم"}</span>${r.notes ? `<small>${escapeHtml(r.notes)}</small>` : ""}</div><button type="button" class="measurement-delete-btn" data-measurement-id="${escapeHtml(r.id)}">حذف</button></div>`;
    }).join("");
    list.querySelectorAll("[data-measurement-id]").forEach(btn => btn.addEventListener("click", async () => {
      if (!currentEditingUid || !confirm("هل تريدين حذف سجل القياس هذا؟")) return;
      btn.disabled = true;
      try {
        await firebase.firestore().collection("members").doc(currentEditingUid).collection("measurements").doc(btn.dataset.measurementId).delete();
        measurementAdminMessage("تم حذف سجل القياس.", "success");
        await loadAdminMeasurements(currentEditingUid);
      } catch (error) {
        console.error(error); measurementAdminMessage("تعذر حذف سجل القياس.", "error"); btn.disabled = false;
      }
    }));
  } catch (error) {
    console.error("Load admin measurements error:", error);
    list.innerHTML = '<div class="mini-empty">تعذر تحميل القياسات. تحققي من قواعد Firestore.</div>';
  }
}

async function loadMemberAttendance(uid) {
  const list = document.getElementById("editor-attendance-list");
  const total = document.getElementById("editor-attendance-total");
  list.innerHTML = '<div class="mini-empty">جاري التحميل...</div>';
  try {
    const snapshot = await firebase.firestore().collection("members").doc(uid).collection("attendance").orderBy("dateKey", "desc").get();
    const dates = [];
    snapshot.forEach(doc => { const data = doc.data(); if (data.dateKey) dates.push(data.dateKey); });
    total.textContent = `${dates.length} حضور`;
    list.innerHTML = dates.length ? dates.slice(0, 15).map(key => `<span>${dateKeyToArabic(key)} ✓</span>`).join("") : '<div class="mini-empty">لا يوجد حضور مسجل.</div>';
  } catch (error) {
    console.error(error);
    list.innerHTML = '<div class="mini-empty">تعذر تحميل سجل الحضور.</div>';
  }
}


function trainerMessage(message, type = "info") {
  const box = document.getElementById("add-trainer-message");
  if (!box) return;
  box.textContent = message;
  box.className = `admin-message ${type}`;
  box.hidden = false;
}

function openAddTrainer() {
  document.getElementById("add-trainer").hidden = false;
  document.getElementById("add-trainer-form").reset();
  document.getElementById("add-trainer-message").hidden = true;
  document.getElementById("add-trainer").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function createTrainerAccount(event) {
  event.preventDefault();
  const button = event.submitter;
  if (button) button.disabled = true;
  const name = document.getElementById("new-trainer-name").value.trim();
  const email = document.getElementById("new-trainer-email").value.trim();
  const password = document.getElementById("new-trainer-password").value;
  const phone = document.getElementById("new-trainer-phone").value.trim();
  let secondaryApp = null;
  try {
    trainerMessage("جاري إنشاء حساب المدربة...", "info");
    secondaryApp = firebase.initializeApp(firebaseConfig, `trainerCreator_${Date.now()}`);
    const result = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
    const uid = result.user.uid;
    await firebase.firestore().collection("staff").doc(uid).set({
      uid, name, email, phone, role: "trainer", active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await secondaryApp.delete();
    secondaryApp = null;
    trainerMessage("تم إنشاء حساب المدربة بنجاح ✓", "success");
    document.getElementById("add-trainer-form").reset();
    await loadTrainers();
  } catch (error) {
    console.error(error);
    if (secondaryApp) { try { await secondaryApp.delete(); } catch (_) {} }
    const message = error.code === "auth/email-already-in-use"
      ? "هذا البريد مستخدم بالفعل. استخدمي بريدًا مختلفًا."
      : error.code === "auth/weak-password"
        ? "كلمة المرور ضعيفة. استخدمي 6 أحرف على الأقل."
        : "تعذر إنشاء حساب المدربة. تأكدي من قواعد Firestore.";
    trainerMessage(message, "error");
  } finally {
    if (button) button.disabled = false;
  }
}

async function loadTrainers() {
  const list = document.getElementById("trainers-list");
  if (!list) return;
  list.innerHTML = '<div class="empty-state">جاري تحميل المدربات...</div>';
  try {
    const snapshot = await firebase.firestore().collection("staff").where("role", "==", "trainer").get();
    allTrainers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }))
      .sort((a,b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
    if (!allTrainers.length) {
      list.innerHTML = '<div class="empty-state">لا توجد مدربات مضافات حتى الآن.</div>';
      return;
    }
    list.innerHTML = allTrainers.map(trainer => `
      <div class="member-row trainer-row">
        <div class="member-main">
          <strong>${escapeHtml(trainer.name || "بدون اسم")}</strong>
          <span>${escapeHtml(trainer.email || "بدون بريد")}</span>
        </div>
        <div class="member-meta">
          <span class="status-pill ${trainer.active === false ? "expired" : "active"}">${trainer.active === false ? "موقفة" : "مفعلة"}</span>
        </div>
      </div>`).join("");
  } catch (error) {
    console.error(error);
    list.innerHTML = '<div class="empty-state error-state">تعذر تحميل المدربات. تأكدي من قواعد Firestore.</div>';
  }
}

function showAdminPanel() {
  document.getElementById("admin-login-section").hidden = true;
  document.getElementById("admin-panel").hidden = false;
  document.getElementById("admin-logout").hidden = false;
  loadMembers();
  loadTrainers();
  loadClubClosures();
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

// One-time member linking codes for imported Notion memberships.
function randomLinkCode() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}
async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
async function issueMemberLinkCode() {
  const resultBox = document.getElementById("member-link-code-result");
  const button = document.getElementById("issue-member-link-code");
  if (!currentEditingUid) return;
  const member = allMembers.find(m => m.uid === currentEditingUid);
  if (!member || !member.importedWithoutLogin || !member.notionMemberPageId) {
    resultBox.textContent = "هذا السجل ليس عضوية مستوردة قابلة للربط.";
    resultBox.className = "admin-message error"; resultBox.hidden = false; return;
  }
  button.disabled = true;
  try {
    const db = firebase.firestore();
    const recordsSnap = await db.collection("subscriptionRecords").where("sourcePageId", "==", member.notionMemberPageId).get();
    const history = recordsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const code = randomLinkCode();
    const codeHash = await sha256Hex(code);
    await db.collection("memberLinkCodes").doc(codeHash).set({
      sourceMemberId: currentEditingUid,
      sourcePageId: member.notionMemberPageId,
      memberData: member,
      subscriptionHistory: history,
      status: "active",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: firebase.auth().currentUser.uid
    });
    resultBox.textContent = `رمز الربط (يُستخدم مرة واحدة): ${code} — انسخيه وأرسليه للمشتركة الآن. لن يظهر مرة أخرى بعد إغلاق هذه الصفحة.`;
    resultBox.className = "admin-message success"; resultBox.hidden = false;
  } catch (error) {
    console.error(error);
    resultBox.textContent = "تعذر إصدار رمز الربط. تحققي من قواعد Firestore.";
    resultBox.className = "admin-message error"; resultBox.hidden = false;
  } finally { button.disabled = false; }
}

async function initAdmin() {
  firebase.initializeApp(firebaseConfig);
  document.getElementById("admin-login-form").addEventListener("submit", loginAdmin);
  document.getElementById("member-search").addEventListener("input", renderMembers);
  document.getElementById("refresh-members").addEventListener("click", loadMembers);
  document.getElementById("member-form").addEventListener("submit", saveMember);
  document.getElementById("measurement-form").addEventListener("submit", saveMemberMeasurement);
  document.getElementById("issue-member-link-code").addEventListener("click", issueMemberLinkCode);
  document.getElementById("open-add-member").addEventListener("click", openAddMember);
  document.getElementById("open-add-trainer").addEventListener("click", openAddTrainer);
  document.getElementById("close-add-trainer").addEventListener("click", () => { document.getElementById("add-trainer").hidden = true; });
  document.getElementById("add-trainer-form").addEventListener("submit", createTrainerAccount);
  document.getElementById("close-add-member").addEventListener("click", () => { document.getElementById("add-member").hidden = true; });
  document.getElementById("add-member-form").addEventListener("submit", createMemberAccount);
  document.getElementById("activate-subscription-btn").addEventListener("click", () => applySubscriptionCycle("activation"));
  document.getElementById("renew-subscription-btn").addEventListener("click", () => applySubscriptionCycle("renewal"));
  document.getElementById("closure-form").addEventListener("submit", saveClubClosure);
  document.getElementById("closure-start").min = todayInputDate();
  document.getElementById("closure-end").min = todayInputDate();
  document.getElementById("close-editor").addEventListener("click", () => { document.getElementById("member-editor").hidden = true; currentEditingUid = null; document.getElementById("measurement-form").reset(); document.getElementById("admin-measurements-list").innerHTML = '<div class="mini-empty">اختاري مشتركة لعرض قياساتها.</div>'; });
  document.getElementById("admin-logout").addEventListener("click", () => firebase.auth().signOut());

  firebase.auth().onAuthStateChanged(async user => {
    if (!user) { showAdminLogin(); return; }
    try {
      if (await isCurrentUserAdmin(user)) showAdminPanel();
      else { await firebase.auth().signOut(); adminMessage("هذا الحساب ليس حساب إدارة.", "error"); }
    } catch (error) {
      console.error(error);
      await firebase.auth().signOut();
      adminMessage("تعذر التحقق من صلاحية الإدارة.", "error");
    }
  });
}

document.addEventListener("DOMContentLoaded", initAdmin);


// =========================
// Trainer weekly schedule
// =========================
const TRAINER_DAYS = [
  {id:0, name:"الأحد"},
  {id:1, name:"الاثنين"},
  {id:2, name:"الثلاثاء"},
  {id:3, name:"الأربعاء"},
  {id:4, name:"الخميس"},
  {id:5, name:"الجمعة"},
  {id:6, name:"السبت"}
];

const TRAINER_CLASSES = [
  "علوي",
  "بطن وكور",
  "سفلي",
  "HIIT",
  "كارديو",
  "ظهر وجوانب",
  "بيلاتس",
  "فل بودي",
  "يوغا"
];

let currentScheduleTrainer = null;

function classOptions(selected = "") {
  return TRAINER_CLASSES.map(name =>
    `<option value="${escapeHtml(name)}" ${name === selected ? "selected" : ""}>${escapeHtml(name)}</option>`
  ).join("");
}

function renderScheduleEditor(rows = []) {
  const editor = document.getElementById("weekly-schedule-editor");
  if (!editor) return;

  editor.innerHTML = TRAINER_DAYS.map(day => {
    const dayRows = rows.filter(r => Number(r.day) === day.id);
    const slots = dayRows.length ? dayRows : [];
    return `
      <div class="schedule-day-card" data-day="${day.id}">
        <div class="schedule-day-head">
          <h4>${day.name}</h4>
          <span class="muted-text">${slots.length ? `${slots.length} كلاس` : "لا يوجد كلاس"}</span>
        </div>
        <div class="schedule-slots">
          ${slots.map(r => scheduleSlotHtml(day.id, r.time || "", r.className || "")).join("")}
        </div>
        <button type="button" class="add-slot-btn" onclick="addScheduleSlot(${day.id})">+ إضافة كلاس</button>
      </div>
    `;
  }).join("");
}

function scheduleSlotHtml(day, time = "", className = "") {
  return `
    <div class="schedule-slot" data-day="${day}">
      <input type="text" class="schedule-time" placeholder="مثال: 4:30 م" value="${escapeHtml(time)}">
      <select class="schedule-class">${classOptions(className)}</select>
      <button type="button" onclick="this.closest('.schedule-slot').remove(); updateDayCount(this.closest('.schedule-day-card'))">حذف</button>
    </div>
  `;
}

function addScheduleSlot(day) {
  const card = document.querySelector(`.schedule-day-card[data-day="${day}"]`);
  if (!card) return;
  const slots = card.querySelector(".schedule-slots");
  slots.insertAdjacentHTML("beforeend", scheduleSlotHtml(day, "", ""));
  updateDayCount(card);
}

function updateDayCount(card) {
  if (!card) return;
  const count = card.querySelectorAll(".schedule-slot").length;
  const badge = card.querySelector(".schedule-day-head .muted-text");
  if (badge) badge.textContent = count ? `${count} كلاس` : "لا يوجد كلاس";
}

async function openTrainerSchedule(uid) {
  const trainer = allTrainers.find(t => t.uid === uid);
  if (!trainer) return;

  currentScheduleTrainer = trainer;
  document.getElementById("schedule-trainer-name").textContent = trainer.name || "المدربة";
  document.getElementById("trainer-schedule-panel").hidden = false;
  document.getElementById("schedule-message").hidden = true;
  document.getElementById("weekly-schedule-editor").innerHTML = '<div class="empty-state">جاري تحميل الجدول...</div>';
  document.getElementById("trainer-schedule-panel").scrollIntoView({behavior:"smooth", block:"start"});

  try {
    const snap = await firebase.firestore()
      .collection("staff").doc(uid).collection("schedule").get();
    const rows = snap.docs.map(d => ({id:d.id, ...d.data()}));
    renderScheduleEditor(rows);
  } catch (error) {
    console.error(error);
    document.getElementById("schedule-message").textContent = "تعذر تحميل جدول المدربة. تأكدي من قواعد Firestore.";
    document.getElementById("schedule-message").className = "admin-message error";
    document.getElementById("schedule-message").hidden = false;
    renderScheduleEditor([]);
  }
}

function scheduleMessage(message, type = "info") {
  const box = document.getElementById("schedule-message");
  if (!box) return;
  box.textContent = message;
  box.className = `admin-message ${type}`;
  box.hidden = false;
}

async function saveTrainerSchedule() {
  if (!currentScheduleTrainer) return;

  const button = document.getElementById("save-trainer-schedule");
  button.disabled = true;

  try {
    const batch = firebase.firestore().batch();
    const ref = firebase.firestore()
      .collection("staff").doc(currentScheduleTrainer.uid).collection("schedule");

    const old = await ref.get();
    old.forEach(doc => batch.delete(doc.ref));

    const cards = document.querySelectorAll(".schedule-day-card");
    let count = 0;

    cards.forEach(card => {
      const day = Number(card.dataset.day);
      card.querySelectorAll(".schedule-slot").forEach(slot => {
        const time = slot.querySelector(".schedule-time").value.trim();
        const className = slot.querySelector(".schedule-class").value;
        if (!time || !className) return;

        const docRef = ref.doc();
        batch.set(docRef, {
          day,
          dayName: TRAINER_DAYS.find(d => d.id === day)?.name || "",
          time,
          className,
          active: true
        });
        count++;
      });
    });

    await batch.commit();
    scheduleMessage(`تم حفظ جدول ${currentScheduleTrainer.name || "المدربة"} بنجاح ✓ (${count} كلاس أسبوعيًا)`, "success");
  } catch (error) {
    console.error(error);
    scheduleMessage("تعذر حفظ الجدول. تأكدي من قواعد Firestore ثم حاولي مرة أخرى.", "error");
  } finally {
    button.disabled = false;
  }
}

// Replace the trainer list rendering so each trainer opens her schedule.
const originalLoadTrainers = loadTrainers;
loadTrainers = async function() {
  await originalLoadTrainers();
  const list = document.getElementById("trainers-list");
  if (!list) return;
  list.querySelectorAll(".trainer-row").forEach((row, index) => {
    const trainer = allTrainers[index];
    if (!trainer) return;
    row.classList.add("schedule-open");
    row.title = "اضغطي لفتح جدول المدربة";
    row.addEventListener("click", () => openTrainerSchedule(trainer.uid));
  });
};

document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.getElementById("close-trainer-schedule");
  const saveBtn = document.getElementById("save-trainer-schedule");
  if (closeBtn) closeBtn.addEventListener("click", () => {
    document.getElementById("trainer-schedule-panel").hidden = true;
    currentScheduleTrainer = null;
  });
  if (saveBtn) saveBtn.addEventListener("click", saveTrainerSchedule);
});