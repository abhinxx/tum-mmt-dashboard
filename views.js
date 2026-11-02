/* To do, my courses, calendar, catalogue, links, router. */

const LEVELS = { urgent: ["Urgent", "neg"], high: ["High", "warn"], medium: ["Medium", "acc"], low: ["Low", ""] };
const actArea = a => /MGT\d|Entrepreneurship|Launchpad|Opportunity/.test(a.text) ? "mgmt" : /IN\d{4}|Drone|Computer|Robotics/.test(a.text) ? "tech" : "admin";

function viewTodo() {
  const f = st.f.todo ||= { lvl: "all", area: "all", done: false };
  const all = S.plan.actions.slice().sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const list = all.filter(a => (f.lvl === "all" || a.level === f.lvl) && (f.area === "all" || actArea(a) === f.area) && (f.done || !st.done.includes(a.text)));
  const cnt = k => all.filter(a => a.level === k && !st.done.includes(a.text)).length;
  const chip = (k, v, t, c) => `<button class="chip ${f[k] === v ? "on" : ""}" data-tf="${k}" data-v="${v}">${t}${c != null ? ` <span class="c">${c}</span>` : ""}</button>`;
  return `<div class="page-head"><div><h1>To do</h1><p>Exam registrations, deregistrations and admin, sorted by deadline</p></div></div>
  <div class="card"><div class="toolbar">
    ${chip("lvl", "all", "All")}${Object.entries(LEVELS).map(([k, [t]]) => chip("lvl", k, t, cnt(k))).join("")}
    <span class="sep"></span>${chip("area", "all", "Any area")}${chip("area", "mgmt", "Management")}${chip("area", "tech", "Technology")}${chip("area", "admin", "Admin")}
    <span class="sep"></span><button class="chip ${f.done ? "on" : ""}" data-tdone>Show done</button></div>
  <div class="rows">${list.map(a => `<div class="row todo ${st.done.includes(a.text) ? "done" : ""}">
      <input type="checkbox" data-done="${esc(a.text)}" ${st.done.includes(a.text) ? "checked" : ""} aria-label="Done">
      <span class="mono fg2 hide-sm">${a.due ? dmy(a.due) : "Anytime"}</span>
      <span class="txt">${esc(a.text)}</span>
      <span class="hide-sm"><span class="tag ${LEVELS[a.level][1]}">${LEVELS[a.level][0]}</span></span>
      <span style="display:flex;gap:8px;align-items:center">${dueChip(a.due)}<a class="btn sm" href="${esc(a.url)}" target="_blank" rel="noopener">Open</a></span></div>`).join("") || '<div class="empty">Nothing here</div>'}</div></div>`;
}
function bindTodo(root) {
  root.querySelectorAll("[data-tf]").forEach(b => b.onclick = () => { st.f.todo[b.dataset.tf] = b.dataset.v; render(); });
  root.querySelector("[data-tdone]").onclick = () => { st.f.todo.done = !st.f.todo.done; render(); };
  root.querySelectorAll("[data-done]").forEach(b => b.onchange = () => {
    const t = b.dataset.done; st.done = b.checked ? [...st.done, t] : st.done.filter(x => x !== t); save(); render(); });
}

