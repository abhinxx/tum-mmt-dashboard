# MMT semester dashboard (WiSe 2026/27)

A static one-page dashboard for an M.Sc. Management and Technology (HEC double degree) semester. It shows:
- credits planned vs. required
- exam registration and deregistration deadlines
- a calendar with an .ics export
- the Innovation & Entrepreneurship, Computer Engineering and Informatics module catalogues, split by registration status
- direct links to TUMonline, Moodle and lecturer contact cards

## Files
- `index.html`, `app.css`, `app.js`, `planner.js`, `views.js`: the dashboard (no build step). Views: Overview, Planner, To do, My courses, Calendar, Catalogue, Links. Planner choices and done to-dos are saved in the browser (localStorage).
- `data/plan.json`: the personal semester plan and exam windows, read from TUMonline by hand.
- `data/public.json`, `data/calendar.json`: generated from TUMonline's public course, curriculum and module-handbook data.
- `scripts/fetch_public.py`: regenerates the two generated files (no login needed).

## Refresh
```
python3 scripts/fetch_public.py   # then commit + push
```
