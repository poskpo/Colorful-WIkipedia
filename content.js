const api = typeof browser !== "undefined" ? browser : chrome;
const STYLE_ID = "wiki-skins-style";

// Selector groups, kept in one place so they're easy to adjust when Wikipedia changes.
const SEL = {
  headings: ".mw-body h1, .mw-body h2, .mw-body h3, .mw-body h4, .mw-body h5, .mw-body h6, .mw-heading, .mw-page-title-main",
  links: ".mw-body a:not(.new), .vector-body a:not(.new)",
  redLinks: ".mw-body a.new, .vector-body a.new",
  header: ".vector-header-container, .vector-sticky-header, .vector-page-toolbar, #mw-head, #mw-head-base",
  sidebar: ".vector-main-menu-container, .vector-main-menu, .vector-toc, #vector-toc-pinned-container, #mw-panel, #toc, .toc",
  footer: ".mw-footer, #footer, .mw-footer-container",
  mono: "code, pre, kbd, samp, tt, .mw-code",
  paragraphs: ".mw-body-content p, .mw-body-content li, .vector-body p, .vector-body li, .vector-body dd",
  images: ".mw-body img, .vector-body img",
  rounded: ".mw-body, table.infobox, .wikitable, .navbox, .thumbinner, .ambox, .tmbox, .ombox, .cmbox, .imbox, .fmbox, .mbox-small, pre, code, .mw-body img.mw-file-element"
};

// Build "selector { decl; decl }" only when there is something to say.
function rule(selector, decls) {
  const body = decls.filter(Boolean).join(" ");
  return body ? `${selector} { ${body} }` : "";
}

const imp = (prop, value) => `${prop}: ${value} !important;`;
const fam = (v) => imp("font-family", v);

