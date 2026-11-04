// Blue Agate - navigation coordination for the member portal.
document.addEventListener("click", function (event) {
  const button = event.target.closest(".portal-nav-btn[data-view]");
  if (!button) return;
  const portal = document.getElementById("member-portal");
  const requestsView = document.getElementById("view-requests");
  if (!portal || !requestsView) return;

  const requestedView = button.getAttribute("data-view");
  if (requestedView === "requests") {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    portal.querySelectorAll(".portal-view").forEach(view => {
      view.hidden = true;
      view.classList.remove("active-view");
    });
    requestsView.hidden = false;
    requestsView.classList.add("active-view");
    portal.querySelectorAll(".portal-nav-btn").forEach(navButton => {
      navButton.classList.toggle("active", navButton === button);
      navButton.setAttribute("aria-current", navButton === button ? "page" : "false");
    });
    requestsView.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  // Do not interfere with app-layout.js; only clear the Requests view and its active state.
  requestsView.hidden = true;
  requestsView.classList.remove("active-view");
}, true);
