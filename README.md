# Pathstead Network Diversity Dashboard

Pre-built, self-contained deployment. The entire application lives in one file: `index.html`. There is no build step — Railway just serves it.

## Files that matter for deployment

```
index.html      The complete app (code and styles compiled in)
package.json    Tells Railway how to serve it
Dockerfile      Deterministic Railway build (used automatically)
dev-source/     The editable source code — NOT needed for deployment
```

## Deploy: GitHub Desktop → Railway

**1. Replace the repo contents**
1. In GitHub Desktop: Repository → Show in Explorer (or Finder) to open your repo folder.
2. Delete everything visible in the folder (the hidden .git folder stays — that's fine).
3. Copy everything from this zip into the folder: index.html, package.json, Dockerfile, README.md, .gitignore, and the dev-source folder.
4. In GitHub Desktop: commit ("prebuilt deployment") and Push origin.

**2. Railway**
- Railway redeploys automatically on push. The Dockerfile copies index.html and serves it — nothing to resolve, nothing to compile.
- If you haven't yet: open the service → Settings → Networking → Generate Domain.

## Verifying it worked

The Railway build log should be tiny — no "vite build", no "transforming modules". Just an npm install of the server and done. Open the domain and you'll see the PATHSTEAD sidebar with six views.

## Making changes later

The editable React source is in `dev-source/`. When you want to change the app:
1. Ask Claude (or Claude Code) to edit files in dev-source and rebuild.
2. Rebuilding produces a new single index.html (via `npm run build` inside dev-source — the config inlines everything).
3. Replace the top-level index.html with the new one, commit, push. Railway redeploys.

Railway ignores dev-source entirely — the Dockerfile only copies index.html.