function buildCss(s) {
  if (!s.enabled) return "";

  const out = [];
  const on = (v) => v !== "" && v !== undefined;

  // --- Wikipedia's own theme variables (Vector 2022, Vector legacy, Minerva, dark mode) ---
  const vars = [];
  if (on(s.contentBg)) {
    vars.push(`--background-color-base: ${s.contentBg} !important;`);
    vars.push(`--background-color-neutral-subtle: ${s.contentBg} !important;`);
  }
  if (on(s.textColor)) {
    vars.push(`--color-base: ${s.textColor} !important;`);
    vars.push(`--color-emphasized: ${s.textColor} !important;`);
    vars.push(`--color-subtle: ${s.textColor} !important;`);
  }
  if (on(s.linkColor)) {
    vars.push(`--color-progressive: ${s.linkColor} !important;`);
    vars.push(`--color-link: ${s.linkColor} !important;`);
  }
  if (on(s.linkHoverColor)) vars.push(`--color-progressive--hover: ${s.linkHoverColor} !important;`);
  if (on(s.visitedColor)) vars.push(`--color-visited: ${s.visitedColor} !important;`);
  if (on(s.redLinkColor)) {
    vars.push(`--color-link-red: ${s.redLinkColor} !important;`);
    vars.push(`--color-destructive: ${s.redLinkColor} !important;`);
  }
  if (on(s.borderColor)) {
    vars.push(`--border-color-base: ${s.borderColor} !important;`);
    vars.push(`--border-color-subtle: ${s.borderColor} !important;`);
  }
  out.push(rule(":root, :root.skin-theme-clientpref-night, :root.skin-theme-clientpref-os", vars));

  // --- Surfaces that don't use the variables ---
  if (on(s.pageBg)) {
    out.push(rule("html, body, #mw-page-base, #mw-head-base, .mw-page-container",
      [imp("background-color", s.pageBg)]));
  }
  if (on(s.contentBg) || on(s.textColor)) {
    out.push(rule(".mw-body, #content, .vector-body, .mw-body-content", [
      on(s.contentBg) && imp("background-color", s.contentBg),
      on(s.textColor) && imp("color", s.textColor)
    ]));
  }

  // Header: falls back to the page background, as before.
  const headerBg = on(s.headerBg) ? s.headerBg : s.pageBg;
  out.push(rule(SEL.header, [on(headerBg) && imp("background-color", headerBg)]));
  if (on(s.headerText)) {
    out.push(rule(".vector-header-container, .vector-header-container a, .vector-sticky-header, .vector-sticky-header a, .vector-page-toolbar a",
      [imp("color", s.headerText)]));
  }
  if (on(s.sidebarBg)) out.push(rule(SEL.sidebar, [imp("background-color", s.sidebarBg)]));
  if (on(s.footerBg)) out.push(rule(SEL.footer, [imp("background-color", s.footerBg)]));

  // --- Links, headings, borders, selection ---
  if (on(s.linkColor)) out.push(rule(SEL.links, [imp("color", s.linkColor)]));
  if (on(s.visitedColor)) {
    out.push(rule(".mw-body a:not(.new):visited, .vector-body a:not(.new):visited", [imp("color", s.visitedColor)]));
  }
  if (on(s.linkHoverColor)) {
    out.push(rule(".mw-body a:not(.new):hover, .vector-body a:not(.new):hover", [imp("color", s.linkHoverColor)]));
  }
  if (on(s.redLinkColor)) {
    out.push(rule(".mw-body a.new, .vector-body a.new, .mw-body a.new:visited, .vector-body a.new:visited",
      [imp("color", s.redLinkColor)]));
  }
  if (on(s.headingColor)) out.push(rule(SEL.headings, [imp("color", s.headingColor)]));
  if (on(s.borderColor)) {
    out.push(rule(`${SEL.headings}, hr, .wikitable, .wikitable th, .wikitable td, table.infobox, .navbox, .thumbinner`,
      [imp("border-color", s.borderColor)]));
  }
  if (on(s.selectionBg)) out.push(`::selection { background: ${s.selectionBg} !important; }`);

  // --- Boxes & tables ---
  if (on(s.infoboxBg)) out.push(rule("table.infobox, table.infobox td", [imp("background-color", s.infoboxBg)]));
  if (on(s.tableBg)) out.push(rule(".wikitable, .wikitable td", [imp("background-color", s.tableBg)]));
  if (on(s.tableHeaderBg)) out.push(rule(".wikitable th", [imp("background-color", s.tableHeaderBg)]));
  if (on(s.codeBg)) out.push(rule("code, pre, kbd, samp, .mw-code, .mw-highlight", [imp("background-color", s.codeBg)]));
  if (on(s.noticeBg)) {
    out.push(rule(".ambox, .tmbox, .ombox, .cmbox, .imbox, .fmbox, .mbox-small", [imp("background-color", s.noticeBg)]));
  }
  if (on(s.navboxBg)) {
    out.push(rule(".navbox, .navbox-inner, .navbox-subgroup, .navbox-list", [imp("background-color", s.navboxBg)]));
  }

  // --- Typography ---
  if (on(s.fontFamily)) out.push(rule("body, .mw-body, .mw-body-content, .vector-body", [fam(s.fontFamily)]));
  if (on(s.headingFont)) out.push(rule(SEL.headings, [fam(s.headingFont)]));
  if (on(s.monoFont)) out.push(rule(SEL.mono, [fam(s.monoFont)]));
  // Wikipedia sizes most things in rem/em, so scaling the root scales the whole page
  // once (the old per-element percentage compounded on nested containers).
  if (s.fontSize !== 100) out.push(rule("html", [imp("font-size", `${s.fontSize}%`)]));
  if (s.lineHeight !== 1.6) out.push(rule(SEL.paragraphs, [imp("line-height", s.lineHeight)]));
  if (s.letterSpacing !== 0 || s.wordSpacing !== 0) {
    out.push(rule(".mw-body, .vector-body", [
      s.letterSpacing !== 0 && imp("letter-spacing", `${s.letterSpacing}em`),
      s.wordSpacing !== 0 && imp("word-spacing", `${s.wordSpacing}em`)
    ]));
  }
  if (on(s.textAlign)) out.push(rule(SEL.paragraphs, [imp("text-align", s.textAlign)]));

  // --- Layout ---
  if (on(s.maxWidth)) out.push(rule(".mw-page-container", [imp("max-width", s.maxWidth)]));
  if (on(s.contentPadding)) out.push(rule(".mw-body", [imp("padding", s.contentPadding)]));
  if (s.borderRadius > 0) out.push(rule(SEL.rounded, [imp("border-radius", `${s.borderRadius}px`)]));

  // --- Images ---
  const filters = [];
  if (s.imgBrightness !== 100) filters.push(`brightness(${s.imgBrightness}%)`);
  if (s.imgContrast !== 100) filters.push(`contrast(${s.imgContrast}%)`);
  if (s.imgGrayscale > 0) filters.push(`grayscale(${s.imgGrayscale}%)`);
  if (filters.length) out.push(rule(SEL.images, [imp("filter", filters.join(" "))]));
  if (s.dimImages) {
    out.push(rule(SEL.images, [imp("opacity", "0.55"), "transition: opacity 0.15s;"]));
    out.push(rule(SEL.images.split(", ").map((x) => x + ":hover").join(", "), [imp("opacity", "1")]));
  }

  // --- Hide elements ---
  const hide = [];
  if (s.hideBanners) hide.push("#siteNotice, #centralNotice, .centralnotice, #frbanner, .cn-fundraising");
  if (s.hideSidebar) hide.push(".vector-main-menu-container, #mw-panel");
  if (s.hideToc) hide.push("#vector-toc-pinned-container, .vector-toc, #toc, .toc, #vector-page-titlebar-toc");
  if (s.hideFooter) hide.push(SEL.footer);
  if (s.hideEditLinks) hide.push(".mw-editsection");
  if (s.hideRefNumbers) hide.push("sup.reference");
  if (s.hideNavboxes) hide.push(".navbox");
  if (s.hideStickyHeader) hide.push(".vector-sticky-header");
  if (hide.length) out.push(`${hide.join(", ")} { display: none !important; }`);

  return out.filter(Boolean).join("\n");
}

function applySettings(settings) {
  const s = sanitizeSettings(settings, DEFAULT_SETTINGS);
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    // Append to <html> so it still works at document_start, before <head> exists.
    document.documentElement.appendChild(style);
  }
  style.textContent = buildCss(s);
}

// Apply saved settings as early as possible (avoids a flash of the default theme).
api.storage.local.get(SETTINGS_KEY).then((res) => applySettings(res[SETTINGS_KEY]));

// Live updates: fires in every open Wikipedia tab whenever the popup saves.
api.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[SETTINGS_KEY]) {
    applySettings(changes[SETTINGS_KEY].newValue);
  }
});

if (typeof module !== "undefined" && module.exports) module.exports = { buildCss };
