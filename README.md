# Green Day Scorecard

Dashboard and balanced scorecard for team **Green Day (U5T1)** in the Cesim Global Challenge (Bull Automotive).
After each round you import the Cesim Results export, and the page updates every KPI, target check and trend chart.
The targets come from our team doc *Green Day: Rules to Win*.

It is a static site: plain HTML, CSS and JavaScript with no build step. It runs on GitHub Pages or Vercel; every push to `main` redeploys.

Three screens:
- **Dashboard** (`#dashboard`): TSR, share price, EPS and profit with trend lines, six key KPIs, the rules check, and charts for TSR vs every team, hybrid sold vs demand, profitability, balance sheet and market share.
- **Balanced scorecard** (`#scorecard`): the four perspectives with actual, target, trend and status for every KPI, and a score of how many KPIs are on target.
- **Data** (`#data`): every stored number per round.

The shared `data/rounds.json` always wins for the rounds it contains, so after a push everyone sees the same numbers; rounds imported only in one browser are kept beside them.

## Put it on GitHub Pages

1. Create a new repository on GitHub, for example `green-day-scorecard`. It can be private if your plan allows Pages on private repos; otherwise use public.
2. Upload the **contents** of this folder (`index.html`, `assets/`, `data/`, `.nojekyll`, `README.md`) to the repository root.
   - Web: **Add file → Upload files**, drag everything in, commit.
   - Or from a terminal inside this folder:
     ```bash
     git init && git add . && git commit -m "Green Day scorecard"
     git branch -M main
     git remote add origin https://github.com/<your-user>/green-day-scorecard.git
     git push -u origin main
     ```
3. In the repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, then branch `main`, folder `/ (root)`, **Save**.
4. After a minute the site is live at `https://<your-user>.github.io/green-day-scorecard/`.

## After every round (about 1 minute)

1. In Cesim open **Results**, select **Universe 5** and the round you just played.
2. Press the **XLS** button at the top right of the results bar. Cesim saves one file, e.g. `results-r01.xls`, that holds every results page: financial statements, ratios, market reports, HR, ESG, production and cost reports.
3. In the scorecard click **Import Cesim export**, choose the round and drop the file in.
4. Check the list of numbers it found. The only field the export never contains is **R&D person-days to hybrid** (it is our own decision); add it with **Edit numbers**.
5. Click **Save to round**.

Tested on the real practice round 2 export: it reads TSR for all five teams, share price, EPS, EBITDA %, ROCE, equity ratio, ESG, revenue, profit, cash, both debts, inventory, dividends paid, HR efficiency, turnover, market shares, prices, features, sold and demand for every area, capacity used and ending stock.

## Sharing the numbers with the team

Imported numbers are saved in **your browser only**. To give everyone the same data:

1. **Data → Download data.json**.
2. In the repository, replace `data/rounds.json` with that file and commit.
3. Teammates who open the site for the first time load `data/rounds.json` automatically. Anyone who already has data in their browser can use **Data → Load data.json**, or **Clear all data** and reload.

## If the import finds nothing

- The parser looks for a column headed exactly with our team name. If Cesim shows the team as something other than `Green Day`, type that name in the import dialog.
- Every number can be entered by hand with **Edit numbers**. Money is in **k USD**, exactly as Cesim prints it.

## What it tracks

| Perspective | KPIs and targets |
| --- | --- |
| Financial | TSR p.a. ≥ 40% and rank 1 · EPS up every round · EBITDA ≥ 22% · ROCE ≥ 30% · equity ratio 45–60% · short-term debt 0 · dividend 0.8–1.0 USD per share and never above profit |
| Customer & market | Hybrid price at or above rivals · ≥ 4 hybrid features · Europe hybrid ≥ 95% of demand served · service level ≥ 97% · Europe share ≥ 25% · ESG ≥ 3.2 |
| Internal process | Ending inventory ≤ 3% of cars sold · China capacity 85–92% · USA and China hybrid ≥ 95% served · USA capacity shown for information only |
| Learning & growth | 100% of R&D to hybrid until the R5 gate · R&D efficiency ≥ 1.05 · staff turnover ≤ 5% |

Targets live in `assets/kpis.js` (`SCORECARD` and `RULE_CHECKS`) if the team agrees to change them.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page layout and dialogs |
| `assets/kpis.js` | KPI list, targets, derived values (service level, price premium, rank) |
| `assets/parser.js` | Reads Cesim XLS / XLSX / HTML exports with SheetJS |
| `assets/charts.js` | SVG line charts and the sold-vs-demand bars |
| `assets/app.js` | State, storage, rendering, import and edit |
| `assets/demo.js` | Practice-round numbers for **Data → Load practice-round demo** |
| `data/rounds.json` | Shared team data, committed after each round |
