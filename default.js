// Shared by the popup and the content script.
// SCHEMA is the single source of truth: the popup builds its controls from it,
// content.js reads the same keys, and imported theme files are validated against it.

const SETTINGS_KEY = "settings";
const SAVED_THEMES_KEY = "savedThemes";
const THEME_FORMAT_VERSION = 1;
const MAX_THEME_FILE_CHARS = 100000;

const FONT_SUGGESTIONS = [
  "Georgia", "Times New Roman", "Palatino Linotype", "Garamond", "Merriweather",
  "Arial", "Helvetica", "Verdana", "Tahoma", "Trebuchet MS", "Segoe UI", "Roboto",
  "Inter", "Open Sans", "Lato", "system-ui", "sans-serif", "serif",
  "Courier New", "Consolas", "Fira Code", "JetBrains Mono", "monospace"
];

const WIDTH_OPTIONS = [
  ["", "Default"], ["700px", "700 px"], ["900px", "900 px"], ["1100px", "1100 px"],
  ["1300px", "1300 px"], ["1500px", "1500 px"], ["none", "Full width"]
];

const PADDING_OPTIONS = [
  ["", "Default"], ["0px", "None"], ["8px", "8 px"], ["16px", "16 px"],
  ["24px", "24 px"], ["32px", "32 px"], ["48px", "48 px"]
];

const ALIGN_OPTIONS = [["", "Default"], ["left", "Left"], ["justify", "Justified"]];

// type: color | font | range | select | toggle
// color/font/select blank value is "", toggle is false, range uses `neutral`
// (the value that means "leave Wikipedia alone"). `def` is the extension's out-of-the-box look.
const SCHEMA = [
  {
    id: "colors-main", title: "Main colors", fields: [
      { key: "pageBg", type: "color", label: "Page background", def: "#fdf6e3" },
      { key: "contentBg", type: "color", label: "Article background", def: "#fffaf0" },
      { key: "textColor", type: "color", label: "Text", def: "#586e75" },
      { key: "linkColor", type: "color", label: "Links", def: "#b58900" },
      { key: "visitedColor", type: "color", label: "Visited links" },
      { key: "linkHoverColor", type: "color", label: "Link hover" },
      { key: "redLinkColor", type: "color", label: "Red links (missing pages)" },
      { key: "headingColor", type: "color", label: "Headings" },
      { key: "borderColor", type: "color", label: "Borders & dividers" },
      { key: "selectionBg", type: "color", label: "Text selection" }
    ]
  },
  {
    id: "colors-chrome", title: "Header, sidebar & footer", fields: [
      { key: "headerBg", type: "color", label: "Header background" },
      { key: "headerText", type: "color", label: "Header text & links" },
      { key: "sidebarBg", type: "color", label: "Sidebar & contents" },
      { key: "footerBg", type: "color", label: "Footer background" }
    ]
  },
  {
    id: "colors-boxes", title: "Boxes & tables", fields: [
      { key: "infoboxBg", type: "color", label: "Infobox" },
      { key: "tableBg", type: "color", label: "Table cells" },
      { key: "tableHeaderBg", type: "color", label: "Table headers" },
      { key: "codeBg", type: "color", label: "Code blocks" },
      { key: "noticeBg", type: "color", label: "Notice boxes" },
      { key: "navboxBg", type: "color", label: "Navigation boxes" }
    ]
  },
  {
    id: "typography", title: "Typography", fields: [
      { key: "fontFamily", type: "font", label: "Body font" },
      { key: "headingFont", type: "font", label: "Heading font" },
      { key: "monoFont", type: "font", label: "Code font" },
      { key: "fontSize", type: "range", label: "Text size (whole page)", min: 70, max: 160, step: 5, neutral: 100, unit: "%" },
      { key: "lineHeight", type: "range", label: "Line height", min: 1.2, max: 2.2, step: 0.1, neutral: 1.6, unit: "" },
      { key: "letterSpacing", type: "range", label: "Letter spacing", min: -0.02, max: 0.1, step: 0.005, neutral: 0, unit: "em" },
      { key: "wordSpacing", type: "range", label: "Word spacing", min: 0, max: 0.5, step: 0.05, neutral: 0, unit: "em" },
      { key: "textAlign", type: "select", label: "Paragraph alignment", options: ALIGN_OPTIONS }
    ]
  },
  {
    id: "layout", title: "Layout", fields: [
      { key: "maxWidth", type: "select", label: "Page max width", options: WIDTH_OPTIONS },
      { key: "contentPadding", type: "select", label: "Article padding", options: PADDING_OPTIONS },
      { key: "borderRadius", type: "range", label: "Rounded corners", min: 0, max: 24, step: 1, neutral: 0, unit: "px" }
    ]
  },
  {
    id: "images", title: "Images", fields: [
      { key: "imgBrightness", type: "range", label: "Brightness", min: 50, max: 150, step: 5, neutral: 100, unit: "%" },
      { key: "imgContrast", type: "range", label: "Contrast", min: 50, max: 150, step: 5, neutral: 100, unit: "%" },
      { key: "imgGrayscale", type: "range", label: "Grayscale", min: 0, max: 100, step: 5, neutral: 0, unit: "%" },
      { key: "dimImages", type: "toggle", label: "Dim images until hover" }
    ]
  },
  {
    id: "hide", title: "Hide elements", fields: [
      { key: "hideBanners", type: "toggle", label: "Donation & site banners" },
      { key: "hideSidebar", type: "toggle", label: "Main menu sidebar" },
      { key: "hideToc", type: "toggle", label: "Table of contents" },
      { key: "hideFooter", type: "toggle", label: "Footer" },
      { key: "hideEditLinks", type: "toggle", label: "[edit] links" },
      { key: "hideRefNumbers", type: "toggle", label: "Reference numbers [1]" },
      { key: "hideNavboxes", type: "toggle", label: "Navigation boxes" },
      { key: "hideStickyHeader", type: "toggle", label: "Sticky header" }
    ]
  }
];

