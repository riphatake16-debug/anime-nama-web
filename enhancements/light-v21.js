/* AnimeNama lightweight enhancements: no dependencies and no API calls. */
(() => {
  "use strict";
  const key = "animenama:visual-theme:v1";
  const root = document.documentElement;
  const shouldReduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches || root.dataset.motion === "reduced";
  let theme = "night";
  try {
    const saved = localStorage.getItem(key);
    if (saved === "night" || saved === "day") theme = saved;
  } catch (_) {}

  function applyTheme(value, save = false) {
    theme = value === "night" ? "night" : "day";
    root.dataset.anTheme = theme;
    const color = document.querySelector('meta[name="theme-color"]');
    if (color) color.content = theme === "night" ? "#0b0b0e" : "#f7e5f1";
    const toggle = document.getElementById("an-theme-button");
    if (toggle) {
      const label = theme === "night" ? "رفتن به تم روشن" : "فعال کردن تم تاریک";
      toggle.textContent = theme === "night" ? "☀" : "☾";
      toggle.title = label;
      toggle.setAttribute("aria-label", label);
      toggle.setAttribute("aria-pressed", String(theme === "night"));
    }
    if (save) try { localStorage.setItem(key, theme); } catch (_) {}
  }
  applyTheme(theme);

  function focusArchive() {
    const buttons = [...document.querySelectorAll(".desktop-nav button, .simple-mobile-nav button, .mobile-nav button")];
    buttons.find(el => el.textContent.trim().startsWith("آرشیو"))?.click();
    let attempts = 0;
    function focus() {
      const search = document.querySelector(".simple-toolbar .search-field input");
      if (search) {
        search.focus();
        search.scrollIntoView({ block: "nearest", behavior: shouldReduceMotion() ? "instant" : "smooth" });
      } else if (++attempts < 18) setTimeout(focus, 80);
    }
    focus();
  }

  function makeButton(id, label, symbol, action) {
    const button = document.createElement("button");
    button.id = id;
    button.type = "button";
    button.className = "an-header-button";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.textContent = symbol;
    button.addEventListener("click", action);
    return button;
  }

  function mount() {
    const header = document.querySelector(".simple-header .header-inner");
    if (!header || document.getElementById("an-theme-button")) return false;
    const tools = document.createElement("div");
    tools.className = "an-header-tools";
    tools.append(
      makeButton("an-search-button", "جست‌وجوی انیمه", "⌕", focusArchive),
      makeButton("an-theme-button", "تغییر تم", "☾", () => applyTheme(theme === "night" ? "day" : "night", true))
    );
    header.insertBefore(tools, header.querySelector(".more-menu"));
    applyTheme(theme);
    return true;
  }

  function start() {
    const main = document.querySelector("main.page-container");
    if (main) {
      main.id = "an-main";
      main.tabIndex = -1;
    }
    const skip = document.createElement("a");
    skip.className = "an-skip-link";
    skip.href = "#an-main";
    skip.textContent = "رفتن به محتوای اصلی";
    skip.addEventListener("click", event => {
      const target = document.getElementById("an-main");
      if (!target) return;
      event.preventDefault();
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "start", behavior: shouldReduceMotion() ? "instant" : "smooth" });
    });
    document.body.prepend(skip);

    if (!mount()) {
      const observer = new MutationObserver(() => {
        if (mount()) observer.disconnect();
      });
      observer.observe(document.getElementById("root") || document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 10000);
    }

    const top = makeButton("an-back-to-top", "بازگشت به بالای صفحه", "↑", () =>
      window.scrollTo({ top: 0, behavior: shouldReduceMotion() ? "instant" : "smooth" })
    );
    top.classList.add("an-back-to-top");
    document.body.append(top);

    let queued = false;
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        top.classList.toggle("an-visible", window.scrollY > 600);
        queued = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  window.addEventListener("storage", event => {
    if (event.key === key && (event.newValue === "day" || event.newValue === "night"))
      applyTheme(event.newValue);
  });
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
