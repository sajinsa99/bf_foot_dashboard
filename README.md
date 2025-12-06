```markdown
# bf_foot_dashboard

This repository is a small static dashboard that visualizes the evolution of the
Ligue 1 standings using snapshots produced by `bf_foot_scraper`.

How it works
- The dashboard expects the scraper output to be available at `../bf_foot_scraper/data/standings.json`.
- Open `index.html` served from a static server (see notes) to interact with the charts.

# bf_foot_dashboard

Static dashboard that visualizes the evolution of Ligue 1 standings using the
snapshots produced by `bf_foot_scraper`.

Quick start (local)

1. Make sure the scraper has run at least once and `bf_foot_scraper/data/standings.json` exists.
2. Serve the `bf_foot` parent folder so the dashboard can fetch the JSON using a relative path:

```bash
cd /path/to/bf_foot
python3 -m http.server 8080
# open http://localhost:8080/bf_foot_dashboard in your browser
```

How it works
- `index.html` loads `assets/js/app.js`, which fetches `../bf_foot_scraper/data/standings.json` by default.
- The UI provides a season selector, club filter / selector, and a Chart.js line chart showing club positions over time (Y is inverted so 1 is at the top).

Deployment notes
- If you want to host the dashboard on GitHub Pages, either:
	- Copy `data/standings.json` into the dashboard repo (e.g. `bf_foot_dashboard/data/standings.json`) and keep the relative fetch path, or
	- Update the fetch URL in `assets/js/app.js` to point to a raw GitHub URL for the `standings.json` file.

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
parent `bf_foot` directory (so the dashboard can fetch `../bf_foot_scraper/data/standings.json`).

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

