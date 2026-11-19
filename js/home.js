// js/home.js — Schermata Home

const _DEADLINE_LABELS = {
  glo_i: 'GLO Iniziale',
  glo_m: 'GLO Intermedio',
  glo_f: 'GLO Finale',
  pei:   'Verifica PEI'
};

async function renderHome() {
  const el = document.getElementById('tab-home');

  // Carica dati in parallelo
  const [students, deadlines] = await Promise.all([
    Students.getAll(false),
    Deadlines.getAll()
  ]);

  // Data installazione (imposta al primo avvio se manca)
  let installDate = await Settings.get('install_date');
  if (!installDate) {
    installDate = Date.now();
    await Settings.set('install_date', installDate);
  }

  // Promemoria backup (dopo 14 giorni dall'ultimo backup o dall'installazione)
  const lastBackup = await Settings.get('last_backup');
  const refDate    = lastBackup || installDate;
  const daysSince  = (Date.now() - refDate) / 86400000;
  const showBackupAlert = daysSince > 14;

  // Scadenze nei prossimi 14 giorni
  const now   = Date.now();
  const in14  = now + 14 * 86400000;
  const upcoming = deadlines
    .filter(d => {
      const ts = new Date(d.date + 'T00:00:00').getTime();
      return ts >= now && ts <= in14;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Mappa id → studente per le scadenze
  const allStudents = await Students.getAll(true);
  const studentMap  = {};
  allStudents.forEach(s => { studentMap[s.id] = s; });

  // Data odierna in italiano
  const todayStr = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  const todayLabel = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);

  el.innerHTML = `
    <div class="home-header">
      <div class="home-greeting">📒 Diario di Sostegno</div>
      <div class="home-date">${todayLabel}</div>
    </div>

    ${showBackupAlert ? `
      <div style="padding:0 var(--sp-md) var(--sp-sm)">
        <div class="alert alert--warning">
          <span>💾</span>
          <span>Nessun backup da più di 14 giorni. Vai in <strong>Impostazioni → Esporta backup</strong> per salvare i dati.</span>
        </div>
      </div>` : ''}

    ${upcoming.length > 0 ? `
      <div class="section-label">Scadenze in arrivo</div>
      <div style="padding:0 var(--sp-md);display:flex;flex-direction:column;gap:8px;margin-bottom:4px">
        ${upcoming.map(d => {
          const dt = new Date(d.date + 'T00:00:00');
          const s  = studentMap[d.studentId];
          const daysLeft = Math.ceil((dt.getTime() - now) / 86400000);
          return `
            <div class="deadline-row">
              <div class="deadline-cal">
                <div class="deadline-day">${dt.getDate()}</div>
                <div class="deadline-mon">${dt.toLocaleDateString('it-IT',{month:'short'})}</div>
              </div>
              <div class="deadline-info">
                <div class="deadline-type">${_DEADLINE_LABELS[d.type] || d.type}</div>
                ${s ? `<div class="deadline-student">${_escHome(s.pseudonym)}</div>` : ''}
              </div>
              <div style="font-size:12px;font-weight:700;color:${daysLeft <= 3 ? 'var(--danger)' : 'var(--text-muted)'}">
                ${daysLeft === 0 ? 'Oggi' : daysLeft === 1 ? 'Domani' : 'fra ' + daysLeft + 'gg'}
              </div>
            </div>`;
        }).join('')}
      </div>` : ''}

    ${students.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <div class="empty-title">Pronto per iniziare!</div>
        <div class="empty-text">Aggiungi il tuo primo studente, poi torna qui per annotare le osservazioni in pochi secondi.</div>
        <button class="btn btn--primary" style="width:auto;margin-top:4px" id="go-to-students">Vai a Studenti</button>
      </div>` : `
      <div class="section-label">Tocca uno studente</div>
      <div class="student-grid">
        ${students.map(s => `
          <button class="student-tile" data-sid="${s.id}">
            <div class="student-tile-name">${_escHome(s.pseudonym)}</div>
            <div class="student-tile-class">Classe ${s.year || '—'}${s.section || ''}</div>
          </button>`).join('')}
      </div>`}
  `;

  // Vai a studenti (stato vuoto)
  const gotoBtn = document.getElementById('go-to-students');
  if (gotoBtn) gotoBtn.addEventListener('click', () => navigateTo('studenti'));

  // Click sui tile → schermata nota rapida
  el.querySelectorAll('.student-tile').forEach(tile => {
    tile.addEventListener('click', () => openNoteScreen(parseInt(tile.dataset.sid)));
  });
}

function _escHome(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
