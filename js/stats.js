// js/stats.js — Statistiche con Chart.js

const _STAT_TAG_COLORS = {
  'Autonomia':     '#7A9BB5',
  'Comunicazione': '#9B7AB5',
  'Relazione':     '#B57A9B',
  'Apprendimento': '#6B8F71',
  'Comportamento': '#B5956B',
  'Progresso':     '#5B9B8B',
  'Difficoltà':    '#B5736B'
};
const _STAT_TAGS = Object.keys(_STAT_TAG_COLORS);

let _statsStudentId = null;
let _chartTagInst   = null;
let _chartSubjInst  = null;

// -----------------------------------------------------------------
// Tab principale Statistiche
// -----------------------------------------------------------------
async function renderStats() {
  const el = document.getElementById('tab-statistiche');
  el.innerHTML = '<div style="display:flex;justify-content:center;padding-top:80px"><div class="spinner"></div></div>';

  const students = await Students.getAll(false);

  if (students.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <div class="empty-title">Nessuno studente</div>
        <div class="empty-text">Aggiungi studenti e osservazioni per vedere le statistiche.</div>
      </div>`;
    return;
  }

  // Ripristina l'ultimo studente selezionato
  const saved = parseInt(localStorage.getItem('ds_stats_student') || '0');
  if (saved && students.find(s => s.id === saved)) {
    _statsStudentId = saved;
  } else {
    _statsStudentId = students[0].id;
  }

  const chipsHTML = students.map(s => `
    <button class="filter-chip ${s.id === _statsStudentId ? 'active' : ''}" data-ssid="${s.id}">
      ${_stEsc(s.pseudonym)}
    </button>`).join('');

  el.innerHTML = `
    <div class="filter-bar" id="stats-chips">${chipsHTML}</div>
    <div id="stats-content"></div>`;

  el.querySelectorAll('[data-ssid]').forEach(chip => {
    chip.addEventListener('click', async () => {
      _statsStudentId = parseInt(chip.dataset.ssid);
      localStorage.setItem('ds_stats_student', _statsStudentId);
      el.querySelectorAll('[data-ssid]').forEach(c =>
        c.classList.toggle('active', parseInt(c.dataset.ssid) === _statsStudentId)
      );
      await _renderStatsContent();
    });
  });

  await _renderStatsContent();
}

// -----------------------------------------------------------------
// Contenuto statistiche per lo studente selezionato
// -----------------------------------------------------------------
async function _renderStatsContent() {
  const contentEl = document.getElementById('stats-content');
  if (!contentEl || !_statsStudentId) return;

  contentEl.innerHTML = '<div style="display:flex;justify-content:center;padding:24px"><div class="spinner"></div></div>';

  // Distrugge i grafici precedenti prima di ridisegnare
  if (_chartTagInst)  { _chartTagInst.destroy();  _chartTagInst  = null; }
  if (_chartSubjInst) { _chartSubjInst.destroy(); _chartSubjInst = null; }

  const [student, observations] = await Promise.all([
    Students.get(_statsStudentId),
    Observations.getForStudent(_statsStudentId)
  ]);

  if (!student) return;

  if (observations.length === 0) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <div class="empty-title">Nessun dato ancora</div>
        <div class="empty-text">Aggiungi qualche osservazione per <strong>${_stEsc(student.pseudonym)}</strong> per vedere le statistiche.</div>
      </div>`;
    return;
  }

  // ── Calcoli ──────────────────────────────────────────────────
  const tagCounts = {};
  _STAT_TAGS.forEach(t => { tagCounts[t] = 0; });

  const subjCounts = {};
  let abcCount = 0;

  observations.forEach(obs => {
    (obs.tags || []).forEach(t => {
      if (tagCounts[t] !== undefined) tagCounts[t]++;
    });
    if (obs.subject) subjCounts[obs.subject] = (subjCounts[obs.subject] || 0) + 1;
    if (obs.hasABC) abcCount++;
  });

  // Ultima nota
  const lastObs  = observations.slice().sort((a, b) => b.datetime - a.datetime)[0];
  const lastDate = new Date(lastObs.datetime).toLocaleDateString('it-IT', {
    day: 'numeric', month: 'short'
  });

  // Tag più usato (ignora quelli a zero)
  const topTag = _STAT_TAGS.reduce((best, t) =>
    tagCounts[t] > (tagCounts[best] || 0) ? t : best, _STAT_TAGS[0]
  );
  const topTagLabel = tagCounts[topTag] > 0 ? topTag : '—';

  // Materie ordinate per frequenza (max 8)
  const subjEntries = Object.entries(subjCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // ── HTML ─────────────────────────────────────────────────────
  contentEl.innerHTML = `
    <div style="padding:4px var(--sp-md) var(--sp-lg)">

      <div class="settings-section-title" style="padding-left:0">Riepilogo — ${_stEsc(student.pseudonym)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${_statTile('📝', String(observations.length), 'osservazioni')}
        ${_statTile('🔷', String(abcCount),             'con blocco ABC')}
        ${_statTile('🏷️', topTagLabel,                  'tag più usato')}
        ${_statTile('📅', lastDate,                      'ultima nota')}
      </div>

      <div class="settings-section-title" style="padding-left:0;margin-top:16px">Frequenza tag</div>
      <div style="background:var(--bg-elevated);border-radius:var(--r);padding:16px;box-shadow:var(--shadow)">
        <canvas id="chart-tags" height="190"></canvas>
      </div>

      ${subjEntries.length > 0 ? `
        <div class="settings-section-title" style="padding-left:0;margin-top:16px">Osservazioni per materia</div>
        <div style="background:var(--bg-elevated);border-radius:var(--r);padding:16px;box-shadow:var(--shadow)">
          <canvas id="chart-subj" height="${Math.max(130, subjEntries.length * 34)}"></canvas>
        </div>` : ''}

      <div style="height:16px"></div>
    </div>`;

  // Carica Chart.js (una sola volta) e disegna
  await _loadChartJs();
  _drawTagChart(tagCounts);
  if (subjEntries.length > 0) _drawSubjChart(subjEntries);
}

// -----------------------------------------------------------------
// Tile statistica (piccola card)
// -----------------------------------------------------------------
function _statTile(icon, value, label) {
  return `
    <div style="background:var(--bg-elevated);border-radius:var(--r);padding:12px var(--sp-md);box-shadow:var(--shadow)">
      <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">${label}</div>
      <div style="font-size:17px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:6px;overflow:hidden">
        <span>${icon}</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_stEsc(value)}</span>
      </div>
    </div>`;
}

// -----------------------------------------------------------------
// Grafico a barre verticali — frequenza dei 7 tag
// -----------------------------------------------------------------
function _drawTagChart(tagCounts) {
  const ctx = document.getElementById('chart-tags');
  if (!ctx || !window.Chart) return;

  _chartTagInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: _STAT_TAGS,
      datasets: [{
        data:            _STAT_TAGS.map(t => tagCounts[t]),
        backgroundColor: _STAT_TAGS.map(t => _STAT_TAG_COLORS[t] + 'CC'),
        borderColor:     _STAT_TAGS.map(t => _STAT_TAG_COLORS[t]),
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, font: { size: 11 }, color: '#999994' },
          grid:  { color: 'rgba(0,0,0,0.05)' }
        },
        x: {
          ticks: {
            font: { size: 10 },
            color: '#666660',
            maxRotation: 35,
            minRotation: 20
          },
          grid: { display: false }
        }
      }
    }
  });
}

// -----------------------------------------------------------------
// Grafico a barre orizzontali — osservazioni per materia
// -----------------------------------------------------------------
function _drawSubjChart(subjEntries) {
  const ctx = document.getElementById('chart-subj');
  if (!ctx || !window.Chart) return;

  _chartSubjInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: subjEntries.map(([s]) => s),
      datasets: [{
        data:            subjEntries.map(([, n]) => n),
        backgroundColor: '#6B8F71CC',
        borderColor:     '#6B8F71',
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { stepSize: 1, font: { size: 11 }, color: '#999994' },
          grid:  { color: 'rgba(0,0,0,0.05)' }
        },
        y: {
          ticks: { font: { size: 12 }, color: '#666660' },
          grid:  { display: false }
        }
      }
    }
  });
}

// -----------------------------------------------------------------
// Carica Chart.js dal CDN (una sola volta)
// -----------------------------------------------------------------
function _loadChartJs() {
  return new Promise((resolve, reject) => {
    if (window.Chart) { resolve(); return; }
    const s   = document.createElement('script');
    s.src     = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
    s.onload  = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// -----------------------------------------------------------------
// Utility interna
// -----------------------------------------------------------------
function _stEsc(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
