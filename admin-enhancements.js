// Admin additions: subscription gifts and editable contact information.
(() => {
  const $ = id => document.getElementById(id);
  const db = () => firebase.firestore();
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const asDate = value => value && typeof value.toDate === "function" ? value.toDate() : (value ? new Date(value) : null);
  const dateKey = value => {
    const d = asDate(value);
    if (!d || Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Riyadh", year:"numeric", month:"2-digit", day:"2-digit" }).format(d);
  };
  const dateLabel = key => {
    if (!key) return "غير محدد";
    const [y,m,d] = key.split("-").map(Number);
    return new Intl.DateTimeFormat("ar-SA", { day:"numeric", month:"long", year:"numeric", timeZone:"Asia/Riyadh" }).format(new Date(Date.UTC(y,m-1,d,12)));
  };
  const timestampEndOfDay = key => {
    const [y,m,d] = key.split("-").map(Number);
    return firebase.firestore.Timestamp.fromDate(new Date(Date.UTC(y,m-1,d,20,59,59,999)));
  };
  const addDays = (key, count) => {
    const [y,m,d] = key.split("-").map(Number);
    const date = new Date(Date.UTC(y,m-1,d+count));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}-${String(date.getUTCDate()).padStart(2,"0")}`;
  };
  const message = (id, text, type="info") => {
    const el = $(id); if (!el) return;
    el.textContent = text; el.className = `admin-message ${type}`; el.hidden = false;
  };
  async function adminReady(user) {
    if (!user) return false;
    try {
      const snap = await db().collection("admins").doc(user.uid).get();
      return snap.exists && snap.data().role === "admin";
    } catch (e) { console.warn("Admin enhancements authorization check failed", e); return false; }
  }
  async function findMember(identifier) {
    const value = identifier.trim();
    let snap = await db().collection("members").doc(value).get();
    if (snap.exists) return snap;
    const byEmail = await db().collection("members").where("email", "==", value).limit(2).get();
    if (byEmail.size === 1) return byEmail.docs[0];
    if (byEmail.size > 1) throw new Error("يوجد أكثر من سجل بهذا البريد. استخدمي رقم العضوية UID.");
    throw new Error("لم نعثر على مشتركة بهذا البريد أو رقم العضوية.");
  }
  async function saveGift(event) {
    event.preventDefault();
    const button = event.submitter;
    if (button) button.disabled = true;
    try {
      const identifier = $("gift-member-email").value.trim();
      const days = Number($("gift-days").value);
      const reason = $("gift-reason").value.trim();
      const givenBy = $("gift-given-by").value.trim();
      if (!identifier || !Number.isInteger(days) || days < 1 || days > 90 || !reason) throw new Error("تحققي من بيانات المشتركة وعدد الأيام والسبب.");
      const memberSnap = await findMember(identifier);
      const member = memberSnap.data();
      const beforeKey = dateKey(member.endDate);
      if (!beforeKey) throw new Error("لا يوجد تاريخ انتهاء اشتراك صالح لهذا الحساب.");
      const afterKey = addDays(beforeKey, days);
      const user = firebase.auth().currentUser;
      const memberRef = memberSnap.ref;
      const adjustmentRef = memberRef.collection("subscriptionAdjustments").doc();
      const batch = db().batch();
      batch.update(memberRef, {
        endDate: timestampEndOfDay(afterKey),
        subscriptionExtensionDaysTotal: firebase.firestore.FieldValue.increment(days),
        subscriptionLastAdjustmentAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      batch.set(adjustmentRef, {
        type: "gift", days, reason, givenBy: givenBy || "",
        beforeEndDate: beforeKey, afterEndDate: afterKey,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: user ? user.uid : "",
        memberName: member.name || "",
        visibleToMember: true
      });
      await batch.commit();
      message("gift-adjustment-message", `تمت إضافة ${days} يومًا للمشتركة ${member.name || member.email || memberSnap.id}. انتهاء الاشتراك قبل الإضافة: ${dateLabel(beforeKey)} — بعد الإضافة: ${dateLabel(afterKey)}.`, "success");
      $("gift-adjustment-form").reset();
      $("gift-adjustment-preview").hidden = true;
    } catch (error) {
      console.error(error);
      message("gift-adjustment-message", error.message || "تعذرت إضافة الأيام. تحققي من صلاحيات Firestore.", "error");
    } finally { if (button) button.disabled = false; }
  }
  async function loadContact() {
    try {
      const snap = await db().collection("clubSettings").doc("contact").get();
      const data = snap.exists ? snap.data() : {};
      const map = { phone:"contact-phone", whatsapp:"contact-whatsapp", email:"contact-email", instagram:"contact-instagram", snapchat:"contact-snapchat", location:"contact-location" };
      Object.entries(map).forEach(([key,id]) => { if ($(id)) $(id).value = data[key] || ""; });
    } catch (e) { console.warn("Could not load contact settings", e); }
  }
  async function saveContact(event) {
    event.preventDefault();
    const button = event.submitter; if (button) button.disabled = true;
    try {
      const data = {
        phone: $("contact-phone").value.trim(),
        whatsapp: $("contact-whatsapp").value.trim(),
        email: $("contact-email").value.trim(),
        instagram: $("contact-instagram").value.trim(),
        snapchat: $("contact-snapchat").value.trim(),
        location: $("contact-location").value.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: firebase.auth().currentUser.uid
      };
      await db().collection("clubSettings").doc("contact").set(data, { merge:true });
      message("contact-settings-message", "تم حفظ بيانات التواصل بنجاح.", "success");
    } catch (e) {
      console.error(e);
      message("contact-settings-message", "تعذر حفظ بيانات التواصل. تحققي من قواعد Firestore.", "error");
    } finally { if (button) button.disabled = false; }
  }
  document.addEventListener("DOMContentLoaded", () => {
    if ($("gift-adjustment-form")) $("gift-adjustment-form").addEventListener("submit", saveGift);
    if ($("contact-settings-form")) $("contact-settings-form").addEventListener("submit", saveContact);
    if (!firebase.auth) return;
    firebase.auth().onAuthStateChanged(async user => {
      if (await adminReady(user)) loadContact();
    });
  });
})();