const ALL_FIELDS = SCHEMA.flatMap((g) => g.fields);

function blankFor(f) {
  if (f.type === "range") return f.neutral;
  if (f.type === "toggle") return false;
  return "";
}

// "Blank" = change nothing on Wikipedia. Themes are applied on top of this,
// so a theme only changes what it explicitly lists.
const BLANK_SETTINGS = { enabled: true };
const DEFAULT_SETTINGS = { enabled: true };
ALL_FIELDS.forEach((f) => {
  BLANK_SETTINGS[f.key] = blankFor(f);
  DEFAULT_SETTINGS[f.key] = f.def !== undefined ? f.def : blankFor(f);
});

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
// Only characters that can't break out of a CSS declaration (no ; { } / : ( ) etc.)
const FONT_RE = /^[A-Za-z0-9 ,'"._-]{0,120}$/;

function normalizeHex(v) {
  const s = String(v).trim().toLowerCase();
  if (!HEX_RE.test(s)) return null;
  if (s.length === 4) return "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  return s;
}

function cleanValue(f, v) {
  switch (f.type) {
    case "color": {
      if (v === "" || v === null) return "";
      return typeof v === "string" ? normalizeHex(v) : null;
    }
    case "font":
      return typeof v === "string" && FONT_RE.test(v.trim()) ? v.trim() : null;
    case "range": {
      const n = Number(v);
      if (typeof v === "boolean" || v === null || v === "" || !Number.isFinite(n)) return null;
      return Math.min(f.max, Math.max(f.min, n));
    }
    case "select":
      return f.options.some(([val]) => val === v) ? v : null;
    case "toggle":
      return typeof v === "boolean" ? v : null;
  }
  return null;
}

// Returns a settings object containing every known key with a valid value.
// Unknown keys are dropped; invalid values fall back to `base`.
function sanitizeSettings(src, base = BLANK_SETTINGS) {
  const out = { ...base };
  if (!src || typeof src !== "object") return out;
  const has = (k) => Object.prototype.hasOwnProperty.call(src, k);
  if (has("enabled") && typeof src.enabled === "boolean") out.enabled = src.enabled;
  ALL_FIELDS.forEach((f) => {
    if (!has(f.key)) return;
    const v = cleanValue(f, src[f.key]);
    if (v !== null) out[f.key] = v;
  });
  return out;
}

// Parse a theme file's text. Accepts
//   { "name": "...", "author": "...", "version": 1, "settings": { ... } }
// or a bare settings object. Throws Error with a readable message.
function parseThemeFile(text) {
  if (typeof text !== "string" || !text.trim()) throw new Error("The file is empty.");
  if (text.length > MAX_THEME_FILE_CHARS) throw new Error("File is too large to be a theme.");
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error("Not valid JSON: " + e.message);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("A theme must be a JSON object.");
  }
  const body = data.settings && typeof data.settings === "object" && !Array.isArray(data.settings)
    ? data.settings : data;
  const known = new Set(ALL_FIELDS.map((f) => f.key));
  const keys = Object.keys(body).filter((k) => k !== "enabled");
  const recognized = keys.filter((k) => known.has(k));
  if (recognized.length === 0) throw new Error("No recognized theme settings were found.");

  const settings = sanitizeSettings(body);
  let invalid = 0;
  recognized.forEach((k) => {
    const f = ALL_FIELDS.find((x) => x.key === k);
    if (cleanValue(f, body[k]) === null) invalid++;
  });
  const name = typeof data.name === "string" && data.name.trim()
    ? data.name.trim().slice(0, 60) : "Imported theme";
  const author = typeof data.author === "string" ? data.author.trim().slice(0, 60) : "";
  settings.enabled = true;
  return { name, author, settings, ignored: keys.length - recognized.length, invalid };
}

// Build the JSON object written when exporting (no `enabled`, since that's a user switch).
function themeToFile(name, author, settings) {
  const s = sanitizeSettings(settings);
  delete s.enabled;
  const file = { name: String(name).slice(0, 60), version: THEME_FORMAT_VERSION };
  if (author) file.author = author;
  file.settings = s;
  return file;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SETTINGS_KEY, SAVED_THEMES_KEY, SCHEMA, ALL_FIELDS, DEFAULT_SETTINGS, BLANK_SETTINGS,
    sanitizeSettings, parseThemeFile, themeToFile, normalizeHex, FONT_SUGGESTIONS
  };
}