/* My courses, grouped by what still has to happen */
function courseGroup(c) {
  if (!isTaking(c)) return "dropped";
  if (!c.exam) return "noexam";
  if (c.exam.registered) return "registered";
  if (daysTo(c.exam.regFrom) <= 0 && daysTo(c.exam.regTo) >= 0) return "regopen";
  if (daysTo(c.exam.regFrom) > 0) return "regsoon";
  return "regclosed";
}
const CGROUPS = {
  regopen: ["Taking · exam registration open now", "neg"], regsoon: ["Taking · exam registration not open yet", "warn"],
  registered: ["Taking · exam registered", "pos"], noexam: ["Taking · no exam date published", "acc"],
  regclosed: ["Taking · registration window missed", "neg"], dropped: ["Dropped or not taking", ""],
};
function lecturersOf(c) {
  const seen = new Map();
  for (const l of (S.cal.lecturers[c.code] || [])) if (l.name) seen.set(l.name, l);
  const m = S.byCode[c.code];
  if (m) for (const o of m.offerings) if ((c.courseIds || []).includes(o.courseId)) for (const l of o.lecturers) if (l.name) seen.set(l.name, l);
  return [...seen.values()];
}
function courseCard(c) {
  const e = c.exam, g = courseGroup(c), m = S.byCode[c.code];
  const regTxt = e ? `${dmy(e.regFrom)} to ${dmy(e.regTo)}` : "-";
  return `<details class="course"><summary>
      <div><div class="code">${esc(c.code)} · ${AREA[c.area]}${c.mandatory ? " · mandatory" : ""}</div><div class="name">${esc(c.name)}</div></div>
      <div class="num fg2 hide-sm">${c.ects ?? "?"} ECTS</div>
      <div class="mono fg2 hide-sm">${e ? "Exam " + dmy(e.date).slice(0, 5) : "-"}</div>
      <div>${g === "regopen" ? `<span class="tag neg">Register by ${dmy(e.regTo).slice(0, 5)}</span>` : g === "regsoon" ? `<span class="tag warn">Opens ${dmy(e.regFrom).slice(0, 5)}</span>` : g === "dropped" ? '<span class="tag">Dropped</span>' : g === "noexam" ? '<span class="tag acc">No date yet</span>' : '<span class="tag pos">Registered</span>'}</div>
      ${icon("chev", "chev")}</summary>
    <div class="body">
      <div><div class="sect-lbl">Exam</div><dl class="kv">
        <dt>Date</dt><dd>${e ? `${dmy(e.date)} · ${esc(e.time)}` : "Not published"}</dd>
        <dt>Place</dt><dd>${e ? esc(e.place) : "-"}</dd>
        <dt>Registration</dt><dd>${regTxt}</dd>
        <dt>Deregister by</dt><dd>${e ? dmy(e.deregTo) : "-"}</dd>
        ${e && e.retake ? `<dt>Retake</dt><dd>${dmy(e.retake.date)} · register ${dmy(e.retake.regFrom)} to ${dmy(e.retake.regTo)}</dd>` : ""}
        <dt>Status</dt><dd>${esc(c.status)}</dd></dl>
        ${c.note ? `<div class="note">${esc(c.note)}</div>` : ""}</div>
      <div><div class="sect-lbl">Lecturers</div><div class="people">${people(lecturersOf(c))}</div></div>
      <div><div class="sect-lbl">Links</div><div class="linkset">
        ${c.code !== "Drone lab" && g !== "dropped" ? `<a class="btn sm primary" href="${examUrl(c.code)}" target="_blank" rel="noopener">Exam (de)registration</a>` : ""}
        ${(c.courseIds || []).map((id, i) => `<a class="btn sm" href="${courseUrl(id)}" target="_blank" rel="noopener">TUMonline${c.courseIds.length > 1 ? " " + (i + 1) : ""}</a>`).join("")}
        ${c.moodle ? `<a class="btn sm" href="${c.moodle}" target="_blank" rel="noopener">Moodle</a>` : ""}
        ${m ? `<a class="btn sm" href="${m.handbook}" target="_blank" rel="noopener">Module handbook</a>` : ""}
        ${(c.extra || []).map(x => `<a class="btn sm" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a>`).join("")}</div></div>
    </div></details>`;
}
function viewCourses() {
  const f = st.f.courses ||= { area: "all" };
  const cs = S.plan.courses.filter(c => f.area === "all" || c.area === f.area);
  const chip = (v, t) => `<button class="chip ${f.area === v ? "on" : ""}" data-ca="${v}">${t}</button>`;
  return `<div class="page-head"><div><h1>My courses</h1><p>Registered courses grouped by what still has to happen</p></div></div>
  <div class="toolbar">${chip("all", "All")}${chip("mgmt", "Management")}${chip("tech", "Technology")}</div>
  ${Object.entries(CGROUPS).map(([k, [t]]) => { const list = cs.filter(c => courseGroup(c) === k); return list.length ?
    `<div class="group-h">${t} <span class="mono">${list.length} · ${k === "dropped" ? "not counted" : list.reduce((s, c) => s + (c.ects || 0), 0) + " ECTS"}</span></div>${list.map(courseCard).join("")}` : ""; }).join("")}`;
}
function bindCourses(root) { root.querySelectorAll("[data-ca]").forEach(b => b.onclick = () => { st.f.courses.area = b.dataset.ca; render(); }); }

