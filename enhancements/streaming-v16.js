/* AnimeNama Midnight Cinema: DOM enhancement for the deployed React build.
 * Uses existing anime cards and existing click handlers. No API, account or storage access.
 */
(() => {
  "use strict";
  const root = document.getElementById("root");
  if (!root) return;
  const create = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  function buildFeatured(dashboard) {
    const section = create("section", "an-featured");
    section.setAttribute("aria-label", "انیمه منتخب در حال پخش");
    const art = create("div", "an-featured-art");
    const shade = create("div", "an-featured-shade");
    shade.setAttribute("aria-hidden", "true");
    const copy = create("div", "an-featured-copy");
    const label = create("span", "an-featured-label", "منتخب این فصل");
    const title = create("h2", "", "انیمه‌های این فصل");
    title.dir = "auto";
    const info = create("div", "an-featured-info");
    const description = create("p", "", "انیمه‌های در حال پخش را کشف کن و فصل‌های بعدی را دنبال کن.");
    const action = create("button", "an-featured-action", "مشاهده جزئیات");
    action.type = "button";
    action.addEventListener("click", () => {
      const tile = dashboard.querySelector(".home-anime-grid .home-anime-tile");
      const button = tile?.querySelector(".home-tile-cover, .home-tile-title");
      if (button) button.click();
    });
    copy.append(label, title, info, description, action);
    section.append(art, shade, copy);
    const heading = dashboard.querySelector(".home-page-title");
    if (heading) heading.insertAdjacentElement("afterend", section);
    else dashboard.prepend(section);
    return section;
  }
  function updateFeatured() {
    const dashboard = root.querySelector(".home-dashboard");
    if (!dashboard) return;
    let section = dashboard.querySelector(".an-featured");
    if (!section) section = buildFeatured(dashboard);
    const tile = dashboard.querySelector(".home-anime-grid .home-anime-tile");
    const title = tile?.querySelector(".home-tile-title")?.textContent?.trim();
    const nextTitle = title || "انیمه‌های این فصل";
    const heading = section.querySelector("h2");
    if (heading.textContent !== nextTitle) heading.textContent = nextTitle;
    const image = tile?.querySelector(".home-tile-cover img");
    const url = image?.currentSrc || image?.getAttribute("src") || "";
    const art = section.querySelector(".an-featured-art");
    const existing = art.querySelector("img");
    if (url && (!existing || existing.getAttribute("src") !== url)) {
      const nextImage = create("img");
      nextImage.src = url;
      nextImage.alt = "";
      nextImage.decoding = "async";
      nextImage.loading = "eager";
      nextImage.referrerPolicy = "no-referrer";
      nextImage.addEventListener("error", () => {
        if (nextImage.parentNode === art) nextImage.remove();
      }, {once:true});
      art.replaceChildren(nextImage);
    } else if (!url && existing) {
      art.replaceChildren();
    }
    const info = section.querySelector(".an-featured-info");
    const status = tile?.querySelector(".home-tile-meta > span:first-child")?.textContent?.trim();
    const nextInfo = status ? "در حال پخش · " + status : "آرشیو و تقویم پخش";
    if (info.textContent !== nextInfo) info.textContent = nextInfo;
    const action = section.querySelector(".an-featured-action");
    action.disabled = !tile;
    action.setAttribute("aria-label", title ? "جزئیات " + title : "جزئیات انیمه");
    section.classList.toggle("an-featured-loading", !tile);
  }
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      updateFeatured();
    });
  }
  // MutationObserver is limited to React's content and updates are frame-throttled.
  // Unlike polling, it sleeps when the interface is idle.
  new MutationObserver(changes => {
    if (changes.some(change =>
      !(change.target instanceof Element) || !change.target.closest(".an-featured")
    )) schedule();
  }).observe(root, {childList:true,subtree:true});
  root.addEventListener("load", event => {
    if (event.target instanceof HTMLImageElement &&
        event.target.closest(".home-anime-grid")) schedule();
  }, true);
  schedule();
})();