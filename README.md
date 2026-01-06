```markdown
# bf_foot_dashboard

Static dashboard that visualizes Ligue 1 standings data from `bf_foot_scraper`.

**Features:**
- Current standings table from FootMercato.net (wins, draws, losses, goals, etc.)
- Position evolution charts from Transfermarkt.fr form tables (when multiple snapshots available)
- Season selector and club filtering

Quick start (local)

1. Make sure the scraper has run and `bf_foot_scraper/data/seasons.json` exists.
2. Serve the `bf_foot` parent folder:

```bash
cd /path/to/bf_foot
./bf_foot_dashboard/server.sh start
# open http://localhost:8080/bf_foot_dashboard in your browser
```

How it works
- `index.html` loads `assets/js/app.js`, which fetches `../bf_foot_scraper/data/seasons.json`
- Automatically detects data type: current standings vs. evolution data
- Shows appropriate UI (table only for current standings, chart + table for evolution)

Data sources
- **FootMercato.net**: Current Ligue 1 standings with full statistics
- **Transfermarkt.fr**: Form tables per matchday (position evolution over time)

Deployment notes
- For GitHub Pages: copy `data/seasons.json` or update fetch URL in `assets/js/app.js`
- The dashboard filters out corrupted data automatically

Deployment notes
- If you want to host the dashboard on GitHub Pages, either:
	- Copy `data/seasons.json` into the dashboard repo (e.g. `bf_foot_dashboard/data/seasons.json`) and keep the relative fetch path, or
	- Update the fetch URL in `assets/js/app.js` to point to a raw GitHub URL for the `seasons.json` file.

Files of interest
- `index.html` — main UI
- `assets/js/app.js` — dashboard logic + Chart.js integration
- `assets/css/style.css` — minimal styling

Customization
- To change where the dashboard reads the JSON, edit the fetch path at the top of `assets/js/app.js`.
- You can improve the chart (tooltips, lines, export) by editing `assets/js/app.js` to add Chart.js plugins or options.

License: MIT

Local server helper

For convenience a small script `server.sh` is provided in this folder to start,
stop and check the status of a simple local HTTP server that serves the
parent `bf_foot` directory (so the dashboard can fetch `../bf_foot_scraper/data/seasons.json`).

Make it executable and use it as follows:

```bash
cd bf_foot_dashboard
chmod +x server.sh
./server.sh start    # start server on port 8080 (default)
./server.sh status   # show status
./server.sh stop     # stop server
```

You can change the port by setting the `PORT` environment variable, for
example:

```bash
PORT=8000 ./server.sh start
```

The script is intentionally simple and shellcheck-friendly; it stores the
server PID in `.server.pid` next to the script.

