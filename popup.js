const api = typeof browser !== "undefined" ? browser : chrome;
const el = (id) => document.getElementById(id);

// default.js declares these with const (global bindings, not window properties).
// SCHEMA, DEFAULT_SETTINGS, sanitizeSettings, parseThemeFile, themeToFile, ... come from there.

const IS_TAB = new URLSearchParams(location.search).get("view") === "tab";
if (IS_TAB) document.body.classList.add("tab");

const MAX_SAVED_THEMES = 50;
const SWATCHES = [
  "#ffffff", "#fdf6e3", "#fffaf0", "#f5f5f5", "#eef1f6", "#f9f0ff", "#fff0f5", "#f0fff4",
  "#b58900", "#586e75", "#222222", "#111111", "#000000", "#334e68", "#0066cc", "#cc0000",
  "#2e3440", "#282a36", "#073642", "#88c0d0"
];

let current = { ...DEFAULT_SETTINGS };
let savedThemes = []; // [{ id, name, author, settings }]
let presets = [];     // [{ id, name, settings }]
let loading = false;  // true while we push values into the form, so we don't re-save them
let saveTimer = null;
const controls = {};  // settings key -> { set(value) }

/* ---------- saving ---------- */

function save() {
  clearTimeout(saveTimer);
  saveTimer = null;
  api.storage.local.set({ [SETTINGS_KEY]: current });
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 40);
}

// The popup can close at any moment; don't lose a pending change.
window.addEventListener("pagehide", () => { if (saveTimer) save(); });

function update(key, value, { debounce = false } = {}) {
  if (loading) return;
  current[key] = value;
  if (debounce) scheduleSave(); else save();
  markActiveThemes();
}

/* ---------- building the controls from SCHEMA ---------- */

function fmtRange(f, v) {
  if (v === f.neutral) return "default";
  return `${Number(v.toFixed(3))}${f.unit || ""}`;
}

function buildField(f) {
  const id = "f_" + f.key;
  const row = document.createElement("div");
  row.className = "field" + (f.type === "toggle" ? " toggle" : "");

  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = f.label;
  row.appendChild(label);

  const ctl = document.createElement("div");
  ctl.className = "ctl";
  row.appendChild(ctl);

  if (f.type === "color") {
    const input = document.createElement("input");
    input.type = "text";
    input.id = id;
    input.className = "coloris";
    input.placeholder = "Wikipedia default";
    input.maxLength = 7;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.addEventListener("input", () => {
      if (loading) return;
      const v = input.value.trim();
      if (v === "") { input.classList.remove("invalid"); update(f.key, ""); return; }
      const hex = normalizeHex(v);
      if (!hex) { input.classList.add("invalid"); return; } // half-typed value: wait
      input.classList.remove("invalid");
      update(f.key, hex);
    });
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "ghost clear-btn";
    clear.textContent = "×";
    clear.title = "Use Wikipedia's color";
    clear.addEventListener("click", () => {
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true })); // refreshes Coloris' swatch + saves
    });
    ctl.append(input, clear);
    controls[f.key] = {
      set(v) {
        input.value = v;
        input.classList.remove("invalid");
        input.dispatchEvent(new Event("input", { bubbles: true })); // Coloris listens for this
      }
    };
  } else if (f.type === "font") {
    const input = document.createElement("input");
    input.type = "text";
    input.id = id;
    input.setAttribute("list", "fontList");
    input.placeholder = "Wikipedia default";
    input.maxLength = 120;
    input.spellcheck = false;
    input.addEventListener("input", () => {
      if (loading) return;
      const v = input.value.trim();
      if (!FONT_RE.test(v)) { input.classList.add("invalid"); return; }
      input.classList.remove("invalid");
      update(f.key, v, { debounce: true });
    });
    ctl.appendChild(input);
    controls[f.key] = { set(v) { input.value = v; input.classList.remove("invalid"); } };
  } else if (f.type === "range") {
    const input = document.createElement("input");
    input.type = "range";
    input.id = id;
    input.min = f.min; input.max = f.max; input.step = f.step; input.value = f.neutral;
    const out = document.createElement("output");
    out.htmlFor = id;
    out.textContent = fmtRange(f, f.neutral);
    input.addEventListener("input", () => {
      const v = Number(input.value);
      out.textContent = fmtRange(f, v);
      update(f.key, v, { debounce: true });
    });
    ctl.append(input, out);
    controls[f.key] = {
      set(v) { input.value = v; out.textContent = fmtRange(f, Number(v)); }
    };
  } else if (f.type === "select") {
    const sel = document.createElement("select");
    sel.id = id;
    f.options.forEach(([value, text]) => {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = text;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => update(f.key, sel.value));
    ctl.appendChild(sel);
    controls[f.key] = { set(v) { sel.value = v; } };
  } else if (f.type === "toggle") {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.id = id;
    box.addEventListener("change", () => update(f.key, box.checked));
    ctl.appendChild(box);
    controls[f.key] = { set(v) { box.checked = !!v; } };
  }
  return row;
}

