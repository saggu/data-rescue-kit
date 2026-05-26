(function () {
  "use strict";

  const config = window.CrmImportRescueConfig || {};
  const storageKey = "crm-import-rescue-analytics";
  let leadFormStarted = false;

  function track(eventName, properties = {}) {
    const event = {
      event: eventName,
      page: window.location.pathname,
      title: document.title,
      ts: new Date().toISOString(),
      ...properties,
    };

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(event);

    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, properties);
    }

    if (typeof window.plausible === "function") {
      window.plausible(eventName, { props: properties });
    }

    if (config.analyticsEndpoint) {
      sendEvent(event);
    } else {
      storeEvent(event);
    }
  }

  function sendEvent(event) {
    const body = JSON.stringify(event);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(config.analyticsEndpoint, blob);
      return;
    }

    fetch(config.analyticsEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      storeEvent(event);
    });
  }

  function storeEvent(event) {
    try {
      const existing = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
      existing.push(event);
      window.localStorage.setItem(storageKey, JSON.stringify(existing.slice(-100)));
    } catch {
      // Analytics should never block the customer-facing flow.
    }
  }

  function clickLabel(target) {
    return (target.getAttribute("data-analytics-label") || target.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  document.addEventListener("DOMContentLoaded", () => {
    track("page_view");
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const target = event.target.closest("[data-analytics]");
    if (!target) {
      return;
    }

    track(target.getAttribute("data-analytics"), {
      label: clickLabel(target),
      href: target.getAttribute("href") || "",
      download: target.hasAttribute("download"),
    });
  });

  document.addEventListener("input", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    if (leadFormStarted || !event.target.closest("#lead-form")) {
      return;
    }

    leadFormStarted = true;
    track("lead_form_start");
  });

  window.CrmAnalytics = {
    track,
    queuedEvents() {
      try {
        return JSON.parse(window.localStorage.getItem(storageKey) || "[]");
      } catch {
        return [];
      }
    },
  };
})();
