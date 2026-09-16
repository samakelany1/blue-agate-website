// Blue Agate - Portal Layout
// يحوّل البوابة إلى واجهة صفحات داخلية بدل عرض كل الأقسام تحت بعض.

function portalView(name) {
  const views = {
    home: document.getElementById("view-home"),
    attendance: document.getElementById("view-attendance"),
    profile: document.getElementById("view-profile"),
    content: document.getElementById("content")
  };

  Object.entries(views).forEach(([key, el]) => {
    if (el) el.hidden = key !== name;
  });

  document.querySelectorAll(".portal-nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === name || (name === "content" && btn.dataset.view === "classes"));
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function portalHome() {
  const content = document.getElementById("content");
  if (content) {
    content.hidden = true;
    content.innerHTML = "";
  }
  portalView("home");
}

function portalClasses() {
  if (typeof schedulePage === "function") {
    schedulePage();
    portalView("content");
  }
}

// نستبدل العودة للرئيسية الموجودة داخل الصفحات الديناميكية.
window.backHome = portalHome;

function initPortalLayout() {
  document.querySelectorAll(".portal-nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      if (view === "home") portalHome();
      if (view === "classes") portalClasses();
      if (view === "attendance") portalView("attendance");
      if (view === "profile") portalView("profile");
    });
  });

  // أي قسم من بطاقات الرئيسية يفتح داخل مساحة واحدة فقط.
  document.querySelectorAll("#view-home [data-page]").forEach(card => {
    card.addEventListener("click", () => {
      if (card.dataset.page !== "equipment") portalView("content");
    });
  });

  // إذا فتح script.js المحتوى مباشرة من أي مكان، نظهر صفحة المحتوى.
  const content = document.getElementById("content");
  if (content) {
    const observer = new MutationObserver(() => {
      if (!content.hidden && content.innerHTML.trim()) portalView("content");
    });
    observer.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  }

  portalHome();
}

document.addEventListener("DOMContentLoaded", initPortalLayout);
