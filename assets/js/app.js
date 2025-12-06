async function loadData() {
  // By default this dashboard expects the scraper data to be available at ../bf_foot_scraper/data/standings.json
  const resp = await fetch('../bf_foot_scraper/data/standings.json');
  if (!resp.ok) throw new Error('Failed to fetch data: ' + resp.status);
  return resp.json();
}

function createCheckbox(id, label) {
  const wrapper = document.createElement('div');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.id = id;
  const lb = document.createElement('label');
  lb.htmlFor = id;
  lb.textContent = label;
  wrapper.appendChild(cb);
  wrapper.appendChild(lb);
  return { wrapper, cb };
}

function buildTable(clubs) {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Pos</th><th>Club</th><th>Pts</th><th>P</th><th>GD</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  clubs.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${c.position||''}</td><td>${c.name}</td><td>${c.points||''}</td><td>${c.played||''}</td><td>${c.goal_difference||''}</td><td>${c.wins||''}</td><td>${c.draws||''}</td><td>${c.losses||''}</td><td>${c.goals_for||''}</td><td>${c.goals_against||''}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

function prepareDatasets(dates, snapshots, selectedClubs) {
  const clubMap = {};
  // build per-club positions array
  selectedClubs.forEach(name => { clubMap[name] = Array(dates.length).fill(null); });

  snapshots.forEach((snap, i) => {
    snap.clubs.forEach(c => {
      if (clubMap[c.name]) clubMap[c.name][i] = c.position;
    });
  });

  const colors = ['#e6194b','#3cb44b','#ffe119','#4363d8','#f58231','#911eb4','#46f0f0','#f032e6','#bcf60c','#fabebe'];
  const datasets = Object.keys(clubMap).map((name, idx) => ({
    label: name,
    data: clubMap[name],
    borderColor: colors[idx % colors.length],
    fill: false,
    tension: 0.2,
  }));
  return datasets;
}

function makeChart(ctx, labels, datasets) {
  return new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      scales: {
        y: {
          reverse: true,
          beginAtZero: false,
          ticks: { stepSize: 1 }
        }
      },
      plugins: { legend: { position: 'bottom' } },
      interaction: { mode: 'nearest', axis: 'x', intersect: false }
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const db = await loadData();
    const seasonSelect = document.getElementById('seasonSelect');
    const clubFilter = document.getElementById('clubFilter');
    const clubsContainer = document.getElementById('clubs');
    const tableContainer = document.getElementById('tableContainer');
    const ctx = document.getElementById('chart').getContext('2d');
    let chart = null;

    const seasons = Object.keys(db).sort().reverse();
    seasons.forEach(s => { const opt = document.createElement('option'); opt.value = s; opt.textContent = s; seasonSelect.appendChild(opt); });
    if (seasons.length === 0) throw new Error('No data found in standings.json');

    function renderForSeason(season) {
      const snapshots = db[season];
      const dates = snapshots.map(s => new Date(s.date).toLocaleString());

      // collect unique club names
      const clubNames = Array.from(new Set(snapshots.flatMap(s => s.clubs.map(c => c.name)))).sort();
      clubsContainer.innerHTML = '';
      clubNames.forEach(name => {
        const { wrapper, cb } = createCheckbox('cb_' + name.replace(/[^a-z0-9]/gi,'_'), name);
        clubsContainer.appendChild(wrapper);
        cb.addEventListener('change', updateChart);
      });

      // show latest snapshot as table
      tableContainer.innerHTML = '';
      tableContainer.appendChild(buildTable(snapshots[snapshots.length - 1].clubs));

      function updateChart() {
        const selected = Array.from(clubsContainer.querySelectorAll('input[type=checkbox]'))
          .filter(i => i.checked)
          .map(i => i.nextSibling.textContent);
        const datasets = prepareDatasets(dates, snapshots, selected);
        if (chart) chart.destroy();
        chart = makeChart(ctx, dates, datasets);
      }

      // filter input
      clubFilter.value = '';
      clubFilter.oninput = () => {
        const q = clubFilter.value.toLowerCase();
        Array.from(clubsContainer.children).forEach(div => {
          const label = div.querySelector('label').textContent.toLowerCase();
          div.style.display = label.includes(q) ? '' : 'none';
        });
      };

      // pre-select a few (top 6)
      Array.from(clubsContainer.querySelectorAll('input')).slice(0,6).forEach(i => { i.checked = true; });
      updateChart();
    }

    seasonSelect.addEventListener('change', () => renderForSeason(seasonSelect.value));
    renderForSeason(seasonSelect.value);
  } catch (err) {
    document.body.innerHTML = '<pre style="color:red">' + (err.stack || err) + '</pre>';
  }
});
