# MMT semester dashboard (WiSe 2026/27)

A static one-page dashboard for an M.Sc. Management and Technology (HEC double degree) semester. It shows:
- credits planned vs. required
- exam registration and deregistration deadlines
- a calendar with an .ics export
- the Innovation & Entrepreneurship, Computer Engineering and Informatics module catalogues, split by registration status
- direct links to TUMonline, Moodle and lecturer contact cards

## Files
- `index.html`: the dashboard (no build step).
- `data/plan.json`: the personal semester plan and exam windows, read from TUMonline by hand.
- `data/public.json`, `data/calendar.json`: generated from TUMonline's public course, curriculum and module-handbook data.
- `scripts/fetch_public.py`: regenerates the two generated files (no login needed).

## Refresh
```
python3 scripts/fetch_public.py   # then commit + push
```