/* Calendar */
function calendarEvents() {
  const name = Object.fromEntries(S.plan.courses.map(c => [c.code, c.name]));
  const taking = new Set(S.plan.courses.filter(isTaking).map(c => c.code));
  const ev = [];
  for (const l of S.cal.lectures) if (taking.has(l.code))
    ev.push({ date: l.start.slice(0, 10), time: `${l.start.slice(11, 16)}-${(l.end || "").slice(11, 16)}`, title: name[l.code], where: l.room, kind: "lecture", code: l.code, start: l.start, end: l.end });
  for (const c of S.plan.courses) if (c.exam && isTaking(c)) {
    ev.push({ date: c.exam.date, time: c.exam.time.split(" ")[0].includes(":") ? c.exam.time.split(" ")[0] : "all day", title: `Exam · ${c.name}`, where: c.exam.place, kind: "exam", code: c.code });
    if (daysTo(c.exam.regFrom) >= 0) ev.push({ date: c.exam.regFrom, time: "00:00", title: `Exam registration opens · ${c.code}`, kind: "deadline", code: c.code, url: examUrl(c.code) });
    ev.push({ date: c.exam.regTo, time: "23:59", title: `Exam registration closes · ${c.code}`, kind: "deadline", code: c.code, url: examUrl(c.code) });
    ev.push({ date: c.exam.deregTo, time: "23:59", title: `Exam deregistration deadline · ${c.code}`, kind: "deadline", code: c.code, url: examUrl(c.code) });
  }
  for (const e of S.plan.events) ev.push({ ...e, time: e.time || "all day", kind: "event" });
  return ev.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
function viewCalendar() {
  const f = st.f.cal ||= { range: "30", kinds: ["lecture", "exam", "deadline", "event"], code: "all" };
  const all = calendarEvents();
  const list = all.filter(e => daysTo(e.date) >= 0 && (f.range === "all" || daysTo(e.date) <= +f.range) && f.kinds.includes(e.kind) && (f.code === "all" || e.code === f.code));
  const days = [...new Set(list.map(e => e.date))];
  const codes = [...new Set(all.map(e => e.code).filter(Boolean))];
  const kchip = (k, t) => `<button class="chip ${f.kinds.includes(k) ? "on" : ""}" data-kind="${k}">${t} <span class="c">${all.filter(e => e.kind === k && daysTo(e.date) >= 0).length}</span></button>`;
  return `<div class="page-head"><div><h1>Calendar</h1><p>Lectures, exams, deadlines and UnternehmerTUM sessions for the courses you're taking</p></div><button class="btn" data-ics>Download .ics</button></div>
  <div class="card"><div class="toolbar">
    ${[["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["all", "Semester"]].map(([v, t]) => `<button class="chip ${f.range === v ? "on" : ""}" data-range="${v}">${t}</button>`).join("")}
    <span class="sep"></span>${kchip("lecture", "Lectures")}${kchip("exam", "Exams")}${kchip("deadline", "Deadlines")}${kchip("event", "Sessions")}
    <span class="sep"></span><select class="search" style="min-width:180px" data-code><option value="all">All courses</option>${codes.map(c => `<option ${f.code === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
  ${days.map(d => `<div class="cal-day"><div class="dl"><b>${dayName(d)}</b><span>${daysTo(d) === 0 ? "today" : daysTo(d) === 1 ? "tomorrow" : `in ${daysTo(d)} days`}</span></div><div>
    ${list.filter(e => e.date === d).map(e => `<div class="ev"><span class="time">${esc(e.time)}</span><span class="kind ${e.kind}">${e.kind === "event" ? "session" : e.kind}</span>
      <span>${e.url ? `<a href="${e.url}" target="_blank" rel="noopener">${esc(e.title)}</a>` : esc(e.title)}${e.where ? ` <span class="where">· ${esc(e.where)}</span>` : ""}</span></div>`).join("")}</div></div>`).join("") || '<div class="empty">Nothing in this range</div>'}</div>`;
}
function bindCalendar(root) {
  const f = st.f.cal;
  root.querySelectorAll("[data-range]").forEach(b => b.onclick = () => { f.range = b.dataset.range; render(); });
  root.querySelectorAll("[data-kind]").forEach(b => b.onclick = () => { const k = b.dataset.kind; f.kinds = f.kinds.includes(k) ? f.kinds.filter(x => x !== k) : [...f.kinds, k]; render(); });
  root.querySelector("[data-code]").onchange = e => { f.code = e.target.value; render(); };
  root.querySelector("[data-ics]").onclick = () => {
    const p = s => s.replace(/[-:]/g, ""), L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//mmt-planner//EN"];
    calendarEvents().forEach((e, i) => {
      L.push("BEGIN:VEVENT", `UID:mmt-${i}-${e.date}@planner`, `DTSTAMP:${p(new Date().toISOString().slice(0, 19))}Z`);
      if (e.start && e.end) L.push(`DTSTART;TZID=Europe/Berlin:${p(e.start)}`, `DTEND;TZID=Europe/Berlin:${p(e.end)}`); else L.push(`DTSTART;VALUE=DATE:${p(e.date)}`);
      L.push(`SUMMARY:${(e.kind === "lecture" ? "" : e.kind[0].toUpperCase() + e.kind.slice(1) + ": ") + e.title.replace(/[,;]/g, " ")}`);
      if (e.where) L.push(`LOCATION:${e.where.replace(/[,;]/g, " ")}`);
      if (e.url) L.push(`URL:${e.url}`);
      L.push("END:VEVENT");
    });
    L.push("END:VCALENDAR");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([L.join("\r\n")], { type: "text/calendar" })); a.download = "mmt-wise-2026-27.ics"; a.click();
  };
}

/* Catalogue */
function viewCatalogue() {
  const f = st.f.cat ||= { area: "all", av: "all", ects: "all", q: "" };
  const inPlan = new Set([...semesterItems("now"), ...semesterItems("next")].map(i => i.code));
  const base = S.mods.filter(m => f.area === "all" || areaOfMod(m) === f.area);
  const order = { open: 0, noreg: 1, closed: 2, summer: 3 };
  const list = base.filter(m => (f.av === "all" || avail(m) === f.av) && (f.ects === "all" || (f.ects === "le5" ? m.ects <= 5 : f.ects === "6" ? m.ects === 6 : m.ects >= 8))
    && (!f.q || (m.code + " " + m.name + " " + m.offerings.map(o => o.lecturers.map(l => l.name).join(" ")).join(" ")).toLowerCase().includes(f.q)))
    .sort((x, y) => areaOfMod(x).localeCompare(areaOfMod(y)) || order[avail(x)] - order[avail(y)] || x.name.localeCompare(y.name));
  const chip = (k, v, t, c) => `<button class="chip ${f[k] === v ? "on" : ""}" data-cf="${k}" data-v="${v}">${t}${c != null ? ` <span class="c">${c}</span>` : ""}</button>`;
  return `<div class="page-head"><div><h1>Catalogue</h1><p>Management: Innovation & Entrepreneurship. Technology: Computer Engineering + Informatics.</p></div></div>
  <div class="card"><div class="toolbar">
    ${chip("area", "all", "All", S.mods.length)}${chip("area", "mgmt", "Management · I&E", S.mods.filter(m => areaOfMod(m) === "mgmt").length)}${chip("area", "tech", "Technology · CE + Informatics", S.mods.filter(m => areaOfMod(m) === "tech").length)}
    <span class="sep"></span>${chip("av", "all", "Any availability")}${Object.entries(AVAIL).map(([k, [t]]) => chip("av", k, t, base.filter(m => avail(m) === k).length)).join("")}
    <span class="sep"></span>${chip("ects", "all", "Any ECTS")}${chip("ects", "le5", "≤ 5")}${chip("ects", "6", "6")}${chip("ects", "ge8", "≥ 8")}
    <input class="search" placeholder="Search code, title, lecturer" data-cq value="${esc(f.q)}"></div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Module</th><th class="hide-sm">Availability</th><th class="r">ECTS</th><th class="hide-sm">Lecturers</th><th></th></tr></thead><tbody>
  ${list.map(m => { const offs = m.offerings.filter(o => o.termId === (avail(m) === "summer" ? 206 : 207)); const ls = new Map(); offs.forEach(o => o.lecturers.forEach(l => l.name && ls.set(l.name, l)));
    return `<tr><td><div class="name">${esc(m.name)}</div><div class="sub"><span class="mono">${esc(m.code)}</span> · ${AREA[areaOfMod(m)]}</div>
      <div class="show-sm" style="margin-top:4px">${availTag(avail(m))}</div>
      ${offs.map(o => `<div class="sub"><a href="${o.url}" target="_blank" rel="noopener">${esc(o.type)} · ${esc(o.term)}</a> · ${esc(o.registration)}</div>`).join("")}
      <div class="sub linkset" style="margin-top:4px"><a href="${m.handbook}" target="_blank" rel="noopener">Module handbook</a><a href="${examUrl(m.code)}" target="_blank" rel="noopener">Exam dates</a></div></td>
      <td class="hide-sm">${availTag(avail(m))}</td><td class="r num">${m.ects ?? "?"}</td>
      <td class="people hide-sm">${people([...ls.values()].slice(0, 3))}${ls.size > 3 ? `<div class="muted">+${ls.size - 3} more</div>` : ""}</td>
      <td class="r">${inPlan.has(m.code) ? '<span class="tag pos">In plan</span>' : `<button class="btn sm" aria-label="Add ${esc(m.name)} to plan" data-cadd="${esc(m.code)}">Add<span class="hide-sm">&nbsp;to plan</span></button>`}</td></tr>`; }).join("") || '<tr><td colspan="5" class="empty">No module matches</td></tr>'}
  </tbody></table></div></div>`;
}
function bindCatalogue(root) {
  root.querySelectorAll("[data-cf]").forEach(b => b.onclick = () => { st.f.cat[b.dataset.cf] = b.dataset.v; render(); });
  const q = root.querySelector("[data-cq]");
  q.oninput = e => { st.f.cat.q = e.target.value.trim().toLowerCase(); render(); const n = $("[data-cq]"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  root.querySelectorAll("[data-cadd]").forEach(b => b.onclick = () => {
    const m = S.byCode[b.dataset.cadd]; const bucket = avail(m) === "summer" ? "next" : "now";
    st.extra[bucket].push(m.code); st.bucket = bucket; save(); location.hash = "#planner"; });
}

/* Links */
function viewLinks() {
  const g = [
    ["TUMonline", [["My Studies (credits tree)", `${TO}/slc.cm.cs/student/myStudies`], ["My exams", `${TO}/slc.xm.exr/exExamMyRegistration?$ctx=lang=EN`],
      ["Exam registration (all exams)", `${TO}/slc.xm.exr/exExamRegistration?$ctx=lang=EN`], ["My courses WiSe 26/27", `${TO}/slc.tm.cp/student/myCourses?$ctx=lang=EN&objTermId=207`], ["Home (calendar, achievements, transcripts)", `${TO}/home`]]],
    ["Moodle", [["Dashboard", "https://www.moodle.tum.de/my/"], ...S.plan.courses.filter(c => c.moodle && isTaking(c)).map(c => [c.name, c.moodle]), ...S.plan.otherMoodle.map(x => [x.label, x.url])]],
    ["Program and contacts", [["MMT program page", "https://www.mgt.tum.de/programs/master-in-management-technology"], ["Degree program documentation (PDF)", "https://www.mgt.tum.de/fileadmin/mgt.tum.de/downloads/MMT/20250702_StuDoku_MMT_WS25-26_EN.pdf"],
      ["Student counselling · studentcounseling_master@mgt.tum.de", "mailto:studentcounseling_master@mgt.tum.de"], ["Grade management · grademanagement@mgt.tum.de", "mailto:grademanagement@mgt.tum.de"],
      ["Joint programs (HEC) · jip@mgt.tum.de", "mailto:jip@mgt.tum.de"], ["Opportunity Hunters · UnternehmerTUM", "https://academy.unternehmertum.de/programs/opportunity-hunters/"], ["Startup Launchpad · UnternehmerTUM", "https://academy.unternehmertum.de/programs/start-up-launchpad/"]]],
  ];
  return `<div class="page-head"><div><h1>Links</h1><p>Everything you open during the semester</p></div></div>
  <div class="linkgrid">${g.map(([h, ls]) => `<div class="card"><h3>${h}</h3>${ls.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join("")}</div>`).join("")}</div>`;
}

/* Router */
const ROUTES = {
  overview: ["Overview", "home", viewOverview, null], planner: ["Planner", "plan", viewPlanner, bindPlanner], todo: ["To do", "todo", viewTodo, bindTodo],
  courses: ["My courses", "book", viewCourses, bindCourses], calendar: ["Calendar", "cal", viewCalendar, bindCalendar],
  catalogue: ["Catalogue", "grid", viewCatalogue, bindCatalogue], links: ["Links", "link", viewLinks, null],
};
let lastRoute = "";
function render() {
  const r = (location.hash.slice(1) || "overview").split("?")[0];
  const key = ROUTES[r] ? r : "overview";
  const open = S.plan.actions.filter(a => !st.done.includes(a.text)).length;
  const counts = { todo: open, courses: S.plan.courses.filter(isTaking).length, catalogue: S.mods.length };
  $("#nav").innerHTML = Object.entries(ROUTES).map(([k, [t, ic]]) => `<a href="#${k}" class="${k === key ? "on" : ""}">${icon(ic)}${t}${counts[k] != null ? `<span class="count">${counts[k]}</span>` : ""}</a>`).join("");
  const v = $("#view");
  const scroll = key === lastRoute ? window.scrollY : 0;
  const inner = key === lastRoute ? [...v.querySelectorAll(".sticky")].map(e => e.scrollTop) : [];
  v.innerHTML = `<div class="${key === lastRoute ? "" : "view"}">${ROUTES[key][2]()}</div>`;
  if (ROUTES[key][3]) ROUTES[key][3](v);
  window.scrollTo(0, scroll);
  v.querySelectorAll(".sticky").forEach((e, i) => { if (inner[i]) e.scrollTop = inner[i]; });
  lastRoute = key;
}
window.addEventListener("hashchange", render);
Promise.all(["data/plan.json", "data/public.json", "data/calendar.json"].map(u => fetch(u).then(r => r.json()))).then(([plan, mods, cal]) => {
  S.plan = plan; S.mods = mods.filter(m => m.ects != null || true); S.cal = cal; S.byCode = Object.fromEntries(mods.map(m => [m.code, m]));
  $("#foot").innerHTML = `Data as of ${dmy(plan.updated)}<br>Not official. Confirm in TUMonline.`;
  render();
}).catch(e => { $("#view").innerHTML = `<div class="card">Could not load data: ${esc(e)}</div>`; });
