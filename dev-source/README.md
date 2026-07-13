# DEVARIX — Network Diversity Assurance Platform

A React + Vite application for scoring, reviewing, and funding network path diversity across a global enterprise. Demo build with synthetic data.

## What's inside

| View | What it does |
|---|---|
| Portfolio | 180-site global dashboard: grade distribution, worst-first site list with region/rating/tier filters, remediation program queue ranked by weighted score recovery |
| Site scorer | Interactive single-site assessment across six weighted domains (local loop 25%, backbone 20%, wire center 10%, data center 15%, hardware 15%, cloud 15%) with live composite score and risk flags |
| Site drill-down | Circuit relationship records with AS paths, path topology diagram showing carrier-hotel convergence, design assumption ledger with evidence status |
| Intake & validation | Site address record, circuit inventory validation (including type II carrier-mismatch detection), building entry points, working Telcordia circuit ID parser |
| Outage TCO | Interactive calculator: outage exposure vs remediation cost, payback period, 3-year net benefit |
| Reports | Standardized report catalog plus a rendered executive scorecard preview generated from live portfolio data |

## Project structure

```
src/
  App.jsx                 Sidebar navigation and view routing
  main.jsx                React entry point
  styles.css              Design system (tokens, layout, components)
  lib/
    scoringModel.js       Domains, weighted criteria, grade bands, score math
    syntheticData.js      Seeded 180-site portfolio generator
    circuitParser.js      Telcordia CLCI format detection and CLLI lookup
  components/
    ui.jsx                Shared metric card, pill, score bar, page header
  views/
    Dashboard.jsx         Portfolio review
    Scorer.jsx            Single-site scorer
    SiteDetail.jsx        Circuit relationships and assumption ledger
    Intake.jsx            Intake, validation, circuit ID parser
    Tco.jsx               Outage cost calculator
    Reports.jsx           Report catalog and scorecard preview
```

## Run locally (optional)

Requires Node 18+.

```
npm install
npm run dev
```

Open http://localhost:5173

## Deploy: GitHub Desktop → Railway

**1. Put it on GitHub**
1. Unzip this folder somewhere permanent (e.g. Documents/projects).
2. In GitHub Desktop: File → Add local repository → choose this folder. If it says the folder isn't a repository, click "create a repository" in that same dialog, then Create.
3. Write a commit message like "initial build" and click Commit to main.
4. Click Publish repository (keep it private if you want).

**2. Deploy on Railway**
1. In Railway: New Project → Deploy from GitHub repo → pick this repository.
2. Railway detects the Dockerfile automatically and builds — no settings needed.
3. When the deploy finishes, open the service → Settings → Networking → Generate Domain.
4. Open the generated URL. Done.

**Making changes later:** edit files, then in GitHub Desktop commit and push. Railway redeploys automatically on every push to main.

## How it deploys

The included `Dockerfile` builds the Vite app and serves the static `dist/` folder with `serve`, honoring Railway's `$PORT`. If you delete the Dockerfile, Railway's Nixpacks will still work: it runs `npm run build` then `npm start`, which do the same thing.

## Notes

- All data is synthetic and generated deterministically (seeded) so the demo is stable across reloads.
- Carrier names are genericized and ASNs use private ranges (64512+); circuit IDs and CLLIs are illustrative.
- No backend, no database, no persistence — this is the UI layer. The natural next step is swapping `lib/syntheticData.js` for an API.
