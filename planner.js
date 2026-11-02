/* Overview + semester planner (the core view). */

/* Semester bar: stacked management / technology segments against the 30 ECTS target */
function semBar(items) {
  const scale = Math.max(TARGET() + 6, sumE(items) + 2);
  const segs = items.filter(i => i.on).map(i => {
    const e = i.ects ?? 0;
    const w = ((e || 2) / scale) * 100;
    const cls = `${i.ects == null ? "unknown" : i.area} ${i.base ? "" : "planned"}`;
    return `<div class="seg ${cls}" style="flex:0 0 ${w}%" title="${esc(i.code)} · ${esc(i.name)} · ${e || "?"} ECTS">${esc(i.code)}</div>`;
  }).join("");
  return `<div class="sembar-wrap"><div class="target" style="left:${(TARGET() / scale) * 100}%"><span>${TARGET()} ECTS target</span></div>
    <div class="sembar">${segs}</div></div>
    <div class="legend"><span><i style="background:var(--mgmt)"></i>Management</span><span><i style="background:var(--tech)"></i>Technology</span>
    <span><i style="background:repeating-linear-gradient(135deg,#7a8ca3 0 4px,#a9b6c6 4px 6px)"></i>Added in planner</span><span><i style="background:#d4d4d8"></i>ECTS unknown</span></div>`;
}

function leftLine(items) {
  const tot = sumE(items), left = Math.max(0, TARGET() - tot);
  const unknown = items.filter(i => i.on && i.ects == null).map(i => i.code);
  return { tot, left, unknown, text: left === 0 ? `Target reached, ${tot - TARGET()} ECTS buffer` : `${left} ECTS left to reach ${TARGET()}` };
}

/* Degree totals: what this + next semester leave open per area */
function degreeRows() {
  const now = semesterItems("now"), next = semesterItems("next");
  const rows = [
    { id: "mgmt", label: "Management · Innovation & Entrepreneurship", req: 30, a: sumE(now, "mgmt"), b: sumE(next, "mgmt"), note: "6 Advanced Seminar (mandatory) + 24 I&E electives" },
    { id: "tech", label: "Technology · Computer Engineering (major)", req: 30, a: sumE(now, "tech"), b: sumE(next, "tech"), note: "CE or Informatics catalogue modules" },
    { id: "hec", label: "Double degree · HEC Paris", req: 30, a: 30, b: 0, note: "Transferred from HEC" },
    { id: "thesis", label: "Master's thesis", req: 30, a: 0, b: 0, note: "Later semester" },
  ];
  return rows.map(r => {
    const left = Math.max(0, r.req - r.a - r.b);
    return `<div class="area-row"><div><div class="t">${esc(r.label)}</div><div class="d">${esc(r.note)}</div>
      <div class="pbar"><div style="width:${Math.min(100, r.a / r.req * 100)}%;background:var(--${r.id === "tech" ? "tech" : r.id === "mgmt" ? "mgmt" : "hec"})"></div>
      <div style="width:${Math.min(100 - r.a / r.req * 100, r.b / r.req * 100)}%;background:var(--${r.id === "tech" ? "tech" : "mgmt"});opacity:.4"></div></div></div>
      <div class="v"><b>${r.a + r.b}</b><span class="muted"> / ${r.req}</span><div class="d">${left ? `${left} left` : "complete"}</div></div></div>`;
  }).join("");
}

