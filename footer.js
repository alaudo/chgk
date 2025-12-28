// footer.js - responsive/collapsible footer (auto-collapses on small widths)

(function () {
  const SMALL_WIDTH_QUERY = "(max-width: 520px)";

  function setExpanded(footerEl, expanded) {
    footerEl.classList.toggle("footer-expanded", expanded);
    const btn = footerEl.querySelector("[data-footer-toggle]");
    if (btn) {
      btn.setAttribute("aria-expanded", expanded ? "true" : "false");
      btn.textContent = expanded ? "Скрыть" : "Подробнее";
    }
  }

  function initFooter(footerEl) {
    const btn = footerEl.querySelector("[data-footer-toggle]");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const next = !footerEl.classList.contains("footer-expanded");
      setExpanded(footerEl, next);
    });

    const mql = window.matchMedia(SMALL_WIDTH_QUERY);

    // Collapse when switching to small width.
    const handleChange = () => {
      if (mql.matches) {
        setExpanded(footerEl, false);
      }
    };

    // Initial state.
    handleChange();

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handleChange);
    } else if (typeof mql.addListener === "function") {
      // Safari fallback
      mql.addListener(handleChange);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("footer.footer").forEach(initFooter);
  });
})();
