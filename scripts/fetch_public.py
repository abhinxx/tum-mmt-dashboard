"""Fetch public TUMonline data for the MMT [20251] curriculum (no login needed).

Writes data/public.json: modules in the I&E, Computer Engineering and Informatics
catalogues, with course offerings per term, course-registration status and lecturers.
Run: python3 scripts/fetch_public.py
"""
import json, re, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

REST = "https://campus.tum.de/tumonline/ee/rest"
UI = "https://campus.tum.de/tumonline/ee/ui/ca2/app/desktop/#"
CURRICULUM_VERSION = 5386  # Management and Technology [20251]
TERMS = {207: "WiSe 2026/27", 208: "SoSe 2027", 206: "SoSe 2026"}
OUT = Path(__file__).resolve().parent.parent / "data" / "public.json"


def get(url, accept="application/json"):
    req = urllib.request.Request(url, headers={"Accept": accept, "Accept-Language": "en"})
    with urllib.request.urlopen(req, timeout=90) as r:
        raw = r.read()
    return json.loads(raw) if accept == "application/json" else raw.decode("cp1252" if "vcard" in accept else "utf-8", "replace")


def en(langdata):
    if not isinstance(langdata, dict):
        return langdata
    for t in (langdata.get("translations") or {}).get("translation", []):
        if t.get("lang") == "en" and t.get("value"):
            return t["value"]
    return langdata.get("value")


def list_courses(term):
    out, skip = [], 0
    while True:
        q = urllib.parse.urlencode({
            "$filter": f"courseNormKey-eq=LVEAB;orgId-eq=1;curriculumVersionId-eq={CURRICULUM_VERSION};termId-eq={term}",
            "$top": 100, "$skip": skip})
        d = get(f"{REST}/slc.tm.cp/student/courses?{q}")
        batch = d.get("courses", [])
        out += batch
        skip += len(batch)
        if not batch or skip >= d.get("totalCount", 0):
            return out


def category(names):
    joined = " | ".join(names)
    if "Innovation & Entrepreneurship" in joined:
        return "mgmt_ie"
    if "Computer Engineering" in joined or "Technische Informatik" in joined:
        return "tech_ce"
    if "Informatics" in joined or "Informatik" in joined:
        return "tech_in"
    return None


def positions(course_id):
    d = get(f"{REST}/slc.cm.curriculumposition/positions/{course_id}/course/allCurriculumPositions")
    mods = {}
    for res in d.get("resource", []):
        p = (res.get("content") or {}).get("coCurriculumPositionDto") or {}
        if (p.get("curriculumVersionInfoDto") or {}).get("id") != CURRICULUM_VERSION:
            continue
        path = (p.get("curriculumPositionPathDto") or {}).get("path", [])
        names = [en(n.get("name")) or "" for n in path]
        idx = next((i for i in range(len(path) - 1, -1, -1) if path[i].get("designation")), None)
        if idx is None:
            continue
        mod = path[idx]
        cat = category(names[:idx])  # catalogue names only, not the module title
        if cat:
            code = mod["designation"]
            m = mods.setdefault(code, {"code": code, "name": en(mod.get("name")), "cats": set(), "paths": set(), "node": mod.get("elementId")})
            m["cats"].add(cat)
            m["paths"].add(" > ".join(names[1:idx]))
    return mods


MHB = "https://campus.tum.de/tumonline/WBMODHB.wbShowMHBReadOnly?pKnotenNr={}&pOrgNr=1"


def module_ects(node):
    """ECTS of the exam node in the public module handbook page (None if not found)."""
    try:
        t = get(MHB.format(node), accept="text/html")
    except Exception:
        return None
    t = re.sub(r"<script.*?</script>", "", t, flags=re.S)
    cells = [c.strip() for c in re.sub(r"<[^>]+>", "|", t).split("|") if c.strip()]
    for i, c in enumerate(cells):
        if c.startswith("Prüfungsknoten") or c.startswith("Exam node"):
            for x in cells[i + 1:i + 6]:
                if re.fullmatch(r"\d+(?:[.,]\d+)?", x):
                    return float(x.replace(",", "."))
    return None


VCARD_CACHE = {}


def lecturer(key):
    if key in VCARD_CACHE:
        return VCARD_CACHE[key]
    url = f"https://campus.tum.de/tumonline/pl/ui/$ctx;lang=EN/visitenkarte.vcardExport?pObfuscatedNr={key}&pPersGruppe=3"
    try:
        v = get(url, accept="text/x-vcard")
    except Exception:
        v = ""
    fn = re.search(r"^FN[^:]*:(.*)$", v, re.M)
    em = re.search(r"^EMAIL[^:]*:(.*)$", v, re.M)
    VCARD_CACHE[key] = {
        "name": fn.group(1).strip() if fn else None,
        "email": (em.group(1).strip() or None) if em else None,
        "card": f"https://campus.tum.de/tumonline/pl/ui/$ctx/visitenkarte.dispatcher?pIdentityNrObf={key}",
    }
    return VCARD_CACHE[key]