function buildSections() {
  const host = el("sections");
  SCHEMA.forEach((group) => {
    const sec = document.createElement("details");
    sec.className = "sec";
    const sum = document.createElement("summary");
    sum.textContent = group.title;
    const body = document.createElement("div");
    body.className = "body";
    group.fields.forEach((f) => body.appendChild(buildField(f)));
    sec.append(sum, body);
    host.appendChild(sec);
  });
}

function applyToForm() {
  loading = true;
  el("enabled").checked = current.enabled;
  ALL_FIELDS.forEach((f) => controls[f.key] && controls[f.key].set(current[f.key]));
  loading = false;
  markActiveThemes();
}

function setCurrent(settings, persist = true) {
  current = sanitizeSettings(settings, DEFAULT_SETTINGS);
  applyToForm();
  if (persist) save();
}

/* ---------- status line ---------- */

function setStatus(message, kind) {
  const s = el("status");
  s.textContent = message;
  s.className = kind || "";
}

/* ---------- themes: rendering ---------- */

function themeKey(settings) {
  const c = sanitizeSettings(settings);
  delete c.enabled;
  return JSON.stringify(c);
}

function makeStrip(settings) {
  const strip = document.createElement("div");
  strip.className = "strip";
  ["pageBg", "contentBg", "textColor", "linkColor"].forEach((k) => {
    const span = document.createElement("span");
    span.style.backgroundColor = settings[k] || "#cccccc";
    strip.appendChild(span);
  });
  return strip;
}

function markActiveThemes() {
  const key = themeKey(current);
  document.querySelectorAll(".theme-card").forEach((card) => {
    card.classList.toggle("active", card._themeKey === key);
  });
}

function renderPresets() {
  const grid = el("presetGrid");
  grid.textContent = "";
  if (!presets.length) {
    const p = document.createElement("div");
    p.className = "empty";
    p.textContent = "No preset themes found in the themes folder.";
    grid.appendChild(p);
    return;
  }
  presets.forEach((t) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "theme-card";
    card._themeKey = themeKey(t.settings);
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = t.name;
    card.append(makeStrip(t.settings), name);
    card.addEventListener("click", () => applyTheme(t));
    grid.appendChild(card);
  });
  markActiveThemes();
}

