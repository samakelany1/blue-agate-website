// Blue Agate - Member Profile & Subscription
// بيانات الاشتراك تُقرأ من Firestore ولا يمكن للعضوة تعديلها من الموقع.

function formatArabicDate(dateValue) {
  if (!dateValue) return "غير مضاف";

  let date;
  if (typeof dateValue.toDate === "function") {
    date = dateValue.toDate();
  } else {
    date = new Date(dateValue);
  }

  if (Number.isNaN(date.getTime())) return "غير مضاف";

  return date.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function daysRemaining(endDateValue) {
  if (!endDateValue) return null;

  const end = typeof endDateValue.toDate === "function"
    ? endDateValue.toDate()
    : new Date(endDateValue);

  if (Number.isNaN(end.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return Math.ceil((end - today) / 86400000);
}

function subscriptionStatus(endDateValue) {
  const days = daysRemaining(endDateValue);

  if (days === null) {
    return {
      title: "بيانات الاشتراك غير مكتملة",
      text: "أضيفي تاريخ انتهاء الاشتراك من لوحة النادي.",
      className: "subscription-unknown"
    };
  }

  if (days < 0) {
    return {
      title: "الاشتراك منتهي",
      text: `انتهى الاشتراك بتاريخ ${formatArabicDate(endDateValue)}.`,
      className: "subscription-expired"
    };
  }

  if (days <= 7) {
    return {
      title: "الاشتراك قريب من الانتهاء",
      text: `متبقي ${days} ${days === 1 ? "يوم" : "أيام"} على انتهاء الاشتراك.`,
      className: "subscription-warning"
    };
  }

  return {
    title: "اشتراكك نشط ✓",
    text: `متبقي ${days} يومًا على انتهاء الاشتراك.`,
    className: "subscription-active"
  };
}

async function loadMemberProfile() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const db = firebase.firestore();

  try {
    const doc = await db.collection("members").doc(user.uid).get();

    if (!doc.exists) {
      console.warn("Member document not found.");
      return;
    }

    const data = doc.data();

    const name = data.name || user.displayName || "عضوة Blue Agate";
    const email = data.email || user.email || "";
    const phone = data.phone || "غير مضاف";
    const membershipType = data.membershipType || "غير مضاف";
    const startDate = data.startDate;
    const endDate = data.endDate;

    document.getElementById("profile-name").textContent = name;
    document.getElementById("profile-email").textContent = email;
    document.getElementById("profile-phone").textContent = phone;
    document.getElementById("profile-membership").textContent = membershipType;
    document.getElementById("profile-start").textContent = formatArabicDate(startDate);
    document.getElementById("profile-end").textContent = formatArabicDate(endDate);

    const status = subscriptionStatus(endDate);
    const statusBox = document.getElementById("subscription-status");
    const statusTitle = document.getElementById("subscription-status-title");
    const statusText = document.getElementById("subscription-status-text");

    if (statusBox) statusBox.className = `subscription-status ${status.className}`;
    if (statusTitle) statusTitle.textContent = status.title;
    if (statusText) statusText.textContent = status.text;

    const phoneInput = document.getElementById("profile-phone-input");
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
    await firebase.firestore()
      .collection("members")
      .doc(user.uid)
      .update({
        name: name,
        phone: phone
      });

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

  setTimeout(() => {
    box.hidden = true;
  }, 3500);
}

function initMemberProfile() {
  document.getElementById("profile-form")
    ?.addEventListener("submit", saveMemberProfile);

  firebase.auth().onAuthStateChanged(user => {
    const section = document.getElementById("profile-section");
    if (section) section.hidden = !user;

    if (user) loadMemberProfile();
  });
}

document.addEventListener("DOMContentLoaded", initMemberProfile);