def lecturer_keys(course):
    keys = []
    for ls in course.get("lectureships") or []:
        ident = ls.get("identityLibDto") or {}
        k = ident.get("obfuscated")
        if isinstance(k, str) and re.fullmatch(r"[0-9A-F]{16}", k):
            keys.append(k)
    if not keys:  # fall back: business-card keys anywhere in the course record
        keys = re.findall(r"business-card/([0-9A-F]{16})", json.dumps(course))
    return list(dict.fromkeys(keys))


def main():
    courses = {}
    for term, label in TERMS.items():
        cs = list_courses(term)
        print(f"term {label}: {len(cs)} courses", file=sys.stderr)
        for c in cs:
            courses[c["id"]] = (term, c)

    with ThreadPoolExecutor(12) as ex:
        pos = dict(zip(courses, ex.map(positions, courses)))

    modules = {}
    for cid, mods in pos.items():
        term, c = courses[cid]
        for code, m in mods.items():
            mod = modules.setdefault(code, {"code": code, "name": m["name"], "cats": set(), "paths": set(), "offerings": [], "node": m["node"]})
            mod["cats"] |= m["cats"]
            mod["paths"] |= m["paths"]
            mod["offerings"].append({
                "term": TERMS[term], "termId": term, "courseId": cid,
                "title": en(c.get("courseTitle")),
                "type": (c.get("courseTypeDto") or {}).get("key"),
                "registration": en(c.get("registrationInfo")),
                "lecturerKeys": lecturer_keys(c),
                "url": f"{UI}/slc.tm.cp/student/courses/{cid}?$ctx=lang=EN",
                "registrationUrl": f"{UI}/slc.tm.cp/student/courses/{cid}/registration?$ctx=lang=EN",
            })

    with ThreadPoolExecutor(12) as ex:
        for m, ects in zip(modules.values(), ex.map(module_ects, [m["node"] for m in modules.values()])):
            m["ects"] = ects
            m["handbook"] = MHB.format(m["node"])

    keys = {k for m in modules.values() for o in m["offerings"] for k in o["lecturerKeys"]}
    with ThreadPoolExecutor(12) as ex:
        list(ex.map(lecturer, keys))
    for m in modules.values():
        for o in m["offerings"]:
            o["lecturers"] = [VCARD_CACHE[k] for k in o.pop("lecturerKeys")]
        m["cats"], m["paths"] = sorted(m["cats"]), sorted(m["paths"])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(sorted(modules.values(), key=lambda m: m["code"]), indent=1, ensure_ascii=False))
    print(f"wrote {OUT} with {len(modules)} modules, {len(keys)} lecturers", file=sys.stderr)


def plan_calendar():
    """Lecture appointments + lecturers for the courses in data/plan.json."""
    plan = json.loads((OUT.parent / "plan.json").read_text())
    events, lecturers = [], {}
    for c in plan["courses"]:
        for cid in c.get("courseIds", []):
            d = get(f"{REST}/slc.tm.cp/student/courseGroups/firstGroups/{cid}")
            raw = json.dumps(d)
            keys = list(dict.fromkeys(re.findall(r'"obfuscated": "([0-9A-F]{16})"', raw)))
            lecturers.setdefault(c["code"], [])
            for k in keys:
                if k not in [x["key"] for x in lecturers[c["code"]]]:
                    lecturers[c["code"]].append({"key": k, **lecturer(k)})

            def walk(o):
                if isinstance(o, dict):
                    if "timestampFrom" in o and "timestampTo" in o:
                        f, t = o["timestampFrom"].get("value"), o["timestampTo"].get("value")
                        room = o.get("resourceName")
                        if f:
                            events.append({"code": c["code"], "start": f, "end": t, "room": room, "courseId": cid})
                    for v in o.values():
                        walk(v)
                elif isinstance(o, list):
                    for v in o:
                        walk(v)
            walk(d)
    uniq = {(e["code"], e["start"]): e for e in events}
    for v in lecturers.values():
        for x in v:
            x.pop("key", None)
    (OUT.parent / "calendar.json").write_text(json.dumps(
        {"lectures": sorted(uniq.values(), key=lambda e: e["start"]), "lecturers": lecturers}, indent=1, ensure_ascii=False))
    print(f"wrote calendar.json with {len(uniq)} appointments", file=sys.stderr)


if __name__ == "__main__":
    if "--calendar-only" not in sys.argv:
        main()
    plan_calendar()