function viewOverview() {
  const now = semesterItems("now"), L = leftLine(now);
  const taking = S.plan.courses.filter(isTaking);
  const withExam = taking.filter(c => c.exam);
  const reg = withExam.filter(c => c.exam.registered).length;
  const open = withExam.filter(c => !c.exam.registered && daysTo(c.exam.regFrom) <= 0 && daysTo(c.exam.regTo) >= 0);
  const todos = S.plan.actions.filter(a => !st.done.includes(a.text)).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const next = todos.find(a => a.due);
  const upcoming = calendarEvents().filter(e => daysTo(e.date) >= 0 && e.kind !== "lecture").slice(0, 6);
  return `<div class="page-head"><div><h1>Winter semester 2026/27</h1><p>${esc(S.plan.program)}</p></div><a class="btn primary" href="#planner">Open planner</a></div>
  <div class="stats">
    <a class="stat" href="#planner"><div class="lbl">This semester</div><div class="fig">${L.tot}<small> / ${TARGET()} ECTS</small></div>
      <div class="sub ${L.left ? "neg" : "pos"}">${L.text}${L.unknown.length ? ` · +${L.unknown.join(", ")} (ECTS unknown)` : ""}</div></a>
    <a class="stat" href="#courses"><div class="lbl">Exam registrations</div><div class="fig">${reg}<small> / ${withExam.length}</small></div>
      <div class="sub ${open.length ? "neg" : ""}">${open.length ? `${open.length} open right now` : "None open right now"}</div></a>
    <a class="stat" href="#todo"><div class="lbl">Next deadline</div><div class="fig" style="font-size:20px;line-height:36px">${next ? dmy(next.due) : "-"}</div>
      <div class="sub">${next ? esc(next.text.split(".")[0]) : ""}</div></a>
    <a class="stat" href="#planner"><div class="lbl">Degree</div><div class="fig">${30 + sumE(now) + sumE(semesterItems("next"))}<small> / 120 ECTS planned</small></div>
      <div class="sub">0 earned in TUMonline so far</div></a>
  </div>
  <div class="cols">
    <div class="card"><h2>This semester <span class="muted">· click to plan electives</span></h2>
      <a href="#planner" style="display:block;color:inherit;text-decoration:none">
        <div class="bignum-row"><span class="bignum">${L.tot}</span><span class="fg2">of ${TARGET()} ECTS · ${esc(L.text)}</span></div>${semBar(now)}</a>
      <h2 style="margin-top:24px">Degree progress</h2>${degreeRows()}</div>
    <div>
      <div class="card"><h2>To do <span class="muted">· ${todos.length} open</span></h2><div class="rows">
        ${todos.slice(0, 5).map(a => `<div class="row" style="grid-template-columns:auto 1fr"><span>${dueChip(a.due)}</span><a href="${esc(a.url)}" target="_blank" rel="noopener" style="color:var(--fg)">${esc(a.text.split(".")[0])}</a></div>`).join("")}
      </div><a class="btn sm" href="#todo" style="margin-top:8px">All to-dos</a></div>
      <div class="card"><h2>Coming up</h2><div class="rows">
        ${upcoming.map(e => `<div class="row" style="grid-template-columns:72px 1fr"><span class="mono muted">${dmy(e.date).slice(0, 5)}</span><span><span class="kind ${e.kind}">${e.kind}</span> · ${esc(e.title)}</span></div>`).join("")}
      </div><a class="btn sm" href="#calendar" style="margin-top:8px">Calendar</a></div>
    </div>
  </div>`;
}