function renderMyThemes() {
  const list = el("myThemes");
  list.textContent = "";
  if (!savedThemes.length) {
    const p = document.createElement("div");
    p.className = "empty";
    p.textContent = "Nothing saved yet. Name your current look below, or import a file.";
    list.appendChild(p);
    return;
  }
  savedThemes.forEach((t) => {
    const row = document.createElement("div");
    row.className = "my-theme theme-card";
    row._themeKey = themeKey(t.settings);

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = t.name;
    name.title = t.author ? `${t.name} — by ${t.author}` : t.name;

    const apply = document.createElement("button");
    apply.type = "button";
    apply.textContent = "Apply";
    apply.addEventListener("click", () => applyTheme(t));

    const exp = document.createElement("button");
    exp.type = "button";
    exp.textContent = "Export";
    exp.addEventListener("click", () => downloadTheme(themeToFile(t.name, t.author, t.settings)));

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Delete";
    let armed = false;
    del.addEventListener("click", () => {
      if (!armed) {
        armed = true;
        del.textContent = "Sure?";
        setTimeout(() => { armed = false; del.textContent = "Delete"; }, 2500);
        return;
      }
      savedThemes = savedThemes.filter((x) => x.id !== t.id);
      persistSaved();
      renderMyThemes();
    });

    row.append(makeStrip(t.settings), name, apply, exp, del);
    list.appendChild(row);
  });
  markActiveThemes();
}

/* ---------- themes: actions ---------- */

function applyTheme(t) {
  // Themes start from "change nothing", so they never inherit leftovers from the last look.
  setCurrent({ ...BLANK_SETTINGS, ...t.settings, enabled: true }, true);
  setStatus(`Applied “${t.name}”.`, "ok");
}

function persistSaved() {
  return api.storage.local.set({ [SAVED_THEMES_KEY]: savedThemes });
}

function addSaved(name, author, settings) {
  const clean = sanitizeSettings(settings);
  delete clean.enabled;
  const existing = savedThemes.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.settings = clean;
    existing.author = author || existing.author || "";
    return existing;
  }
  if (savedThemes.length >= MAX_SAVED_THEMES) throw new Error(`You can keep up to ${MAX_SAVED_THEMES} saved themes. Delete one first.`);
  const t = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, author: author || "", settings: clean };
  savedThemes.push(t);
  return t;
}

function saveCurrent() {
  const name = el("saveName").value.trim();
  if (!name) { setStatus("Give your theme a name first.", "error"); el("saveName").focus(); return; }
  try {
    const replaced = savedThemes.some((t) => t.name.toLowerCase() === name.toLowerCase());
    addSaved(name, "", current);
    persistSaved();
    renderMyThemes();
    el("saveName").value = "";
    setStatus(replaced ? `Updated “${name}”.` : `Saved “${name}”.`, "ok");
  } catch (e) {
    setStatus(e.message, "error");
  }
}

function slug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "theme";
}

