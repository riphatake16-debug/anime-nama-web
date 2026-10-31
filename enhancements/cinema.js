/* AnimeNama cinematic enhancement — vanilla, dependency-free, no account/data access. */
(() => {
  "use strict";
  const KEY = "animenama:visual-theme:v1";
  const root = document.documentElement;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const motionSafe = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let currentTheme = "night";
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "day" || saved === "night") currentTheme = saved;
  } catch (_) {}

  function applyTheme(next, persist = true) {
    currentTheme = next === "day" ? "day" : "night";
    root.dataset.anTheme = currentTheme;
    const color = $('meta[name="theme-color"]');
    if (color) color.content = currentTheme === "night" ? "#090e1e" : "#f7e5f1";
    if (persist) {
      try { localStorage.setItem(KEY, currentTheme); } catch (_) {}
    }
    const button = $("#an-theme-button");
    if (button) {
      button.textContent = currentTheme === "night" ? "☀" : "☾";
      button.setAttribute("aria-label", currentTheme === "night" ? "فعال کردن تم روشن" : "فعال کردن تم سینمایی");
      button.title = currentTheme === "night" ? "تم روشن" : "تم سینمایی";
      button.setAttribute("aria-pressed", String(currentTheme === "night"));
    }
  }
  applyTheme(currentTheme, false);

  const icons = {
    search: "⌕", home: "⌂", explore: "✦", calendar: "▦",
    library: "♡", settings: "⚙", news: "◈", random: "✧", top: "↑"
  };
  let palette;
  let input;
  let results;
  let selected = 0;
  let visibleActions = [];

  function nav(label) {
    const buttons = [...document.querySelectorAll(".desktop-nav button")];
    const target = buttons.find(button => button.textContent.trim().startsWith(label));
    const fallback = [...document.querySelectorAll(".mobile-nav button")].find(
      button => button.textContent.trim().startsWith(label)
    );
    (target || fallback)?.click();
  }

  function more(index) {
    const menu = $(".more-menu");
    if (!menu) return;
    const buttons = menu.querySelectorAll(".more-menu-items button");
    if (buttons[index]) {
      buttons[index].click();
      menu.open = false;
    }
  }

  function archiveSearch(value) {
    nav("آرشیو");
    let attempts = 0;
    const find = () => {
      const field = $(".simple-toolbar .search-field input");
      if (!field) {
        if (++attempts < 32) setTimeout(find, 80);
        return;
      }
      field.focus();
      if (!value) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(field, value);
      else field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
    };
    setTimeout(find, 0);
  }

  function surprise() {
    const cards = [...document.querySelectorAll(
      ".home-tile-cover, .anime-card .poster-button, .home-watching-cover"
    )].filter(element => element.getBoundingClientRect().width > 0);
    if (cards.length) cards[Math.floor(Math.random() * cards.length)].click();
    else nav("آرشیو");
  }

  const actions = [
    { name: "خانه", detail: "صفحه اصلی", icon: "home", act: () => nav("خانه") },
    { name: "آرشیو انیمه", detail: "جست‌وجو و کشف انیمه‌ها", icon: "explore", act: () => archiveSearch("") },
    { name: "تقویم پخش", detail: "برنامه پخش به وقت تهران", icon: "calendar", act: () => nav("تقویم") },
    { name: "فهرست من", detail: "انیمه‌های ذخیره‌شده", icon: "library", act: () => nav("فهرست من") },
    { name: "انیمه شانسی", detail: "یکی از انیمه‌های صفحه را ببین", icon: "random", act: surprise },
    { name: "خبرها و اعلان‌ها", detail: "تازه‌ترین خبرهای منبع‌دار", icon: "news", act: () => more(0) },
    { name: "حساب و تنظیمات", detail: "نصب اپ، همگام‌سازی و تنظیمات", icon: "settings", act: () => more(1) },
    { name: "برو به بالای صفحه", detail: "بازگشت به ابتدا", icon: "top", act: goTop }
  ];

  function goTop() {
    window.scrollTo({ top: 0, behavior: motionSafe() ? "smooth" : "instant" });
  }

  function ensurePalette() {
    if (palette) return;
    palette = document.createElement("dialog");
    palette.className = "an-command";
    palette.setAttribute("aria-labelledby", "an-command-title");
    palette.innerHTML = [
      '<div class="an-command-head">',
      '<span class="an-command-symbol" aria-hidden="true">✦</span>',
      '<label id="an-command-title" class="an-sr" for="an-command-query">دسترسی سریع انیمه‌نما</label>',
      '<input id="an-command-query" type="search" placeholder="انیمه پیدا کن یا به بخشی برو…" autocomplete="off" spellcheck="false" />',
      '<button type="button" class="an-command-close" aria-label="بستن">ESC</button>',
      '</div>',
      '<div class="an-command-caption">دسترسی سریع <span>↑ ↓ برای انتخاب • Enter برای اجرا</span></div>',
      '<div class="an-command-results" role="listbox" aria-label="گزینه‌های دسترسی سریع"></div>',
      '<div class="an-command-foot"><span>ANIME NAMA / QUICK ACCESS</span><span>⌘ K / Ctrl K</span></div>'
    ].join("");
    document.body.append(palette);
    input = $("#an-command-query", palette);
    results = $(".an-command-results", palette);
    $(".an-command-close", palette).addEventListener("click", closePalette);
    palette.addEventListener("click", e => { if (e.target === palette) closePalette(); });
    palette.addEventListener("close", () => { input.value = ""; selected = 0; });
    input.addEventListener("input", () => { selected = 0; renderResults(); });
    input.addEventListener("keydown", e => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        selected = (selected + (e.key === "ArrowDown" ? 1 : -1) + visibleActions.length) % Math.max(visibleActions.length, 1);
        updateSelection();
      } else if (e.key === "Enter") {
        e.preventDefault();
        visibleActions[selected]?.act();
        closePalette();
      }
    });
  }

  function normalized(value) {
    return value.toLocaleLowerCase("fa-IR").replace(/ي/g, "ی").replace(/ك/g, "ک").trim();
  }

  function renderResults() {
    const query = normalized(input.value);
    const matches = actions.filter(item => normalized(item.name + " " + item.detail).includes(query));
    visibleActions = query
      ? [{ name: "جست‌وجوی «" + input.value.trim() + "»", detail: "جست‌وجو در آرشیو انیمه‌ها", icon: "search", act: () => archiveSearch(input.value.trim()) }, ...matches]
      : matches;
    results.replaceChildren();
    visibleActions.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "an-command-item";
      button.setAttribute("role", "option");
      const symbol = document.createElement("span");
      symbol.className = "an-command-item-icon";
      symbol.textContent = icons[item.icon];
      const copy = document.createElement("span");
      copy.className = "an-command-item-copy";
      const name = document.createElement("strong");
      name.textContent = item.name;
      const detail = document.createElement("small");
      detail.textContent = item.detail;
      copy.append(name, detail);
      const arrow = document.createElement("span");
      arrow.className = "an-command-item-arrow";
      arrow.textContent = "↖";
      arrow.setAttribute("aria-hidden", "true");
      button.append(symbol, copy, arrow);
      button.addEventListener("mouseenter", () => { selected = index; updateSelection(); });
      button.addEventListener("click", () => { item.act(); closePalette(); });
      results.append(button);
    });
    selected = Math.min(selected, Math.max(0, visibleActions.length - 1));
    updateSelection();
  }

  function updateSelection() {
    [...results.children].forEach((element, index) => {
      const active = index === selected;
      element.classList.toggle("is-selected", active);
      element.setAttribute("aria-selected", String(active));
      if (active) element.scrollIntoView({ block: "nearest" });
    });
  }

  function openPalette() {
    if (document.querySelector("dialog[open]:not(.an-command)")) return;
    ensurePalette();
    renderResults();
    if (!palette.open) {
      if (typeof palette.showModal === "function") palette.showModal();
      else palette.setAttribute("open", "");
    }
    input.focus();
  }

  function closePalette() {
    if (!palette?.open) return;
    if (typeof palette.close === "function") palette.close();
    else palette.removeAttribute("open");
  }

  function makeButton(id, label, symbol, handler) {
    const button = document.createElement("button");
    button.id = id;
    button.className = "an-header-button";
    button.type = "button";
    button.textContent = symbol;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.addEventListener("click", handler);
    return button;
  }

  function mount() {
    const header = $(".simple-header .header-inner");
    if (header && !$("#an-theme-button", header)) {
      const tools = document.createElement("div");
      tools.className = "an-header-tools";
      const search = makeButton("an-search-button", "دسترسی سریع و جست‌وجو", "⌕", openPalette);
      const theme = makeButton("an-theme-button", "تغییر تم", "☀", () => {
        applyTheme(currentTheme === "night" ? "day" : "night");
      });
      tools.append(search, theme);
      const menu = $(".more-menu", header);
      header.insertBefore(tools, menu);
      applyTheme(currentTheme, false);
    }
    const main = $(".simple-page");
    if (main && !main.id) { main.id = "an-main"; main.tabIndex = -1; }
  }

  function addUtilities() {
    const progress = document.createElement("div");
    progress.className = "an-scroll-progress";
    progress.setAttribute("aria-hidden", "true");
    document.body.append(progress);

    const top = makeButton("an-back-to-top", "بازگشت به بالای صفحه", "↑", goTop);
    top.classList.add("an-back-to-top");
    document.body.append(top);

    const skip = document.createElement("a");
    skip.className = "an-skip";
    skip.href = "#an-main";
    skip.textContent = "رفتن به محتوای اصلی";
    skip.addEventListener("click", event => {
      const main = $("#an-main");
      if (main) {
        event.preventDefault();
        main.focus({ preventScroll: true });
        main.scrollIntoView({ behavior: motionSafe() ? "smooth" : "instant" });
      }
    });
    document.body.prepend(skip);

    let scrolling = false;
    const update = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      progress.style.transform = "scaleX(" + Math.min(1, window.scrollY / max) + ")";
      top.classList.toggle("an-visible", window.scrollY > 500);
      scrolling = false;
    };
    window.addEventListener("scroll", () => {
      if (!scrolling) { scrolling = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  window.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      event.stopImmediatePropagation(); // supersedes app's focus-search shortcut
      if (palette?.open) closePalette(); else openPalette();
    } else if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey
      && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)
      && !document.activeElement?.isContentEditable) {
      event.preventDefault();
      openPalette();
    }
  }, true);

  window.addEventListener("storage", event => {
    if (event.key === KEY && (event.newValue === "day" || event.newValue === "night"))
      applyTheme(event.newValue, false);
  });

  const start = () => {
    mount();
    addUtilities();
    let pending = false;
    new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; mount(); });
    }).observe($("#root") || document.body, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
