# Game Catalog

A personal, self-owned archive of every game I've finished. Static site, no build step, deployable to GitHub Pages. My data lives in one file (`games.json`) that the site reads at load; cover art and missing metadata are pulled from the [RAWG](https://rawg.io) API at runtime and cached in the browser.

## File layout

```
game-catalog/
├── index.html          # markup + control bar
├── css/
│   └── styles.css      # dark theme, grid + table styling
├── js/
│   ├── rawg.js         # RAWG lookup + localStorage cache (global: RAWG)
│   └── app.js          # load, render, sort/filter/search, enrichment
├── games.json          # <-- your data. The ONLY file you edit to add games.
├── DATA_NOTES.md       # provenance + decisions behind games.json
└── README.md
```

Design and data are decoupled: the site never hard-codes a game. Restyle by editing `css/styles.css` (or the markup) without touching your records.

## Running it

`games.json` is loaded with `fetch()`, which browsers block when you open `index.html` directly from disk (`file://`). Use any static server:

```bash
# from inside game-catalog/
python3 -m http.server 8000
# then open http://localhost:8000
```

or `npx serve`, or the VS Code "Live Server" extension. On GitHub Pages it just works.

## The RAWG API key

Covers and genre/year enrichment need a free RAWG key.

1. Sign up at https://rawg.io/apidocs and copy your key.
2. Open the site, click **API key** (top right), paste it.

The key is stored only in your browser's `localStorage` (nothing is committed to the repo, safe for a public GitHub Pages site). Enter it once per browser. Click **API key** again anytime to change or clear it.

Without a key the site still works — you get placeholder covers and no genre filter.

### How caching works

Every RAWG lookup (hits and misses) is cached in `localStorage` under `gc_rawg_cache_v1`, keyed by a normalized title. Subsequent loads don't touch the network. Changing the key clears the cache and re-fetches. To force a full refresh, clear site data in your browser, or in the console: `RAWG.clearCache()`.

## Deploy to GitHub Pages

1. Create a repo and push this folder's contents to the root (or a `/docs` folder).
2. Repo **Settings → Pages** → Source: your branch, root (or `/docs`).
3. Visit the published URL and add your RAWG key.

```bash
git init
git add .
git commit -m "Initial game catalog"
git branch -M main
git remote add origin git@github.com:YOU/game-catalog.git
git push -u origin main
```

## Adding a new finished game

Append one object to the array in `games.json`, then commit and push:

```json
{
  "title": "Hollow Knight",
  "studio": "Team Cherry",
  "platform": "PC",
  "date": "2026-07-09",
  "year": "",
  "rating": "5",
  "hours": "38",
  "note": "Radiance took a week"
}
```

Only `title` and `platform` are really needed; leave the rest blank (`""`) and RAWG fills covers/genre/release-year at load. Save the file, refresh — new entry appears. That's the whole workflow.

Tip: keep the array valid JSON (commas between objects, no trailing comma after the last one). Sort order in the file doesn't matter; the site sorts on its own.

## games.json schema

An array of objects. Every field is a string.

| Field      | Meaning | Notes |
|------------|---------|-------|
| `title`    | Game name | Used as the RAWG search term. |
| `studio`   | Developer | Blank → filled from RAWG at load (not overwritten if present). |
| `platform` | Platform you finished it on | Drives the platform filter and card badge. |
| `date`     | Completion date | ISO `YYYY-MM-DD`. May be a bare year (`"2017"`) or blank. |
| `year`     | Release year | Blank → filled from RAWG. Derived/separate from `date`. |
| `rating`   | Your score | Numeric `0`–`5` (string). Blank = unrated. Shown as stars. |
| `hours`    | Playtime | Numeric string. Blank = unknown. |
| `note`     | Freeform note | Optional. |

Notes:
- **Undated games** (blank or year-only `date`) always sort to the bottom under "Completed" order, and appear under the **Undated** option in the Year filter.
- **Duplicates are intentional and kept** — the same game on two platforms, remasters vs originals, and different games sharing a name are all separate rows. The site never dedupes. See `DATA_NOTES.md`.
- **Manual cover override:** if RAWG can't match a retro/Japanese/arcade title cleanly, add a `"cover"` field with a direct image URL to that entry. The site uses it as-is and never overwrites it. Example:

  ```json
  { "title": "X-Men vs. Street Fighter", "platform": "Sega Saturn",
    "cover": "https://example.com/xmvsf.jpg" }
  ```

## Features

- Cover-art grid (default) and sortable table/list view.
- Sort by completion date, release year, title, rating, or hours.
- Filter by platform, genre, and year (+ an Undated bucket).
- Live title search.
- Header stats: total finished, count this year, number of platforms, year span, and top platform.
- Genre filter populates progressively as RAWG data loads.
- Responsive; works on phones. Dark theme.

## Resetting

- **Reset** button clears search/sort/filters.
- Clear the RAWG key or cache from the **API key** button / browser site-data.