function viewPlanner() {
  const b = st.bucket, items = semesterItems(b), L = leftLine(items);
  const label = b === "now" ? "Winter semester 2026/27" : "Summer semester 2027";
  const f = st.f.planner ||= { area: "all", av: b === "now" ? "now" : "summer", q: "", ects: "all" };
  const inPlan = new Set([...semesterItems("now"), ...semesterItems("next")].map(i => i.code));
  const pick = S.mods.filter(m => !inPlan.has(m.code))
    .filter(m => f.area === "all" || areaOfMod(m) === f.area)
    .filter(m => f.av === "all" || (f.av === "now" ? ["open", "noreg"].includes(avail(m)) : avail(m) === f.av))
    .filter(m => f.ects === "all" || (f.ects === "le5" ? m.ects <= 5 : f.ects === "6" ? m.ects === 6 : m.ects >= 8))
    .filter(m => !f.q || (m.code + " " + m.name).toLowerCase().includes(f.q))
    .sort((x, y) => areaOfMod(x).localeCompare(areaOfMod(y)) || x.name.localeCompare(y.name));
  const chip = (k, v, t) => `<button class="chip ${f[k] === v ? "on" : ""}" data-f="${k}" data-v="${v}">${t}</button>`;
  return `<div class="page-head"><div><h1>Semester planner</h1><p>Add electives until each semester reaches ${TARGET()} ECTS. Saved in this browser.</p></div>
    <div class="toolbar" style="margin:0"><button class="chip ${b === "now" ? "on" : ""}" data-bucket="now">WiSe 26/27</button><button class="chip ${b === "next" ? "on" : ""}" data-bucket="next">SoSe 27</button></div></div>
  <div class="planner">
    <div class="sticky"><div class="card"><h2>${label}</h2>
      <div class="bignum-row"><span class="bignum">${L.tot}</span><span class="fg2">of ${TARGET()} ECTS</span></div>
      <div class="${L.left ? "" : ""}" style="margin-bottom:12px;color:${L.left ? "var(--neg)" : "var(--pos)"}">${esc(L.text)}${L.unknown.length ? ` · ${L.unknown.join(", ")} not counted (ECTS unknown)` : ""}</div>
      ${semBar(items)}
      <div style="margin-top:16px">${items.length ? items.map(i => `<div class="plan-item">
        <span class="dot" style="background:var(--${i.area})"></span>
        <span class="nm">${esc(i.name)}<br><span class="mono">${esc(i.code)} · ${AREA[i.area]}${i.base ? " · taking" : " · planned"}${i.avail ? " · " + AVAIL[i.avail][0].toLowerCase() : ""}</span></span>
        <span class="num fg2">${i.ects ?? "?"}</span>
        ${i.base ? `<input type="checkbox" title="Count this course" data-off="${esc(i.code)}" ${i.on ? "checked" : ""} style="accent-color:var(--acc)">`
                 : `<button class="iconbtn" title="Remove" data-rm="${esc(i.code)}">${icon("x")}</button>`}</div>`).join("") : '<div class="empty">Nothing planned yet. Add modules from the list.</div>'}</div>
      <h2 style="margin-top:20px">Degree after both semesters</h2>${degreeRows()}
    </div></div>
    <div class="card"><h2>Add electives <span class="muted">· ${pick.length} modules</span></h2>
      <div class="toolbar">
        ${chip("area", "all", "All areas")}${chip("area", "mgmt", "Management · I&E")}${chip("area", "tech", "Technology · CE + Informatics")}
        <span class="sep"></span>${chip("av", "now", "Offered now")}${chip("av", "summer", "Summer")}${chip("av", "closed", "Closed")}${chip("av", "all", "Any")}
        <span class="sep"></span>${chip("ects", "all", "Any ECTS")}${chip("ects", "le5", "≤ 5")}${chip("ects", "6", "6")}${chip("ects", "ge8", "≥ 8")}
        <input class="search" placeholder="Search" data-q value="${esc(f.q)}">
      </div>
      <table class="tbl"><thead><tr><th>Module</th><th>Area</th><th>Availability</th><th class="r">ECTS</th><th></th></tr></thead><tbody>
      ${pick.map(m => `<tr><td><div class="name">${esc(m.name)}</div><div class="sub mono">${esc(m.code)}</div></td><td class="fg2">${AREA[areaOfMod(m)]}</td>
        <td>${availTag(avail(m))}</td><td class="r num">${m.ects ?? "?"}</td>
        <td class="r"><button class="btn sm" data-add="${esc(m.code)}">${icon("plus").replace("<svg", '<svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.5"')}Add</button></td></tr>`).join("") || '<tr><td colspan="5" class="empty">No module matches these filters</td></tr>'}
      </tbody></table></div>
  </div>`;
}

function bindPlanner(root) {
  root.querySelectorAll("[data-bucket]").forEach(b => b.onclick = () => { st.bucket = b.dataset.bucket; st.f.planner = null; save(); render(); });
  root.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { st.f.planner[b.dataset.f] = b.dataset.v; render(); });
  const q = root.querySelector("[data-q]");
  if (q) q.oninput = e => { st.f.planner.q = e.target.value.trim().toLowerCase(); render(); const n = $("[data-q]"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  root.querySelectorAll("[data-add]").forEach(b => b.onclick = () => { st.extra[st.bucket].push(b.dataset.add); save(); render(); });
  root.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { st.extra[st.bucket] = st.extra[st.bucket].filter(c => c !== b.dataset.rm); save(); render(); });
  root.querySelectorAll("[data-off]").forEach(b => b.onchange = () => {
    const c = b.dataset.off; st.off = b.checked ? st.off.filter(x => x !== c) : [...st.off, c]; save(); render(); });
}
