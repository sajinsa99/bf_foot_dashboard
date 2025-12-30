async function loadData() {
  // By default this dashboard expects the scraper data to be available at ../bf_foot_scraper/data/standings.json
  const resp = await fetch('http://localhost:8080/bf_foot_scraper/data/standings.json');
  if (!resp.ok) throw new Error('Failed to fetch data: ' + resp.status);
  const data = await resp.json();
  return data;
}

function isValidClub(club) {
  // Filter out corrupted data (UI elements, invalid names)
  if (!club || !club.name) return false;
  
  // Reject UI elements and corrupted data
  if (club.name.includes('Sélectionner') || 
      club.name.includes('Journée') || 
      club.name.length < 3 ||
      club.position === null || 
      club.position === undefined ||
      typeof club.position !== 'number' ||
      club.position < 1 ||
      club.position > 20) {  // Ligue 1 has max 20 teams
    return false;
  }
  
  return true;
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
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          bottom: 5
        }
      },
      scales: {
        y: {
          reverse: true,
          beginAtZero: false,
          min: 1,
          max: 18,
          ticks: { 
            stepSize: 1,
            padding: 5
          },
          title: {
            display: true,
            text: 'Position (1 = best)'
          }
        },
        x: {
          title: {
            display: false
          },
          ticks: {
            maxRotation: 0,
            minRotation: 0,
            font: { size: 10 },
            maxTicksLimit: 6
          }
        }
      },
      plugins: { 
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': Position ' + context.parsed.y;
            }
          }
        }
      },
      interaction: { mode: 'nearest', axis: 'x', intersect: false }
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const db = await loadData();
    console.log('Data loaded:', Object.keys(db));
    const seasonSelect = document.getElementById('seasonSelect');
    if (!seasonSelect) throw new Error('seasonSelect element not found');
    const standingsTypeSelect = document.getElementById('standingsTypeSelect');
    if (!standingsTypeSelect) throw new Error('standingsTypeSelect element not found');
    const clubFilter = document.getElementById('clubFilter');
    const clubsContainer = document.getElementById('clubs');
    const tableContainer = document.getElementById('tableContainer');
    const ctx = document.getElementById('chart').getContext('2d');
    let chart = null;
    let isFirstLoad = true;
    let selectedClubs = new Set();

    const seasons = Object.keys(db).sort().reverse();
    console.log('Seasons:', seasons);
    seasons.forEach(s => { 
      const opt = document.createElement('option'); 
      opt.value = s; 
      opt.textContent = s; 
      seasonSelect.appendChild(opt); 
    });
    console.log('Seasons dropdown populated:', seasonSelect.options.length);
    if (seasons.length === 0) throw new Error('No data found in standings.json');

    function renderForSeason(season, overrideSnapshots = null, standingsType = 'general') {
      let snapshots = overrideSnapshots || (season ? db[season] : []);
      
      // Filter by standings type
      snapshots = snapshots.filter(snap => 
        !snap.standings_type || snap.standings_type === standingsType
      );
      snapshots = snapshots.filter(snap => 
        snap.clubs && snap.clubs.some(c => isValidClub(c))
      ).map(snap => ({
        ...snap,
        clubs: snap.clubs.filter(c => isValidClub(c))
      })).sort((a, b) => (a.round || 0) - (b.round || 0));
      
      if (snapshots.length === 0) {
        tableContainer.innerHTML = '<p>No data available for this season.</p>';
        clubsContainer.innerHTML = '';
        if (chart) chart.destroy();
        return;
      }

      // Determine data type: evolution (multiple snapshots) vs current standings (single snapshot)
      const isEvolutionData = snapshots.length > 1;

      // If snapshots include season info (cross-season), use season as X axis
      // Otherwise fall back to date or round
      const useSeasonLabels = snapshots.length > 0 && snapshots.every(s => s.season) && new Set(snapshots.map(s => s.season)).size > 1;
      const hasRoundData = snapshots.length > 0 && snapshots.some(s => s.round !== undefined && s.round !== null);

      const dates = useSeasonLabels
        ? snapshots.map(s => s.season)
        : hasRoundData
        ? snapshots.map((s, i) => s.round ? `Journée ${s.round}` : `Snapshot ${i + 1}`)
        : snapshots.length > 1
        ? snapshots.map((s, i) => `Journée ${i + 1}`)
        : snapshots.map(s => new Date(s.date).toLocaleString());

      // collect unique club names
      const clubNames = Array.from(new Set(snapshots.flatMap(s => (s.clubs && Array.isArray(s.clubs)) ? s.clubs.map(c => c.name) : []))).sort();
      clubsContainer.innerHTML = '';
      
      if (isEvolutionData) {
        // Show checkboxes for chart selection
        clubNames.forEach(name => {
          const { wrapper, cb } = createCheckbox('cb_' + name.replace(/[^a-z0-9]/gi,'_'), name);
          clubsContainer.appendChild(wrapper);
          cb.addEventListener('change', updateChart);
        });
      } else {
        // Single snapshot - show table only
        clubsContainer.innerHTML = '<p>Current standings (single snapshot)</p>';
      }

      // show latest snapshot as table
      tableContainer.innerHTML = '';
      const latestSnapshot = snapshots[snapshots.length - 1];
      if (latestSnapshot && latestSnapshot.clubs && latestSnapshot.clubs.length > 0) {
        tableContainer.appendChild(buildTable(latestSnapshot.clubs));
      } else {
        tableContainer.innerHTML = '<p>No table data available</p>';
      }

      function updateChart() {
        if (!isEvolutionData) return;
        const selected = Array.from(clubsContainer.querySelectorAll('input[type=checkbox]'))
          .filter(i => i.checked)
          .map(i => i.nextSibling.textContent);
        const datasets = prepareDatasets(dates, snapshots, selected);
        if (chart) chart.destroy();
        chart = makeChart(ctx, dates, datasets);
      }

      if (isEvolutionData) {
        // Show chart and filter elements
        document.getElementById('chartContainer').style.display = '';
        document.getElementById('clubFilter').style.display = '';
        document.querySelector('label[for="clubFilter"]').style.display = '';
        
        // filter input
        clubFilter.value = '';
        clubFilter.oninput = () => {
          const q = clubFilter.value.toLowerCase();
          Array.from(clubsContainer.children).forEach(div => {
            const label = div.querySelector('label').textContent.toLowerCase();
            div.style.display = label.includes(q) ? '' : 'none';
          });
        };

        // Restore previous selections or pre-select PSG and Marseille on first load
        Array.from(clubsContainer.querySelectorAll('input[type="checkbox"]')).forEach(cb => {
          const label = cb.nextSibling.textContent;
          if (selectedClubs.has(label)) {
            cb.checked = true;
          } else if (isFirstLoad && (label === 'Paris SG' || label === 'Marseille')) {
            cb.checked = true;
          }
        });
        
        // Save selections after rendering
        Array.from(clubsContainer.querySelectorAll('input[type="checkbox"]')).forEach(cb => {
          cb.addEventListener('change', () => {
            selectedClubs = new Set(Array.from(clubsContainer.querySelectorAll('input[type="checkbox"]'))
              .filter(c => c.checked)
              .map(c => c.nextSibling.textContent));
          });
        });
        
        isFirstLoad = false;
        updateChart();
      } else {
        // Hide chart for single snapshot
        if (chart) chart.destroy();
        document.getElementById('chartContainer').style.display = 'none';
        document.getElementById('clubFilter').style.display = 'none';
        document.querySelector('label[for="clubFilter"]').style.display = 'none';
      }
    }

    if (seasons.length === 0) throw new Error('No data found in standings.json');

    // Default to cross-season evolution view
    const defaultToCrossSeason = () => {
      const allSeasons = Object.keys(db).sort().reverse();
      const crossSeasonSnapshots = [];
      
      allSeasons.forEach(seasonKey => {
        const seasonSnapshots = db[seasonKey].filter(snap =>
          snap.clubs && snap.clubs.some(c => isValidClub(c))
        ).map(snap => ({
          ...snap,
          clubs: snap.clubs.filter(c => isValidClub(c))
        }));
        
        if (seasonSnapshots.length > 0) {
          const finalSnapshot = seasonSnapshots[seasonSnapshots.length - 1];
          crossSeasonSnapshots.push({
            ...finalSnapshot,
            season: seasonKey,
            date: finalSnapshot.date,
            cross_season: true
          });
        }
      });
      
      if (crossSeasonSnapshots.length > 1) {
        renderForSeason(null, crossSeasonSnapshots);
      } else {
        // Fallback to latest season if cross-season not available
        renderForSeason(seasonSelect.value || seasons[0]);
      }
    };

    seasonSelect.addEventListener('change', () => renderForSeason(seasonSelect.value, null, standingsTypeSelect.value));
    standingsTypeSelect.addEventListener('change', () => renderForSeason(seasonSelect.value, null, standingsTypeSelect.value));
    // Default to latest season with general standings
    renderForSeason(seasons[0], null, 'general');
  } catch (err) {
    document.body.innerHTML = '<pre style="color:red">' + (err.stack || err) + '</pre>';
  }
});