function downloadTheme(file) {
  const blob = new Blob([JSON.stringify(file, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = slug(file.name) + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  setStatus(`Downloaded ${a.download}.`, "ok");
}

function currentAsFile() {
  const name = el("saveName").value.trim() || "My theme";
  return themeToFile(name, "", current);
}

function importText(text) {
  try {
    const t = parseThemeFile(text);
    const saved = addSaved(t.name, t.author, t.settings);
    persistSaved();
    renderMyThemes();
    setCurrent(t.settings, true);
    const skipped = t.ignored + t.invalid;
    setStatus(`Imported and applied “${saved.name}”.` + (skipped ? ` (${skipped} unrecognized or invalid entries were skipped.)` : ""), "ok");
  } catch (e) {
    setStatus(e.message, "error");
  }
}

function importFile(file) {
  if (!file) return;
  if (file.size > 200 * 1024) { setStatus("That file is too large to be a theme.", "error"); return; }
  file.text().then(importText, () => setStatus("Couldn't read that file.", "error"));
}

function openInTab(hash) {
  api.tabs.create({ url: api.runtime.getURL("popup.html?view=tab" + (hash || "")) });
  window.close();
}

/* ---------- loading presets ---------- */

async function loadPresets() {
  try {
    const idx = await (await fetch(api.runtime.getURL("themes/index.json"))).json();
    const files = Array.isArray(idx.themes) ? idx.themes.slice(0, 50) : [];
    const loaded = await Promise.all(files.map(async (file) => {
      try {
        if (typeof file !== "string" || !/^[\w.-]+\.json$/.test(file) || file === "index.json") return null;
        const text = await (await fetch(api.runtime.getURL("themes/" + file))).text();
        const t = parseThemeFile(text);
        return { id: file, name: t.name, settings: t.settings };
      } catch (e) {
        return null;
      }
    }));
    presets = loaded.filter(Boolean);
  } catch (e) {
    presets = [];
  }
  renderPresets();
}

/* ---------- startup ---------- */

function wireStaticControls() {
  el("enabled").addEventListener("change", (e) => update("enabled", e.target.checked));
  el("openTab").addEventListener("click", () => openInTab(""));
  el("saveBtn").addEventListener("click", saveCurrent);
  el("saveName").addEventListener("keydown", (e) => { if (e.key === "Enter") saveCurrent(); });
  el("exportBtn").addEventListener("click", () => downloadTheme(currentAsFile()));
  el("copyBtn").addEventListener("click", () => {
    const text = JSON.stringify(currentAsFile(), null, 2);
    navigator.clipboard.writeText(text).then(
      () => setStatus("Theme JSON copied to the clipboard.", "ok"),
      () => setStatus("Couldn't copy. Use “Download .json” instead.", "error")
    );
  });
  el("pasteBtn").addEventListener("click", () => importText(el("pasteBox").value));

  // Firefox closes toolbar popups when a file dialog opens, which would cancel the upload.
  // So in the popup, "Choose file" opens the full-tab view, where the dialog works.
  const pick = el("pickFile");
  if (!IS_TAB) pick.textContent = "Choose file… (opens a tab)";
  pick.addEventListener("click", () => {
    if (IS_TAB) el("fileInput").click(); else openInTab("#import");
  });
  el("fileInput").addEventListener("change", (e) => {
    importFile(e.target.files[0]);
    e.target.value = "";
  });

  const zone = el("dropzone");
  ["dragenter", "dragover"].forEach((ev) => zone.addEventListener(ev, (e) => {
    e.preventDefault();
    zone.classList.add("over");
  }));
  ["dragleave", "drop"].forEach((ev) => zone.addEventListener(ev, () => zone.classList.remove("over")));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    importFile(e.dataTransfer.files[0]);
  });
  // A missed drop shouldn't navigate the popup to the file.
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());

  el("resetBtn").addEventListener("click", () => {
    setCurrent(DEFAULT_SETTINGS, true);
    setStatus("Reset to defaults.", "ok");
  });
}

(async () => {
  FONT_SUGGESTIONS.forEach((name) => {
    const o = document.createElement("option");
    o.value = name;
    el("fontList").appendChild(o);
  });

  // Build every control first so Coloris can attach to all the color inputs at once.
  buildSections();
  Coloris({
    el: ".coloris",
    format: "hex",
    alpha: false,
    themeMode: "light",
    closeButton: true,
    clearButton: true,
    clearLabel: "Clear",
    swatches: SWATCHES
  });
  wireStaticControls();

  const res = await api.storage.local.get([SETTINGS_KEY, SAVED_THEMES_KEY]);
  current = sanitizeSettings(res[SETTINGS_KEY], DEFAULT_SETTINGS);
  applyToForm();

  const stored = Array.isArray(res[SAVED_THEMES_KEY]) ? res[SAVED_THEMES_KEY] : [];
  savedThemes = stored
    .filter((t) => t && typeof t.name === "string" && t.settings)
    .map((t) => ({
      id: String(t.id || t.name),
      name: t.name.slice(0, 60),
      author: typeof t.author === "string" ? t.author.slice(0, 60) : "",
      settings: sanitizeSettings(t.settings)
    }));
  renderMyThemes();
  await loadPresets();

  if (IS_TAB && location.hash === "#import") {
    el("themesSec").open = true;
    el("dropzone").scrollIntoView({ block: "center" });
  }
})();
