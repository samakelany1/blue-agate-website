// Blue Agate - navigation fix for the member Requests view
// Loaded after app-layout.js so the Requests tab always opens its own view.
document.addEventListener("click", function (event) {
  const button = event.target.closest('.portal-nav-btn[data-view="requests"]');
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const portal = document.getElementById("member-portal");
  const target = document.getElementById("view-requests");
  if (!portal || !target) {
    console.error("Blue Agate: missing #member-portal or #view-requests.");
    return;
  }

  portal.querySelectorAll(".portal-view").forEach(view => {
    view.hidden = true;
    view.classList.remove("active-view");
  });

  target.hidden = false;
  target.classList.add("active-view");

  portal.querySelectorAll(".portal-nav-btn").forEach(navButton => {
    navButton.classList.toggle("active", navButton === button);
    navButton.setAttribute("aria-current", navButton === button ? "page" : "false");
  });

  target.scrollIntoView({ behavior: "smooth", block: "start" });
}, true);
