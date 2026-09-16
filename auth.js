// Blue Agate - Firebase Authentication
// يعتمد على Firebase compat SDK المحمّل من index.html

let blueAgateUser = null;

function showAuthMessage(message, type = "info") {
  const box = document.getElementById("auth-message");
  if (!box) return;
  box.textContent = message;
  box.className = "auth-message " + type;
  box.hidden = false;
}

function hideAuthMessage() {
  const box = document.getElementById("auth-message");
  if (box) box.hidden = true;
}

function setAuthView(view) {
  const login = document.getElementById("login-view");
  const register = document.getElementById("register-view");
  if (!login || !register) return;

  login.hidden = view !== "login";
  register.hidden = view !== "register";
  hideAuthMessage();
}

async function loginMember(event) {
  event.preventDefault();
  hideAuthMessage();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  if (!email || !password) {
    showAuthMessage("اكتبي البريد الإلكتروني وكلمة المرور.", "error");
    return;
  }

  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
    showAuthMessage("تم تسجيل الدخول بنجاح.", "success");
  } catch (error) {
    let message = "تعذر تسجيل الدخول. تأكدي من البيانات.";
    if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
      message = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    } else if (error.code === "auth/user-not-found") {
      message = "لا يوجد حساب بهذا البريد.";
    } else if (error.code === "auth/too-many-requests") {
      message = "تمت محاولات كثيرة. حاولي مرة أخرى لاحقًا.";
    }
    showAuthMessage(message, "error");
  }
}

async function registerMember(event) {
  event.preventDefault();
  hideAuthMessage();

  const name = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;

  if (!name || !email || !password) {
    showAuthMessage("أكملي جميع البيانات.", "error");
    return;
  }

  if (password.length < 6) {
    showAuthMessage("كلمة المرور يجب أن تكون 6 أحرف على الأقل.", "error");
    return;
  }

  try {
    const result = await firebase.auth().createUserWithEmailAndPassword(email, password);

    await firebase.firestore()
      .collection("members")
      .doc(result.user.uid)
      .set({
        name: name,
        email: email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    showAuthMessage("تم إنشاء حسابك بنجاح.", "success");
  } catch (error) {
    let message = "تعذر إنشاء الحساب.";
    if (error.code === "auth/email-already-in-use") {
      message = "هذا البريد مستخدم مسبقًا.";
    } else if (error.code === "auth/invalid-email") {
      message = "البريد الإلكتروني غير صحيح.";
    } else if (error.code === "auth/weak-password") {
      message = "كلمة المرور ضعيفة. اختاري كلمة أقوى.";
    }
    showAuthMessage(message, "error");
  }
}

async function logoutMember() {
  await firebase.auth().signOut();
}

function updateAuthUI(user) {
  const authSection = document.getElementById("auth-section");
  const portalSection = document.getElementById("member-portal");
  const guestHero = document.getElementById("guest-hero");

  if (!authSection || !portalSection) return;

  if (user) {
    authSection.hidden = true;
    portalSection.hidden = false;
    if (guestHero) guestHero.hidden = true;

    const emailEl = document.getElementById("member-email");
    if (emailEl) emailEl.textContent = user.email || "";

    const nameEl = document.getElementById("member-name");
    if (nameEl) nameEl.textContent = "أهلًا بكِ في Blue Agate 💙";
  } else {
    authSection.hidden = false;
    portalSection.hidden = true;
    if (guestHero) guestHero.hidden = false;
  }
}

function initFirebaseAuth() {
  if (typeof firebase === "undefined") {
    showAuthMessage("تعذر تحميل Firebase. تأكدي من اتصال الإنترنت.", "error");
    return;
  }

  firebase.initializeApp(firebaseConfig);

  firebase.auth().onAuthStateChanged((user) => {
    blueAgateUser = user;
    updateAuthUI(user);
  });

  document.getElementById("login-form")?.addEventListener("submit", loginMember);
  document.getElementById("register-form")?.addEventListener("submit", registerMember);

  document.getElementById("show-register")?.addEventListener("click", () => setAuthView("register"));
  document.getElementById("show-login")?.addEventListener("click", () => setAuthView("login"));
  document.getElementById("logout-btn")?.addEventListener("click", logoutMember);
}

document.addEventListener("DOMContentLoaded", initFirebaseAuth);
