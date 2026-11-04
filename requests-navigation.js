// Blue Agate - Navigation coordination for member portal.
// Keep the Requests view from remaining visible when another portal tab opens.
document.addEventListener("click", function (event) {
  const button = event.target.closest(".portal-nav-btn[data-view]");
  if (!button) return;

  const portal = document.getElementById("member-portal");
  const requestsView = document.getElementById("view-requests");
  if (!portal || !requestsView) return;

  const requestedView = button.getAttribute("data-view");

  // Requests has its own view, so handle it here.
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
      navButton.setAttribute(
        "aria-current",
        navButton === button ? "page" : "false"
      );
    });

    requestsView.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  // For every other tab, hide Requests first, then let app-layout.js
  // continue its normal navigation handling.
  requestsView.hidden = true;
  requestsView.classList.remove("active-view");
}, true);
