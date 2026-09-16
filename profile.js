// Blue Agate - Member Profile & Subscription
// العضوة ترى حالة الاشتراك فقط بدون مدة أو تواريخ.

function toProfileDate(dateValue) {
  if (!dateValue) return null;
  const date = typeof dateValue.toDate === "function" ? dateValue.toDate() : new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function subscriptionStatus(endDateValue) {
  const end = toProfileDate(endDateValue);

  if (!end) {
    return {
      title: "بيانات الاشتراك غير مكتملة",
      text: "راجعي النادي لتحديث بيانات اشتراكك.",
      className: "subscription-unknown"
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  const days = Math.ceil((end - today) / 86400000);

  if (days < 0) {
    return {
      title: "اشتراكك منتهي",
      text: "يمكنكِ تجديد اشتراكك من النادي.",
      className: "subscription-expired"
    };
  }

  if (days <= 7) {
    return {
      title: "اشتراكك قريب من الانتهاء",
      text: "إذا كنتِ ترغبين بالاستمرار، تواصلي مع النادي للتجديد.",
      className: "subscription-warning"
    };
  }

  return {
    title: "اشتراكك نشط ✓",
    text: "اشتراكك فعال ويمكنكِ الاستفادة من خدمات النادي.",
    className: "subscription-active"
  };
}

async function loadMemberProfile() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  try {
    const doc = await firebase.firestore().collection("members").doc(user.uid).get();
    if (!doc.exists) return;

    const data = doc.data();
    const name = data.name || user.displayName || "عضوة Blue Agate";
    const email = data.email || user.email || "";
    const phone = data.phone || "غير مضاف";
    const membershipType = data.membershipType || "غير مضاف";

    const nameEl = document.getElementById("profile-name");
    const emailEl = document.getElementById("profile-email");
    const phoneEl = document.getElementById("profile-phone");
    const membershipEl = document.getElementById("profile-membership");

    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;
    if (phoneEl) phoneEl.textContent = phone;
    if (membershipEl) membershipEl.textContent = membershipType;

    const status = subscriptionStatus(data.endDate);
    const statusBox = document.getElementById("subscription-status");
    const statusTitle = document.getElementById("subscription-status-title");
    const statusText = document.getElementById("subscription-status-text");

    if (statusBox) statusBox.className = `subscription-status ${status.className}`;
    if (statusTitle) statusTitle.textContent = status.title;
    if (statusText) statusText.textContent = status.text;

    const nameInput = document.getElementById("profile-name-input");
    const phoneInput = document.getElementById("profile-phone-input");
    if (nameInput) nameInput.value = name;
    if (phoneInput) phoneInput.value = data.phone || "";
  } catch (error) {
    console.error("Profile load error:", error);
  }
}

async function saveMemberProfile(event) {
  event.preventDefault();
  const user = firebase.auth().currentUser;
  if (!user) return;

  const nameInput = document.getElementById("profile-name-input");
  const phoneInput = document.getElementById("profile-phone-input");
  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();

  if (!name) {
    showProfileMessage("اكتبي اسمك.", "error");
    return;
  }

  const button = document.getElementById("save-profile-btn");
  if (button) button.disabled = true;

  try {
    await firebase.firestore().collection("members").doc(user.uid).update({ name, phone });
    showProfileMessage("تم حفظ بياناتك بنجاح ✓", "success");
    await loadMemberProfile();
  } catch (error) {
    console.error("Profile save error:", error);
    showProfileMessage("تعذر حفظ البيانات حاليًا.", "error");
  } finally {
    if (button) button.disabled = false;
  }
}

function showProfileMessage(message, type) {
  const box = document.getElementById("profile-message");
  if (!box) return;
  box.textContent = message;
  box.className = `profile-message ${type}`;
  box.hidden = false;
  setTimeout(() => { box.hidden = true; }, 3500);
}

function initMemberProfile() {
  document.getElementById("profile-form")?.addEventListener("submit", saveMemberProfile);
  firebase.auth().onAuthStateChanged(user => {
    if (user) loadMemberProfile();
  });
}

document.addEventListener("DOMContentLoaded", initMemberProfile);
