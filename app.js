/* MMT semester planner. Plain JS, no build. Data: data/plan.json (personal), data/public.json + data/calendar.json (generated). */

/* ---------- 1. helpers ---------- */
const TO = "https://campus.tum.de/tumonline/ee/ui/ca2/app/desktop/#";
const examUrl = q => `${TO}/slc.xm.exr/exExamRegistration?$ctx=lang=EN&$filter=exExamDateFrom-gte=2026-10-01;q-likeI=${encodeURIComponent(q)}`;
const courseUrl = id => `${TO}/slc.tm.cp/student/courses/${id}?$ctx=lang=EN`;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const $ = s => document.querySelector(s);
const TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
const toDate = iso => new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
const daysTo = iso => Math.round((toDate(iso.slice(0, 10)) - TODAY) / 864e5);
const dmy = iso => iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "";
const dayName = iso => toDate(iso.slice(0, 10)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const dueChip = iso => {
  if (!iso) return `<span class="due">No date</span>`;
  const n = daysTo(iso);
  const cls = n <= 7 ? "urgent" : n <= 30 ? "soon" : "";
  const t = n < 0 ? `${-n}d ago` : n === 0 ? "today" : `in ${n}d`;
  return `<span class="due ${cls}">${t}</span>`;
};
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem("mmt:" + k)) ?? d; } catch { return d; } },
  set: (k, v) => localStorage.setItem("mmt:" + k, JSON.stringify(v)),
};
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  plan: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v16"/>',
  todo: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  ext: '<path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
};
const icon = (n, cls = "") => `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true">${ICONS[n]}</svg>`;
const people = ls => (ls || []).filter(l => l.name).map(l =>
  `<div>${l.card ? `<a href="${esc(l.card)}" target="_blank" rel="noopener">${esc(l.name)}</a>` : esc(l.name)}${l.email ? ` · <a href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : ""}</div>`).join("") || '<div class="muted">Not listed</div>';
const AREA = { mgmt: "Management", tech: "Technology" };
const areaOfMod = m => (m.cats.includes("mgmt_ie") ? "mgmt" : "tech");
const avail = m => {
  const w = m.offerings.filter(o => o.termId === 207);
  if (w.some(o => /open for registration/i.test(o.registration || ""))) return "open";
  if (w.some(o => /no registration/i.test(o.registration || ""))) return "noreg";
  if (w.length) return "closed";
  return "summer";
};
const AVAIL = {
  open: ["Open now", "pos"], noreg: ["Offered now, no course registration", "acc"],
  closed: ["Registration closed", "neg"], summer: ["Summer semester", "warn"],
};
const availTag = k => `<span class="tag ${AVAIL[k][1]}">${AVAIL[k][0]}</span>`;

/* ---------- 2. state + data ---------- */
const S = { plan: null, mods: [], cal: null, byCode: {} };
const st = {
  extra: store.get("extra", { now: [], next: [] }),   // module codes added in the planner, per semester
  off: store.get("off", []),                          // base courses toggled off (what-if)
  done: store.get("done", []),                        // finished to-dos
  bucket: store.get("bucket", "now"),
  f: {},                                              // per-view filters (not persisted)
};
const save = () => { store.set("extra", st.extra); store.set("off", st.off); store.set("done", st.done); store.set("bucket", st.bucket); };

const isTaking = c => c.status.startsWith("exam planned");
function semesterItems(bucket) {
  const out = [];
  if (bucket === "now") {
    for (const c of S.plan.courses.filter(isTaking)) out.push({ code: c.code, name: c.name, ects: c.ects, area: c.area, base: true, on: !st.off.includes(c.code) });
  }
  for (const code of st.extra[bucket]) {
    const m = S.byCode[code];
    if (m) out.push({ code, name: m.name, ects: m.ects, area: areaOfMod(m), base: false, on: true, avail: avail(m) });
  }
  return out;
}
const sumE = (items, area) => items.filter(i => i.on && (!area || i.area === area)).reduce((s, i) => s + (i.ects || 0), 0);
const TARGET = () => S.plan.rules.perSemesterTarget;
