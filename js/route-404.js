(function () {
  "use strict";

  var pagePath = location.pathname;
  var marker = "/p/";
  var routeIndex = pagePath.indexOf(marker);
  if (routeIndex !== -1) {
    var rawSlug = pagePath.slice(routeIndex + marker.length).replace(/\/+$/, "");
    var slug = "";
    try { slug = decodeURIComponent(rawSlug); } catch (_) { /* Show the friendly not-found state. */ }
    if (/^[A-Za-z0-9_-]{1,200}$/.test(slug)) {
      var appBase = pagePath.slice(0, routeIndex);
      location.replace(appBase + "/customer/?c=" + encodeURIComponent(slug));
      return;
    }
  }

  var base = document.currentScript && document.currentScript.dataset.base || "";
  var title = document.getElementById("title");
  var message = document.getElementById("message");
  var loading = document.getElementById("loading");
  var home = document.getElementById("home");
  if (title) title.textContent = "We couldn't find that page";
  if (message) message.textContent = "Check the link or ask your SalesDesk representative for a new customer portal link.";
  if (loading) loading.hidden = true;
  if (home) {
    home.href = base + "/";
    home.hidden = false;
  }
})();
