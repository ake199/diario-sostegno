// js/deadlines.js — Gestione scadenze (GLO, PEI)
// Accessibile come schermata push da Home → "Gestisci scadenze"

const _DL_LABELS = {
  glo_i: 'GLO Iniziale',
  glo_m: 'GLO Intermedio',
  glo_f: 'GLO Finale',
  pei:   'Verifica PEI'
};
const _DL_TYPES = Object.keys(_DL_LABELS);

// -----------------------------------------------------------------
// Punto di ingresso: apre la schermata push delle scadenze
// -----------------------------------------------------------------
function openDeadlinesScreen() {
  pushScreen('deadlines', (el) => {
    el.innerHTML = `
      <div class="page-header">
        <button class="back-btn" id="dl-back">‹ Home</button>
        <h2>Scadenze</h2>
      </div>
      <div id="dl-list"></div>`;

    document.getElementById('dl-back').addEventListener('click', () => popScreen());
    _loadDeadlines();
  });
}

// -----------------------------------------------------------------
// Carica e mostra la lista scadenze
// -----------------------------------------------------------------
async function _loadDeadlines() {
  const listEl = document.getElementById('dl-list');
  if (!listEl) return;

  listEl.innerHTML = '<div style="display:flex;justify-content:center;padding:48px"><div class="spinner"></div></div>';

  const [deadlines, allStudents] = await Promise.all([
    Deadlines.getAll(),
    Students.getAll(true)
  ]);

  const studentMap = {};
  allStudents.forEach(s => { studentMap[s.id] = s; });

  const today   = todayISO();
  const upcoming = deadlines.filter(d => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past     = deadlines.filter(d => d.date <  today).sort((a, b) => b.date.localeCompare(a.date));
  const activeStudents = allStudents.filter(s => !s.archived);

  listEl.innerHTML = `
    <div class="page-body">

      <button class="btn btn--primary" id="dl-add-btn">+ Aggiungi scadenza</button>

      ${deadlines.length === 0 ? `
        <div class="empty-state" style="padding-top:24px">
          <div class="empty-icon">📅</div>
          <div class="empty-title">Nessuna scadenza</div>
          <div class="empty-text">Aggiungi le date di GLO e Verifica PEI. Riceverai un avviso in Home 14 giorni prima e potrai aggiungere ogni evento direttamente a Google Calendar.</div>
        </div>` : ''}

      ${upcoming.length > 0 ? `
        <div class="settings-section-title">Prossime (${upcoming.length})</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${upcoming.map(d => _buildDLRow(d, studentMap[d.studentId], false)).join('')}
        </div>` : ''}

      ${past.length > 0 ? `
        <div class="settings-section-title" style="margin-top:8px">Passate (${past.length})</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${past.map(d => _buildDLRow(d, studentMap[d.studentId], true)).join('')}
        </div>` : ''}

      <div style="height:16px"></div>
    </div>`;

  document.getElementById('dl-add-btn').addEventListener('click', () =>
    _openDeadlineForm(null, activeStudents)
  );

  listEl.querySelectorAll('[data-dl-edit]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.dlEdit);
      const dl = deadlines.find(d => d.id === id);
      if (dl) _openDeadlineForm(dl, activeStudents);
    });
  });

  listEl.querySelectorAll('[data-dl-gcal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.dlGcal);
      const dl = deadlines.find(d => d.id === id);
      const student = dl ? studentMap[dl.studentId] : null;
      if (dl && student) _openGoogleCalendar(dl, student.pseudonym);
    });
  });

  listEl.querySelectorAll('[data-dl-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await showModal({
        title: 'Eliminare questa scadenza?',
        confirmLabel: 'Elimina',
        danger: true
      });
      if (!ok) return;
      await Deadlines.delete(parseInt(btn.dataset.dlDel));
      showToast('Scadenza eliminata');
      _loadDeadlines();
    });
  });
}

// -----------------------------------------------------------------
// Riga singola scadenza
// -----------------------------------------------------------------
function _buildDLRow(dl, student, isPast) {
  const dt     = new Date(dl.date + 'T00:00:00');
  const dayNum = dt.getDate();
  const monStr = dt.toLocaleDateString('it-IT', { month: 'short' });

  const daysLeft = Math.ceil((dt.getTime() - Date.now()) / 86400000);
  let urgency = '';
  if (!isPast) {
    if      (daysLeft === 0)  urgency = `<div style="font-size:11px;font-weight:700;color:var(--danger)">Oggi</div>`;
    else if (daysLeft === 1)  urgency = `<div style="font-size:11px;font-weight:700;color:var(--danger)">Domani</div>`;
    else if (daysLeft <= 14)  urgency = `<div style="font-size:11px;font-weight:700;color:var(--warning)">fra ${daysLeft}gg</div>`;
  }

  return `
    <div class="deadline-row" style="${isPast ? 'opacity:0.55' : ''}">
      <div class="deadline-cal">
        <div class="deadline-day">${dayNum}</div>
        <div class="deadline-mon">${monStr}</div>
      </div>
      <div class="deadline-info" style="flex:1;min-width:0">
        <div class="deadline-type">${_DL_LABELS[dl.type] || dl.type}</div>
        <div class="deadline-student">${student ? _dlEsc(student.pseudonym) : '—'}</div>
        ${urgency}
      </div>
      <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
        ${!isPast ? `
          <button class="btn btn--outline btn--sm" data-dl-gcal="${dl.id}"
            style="padding:6px 8px;font-size:12px;white-space:nowrap;width:auto">
            📅 Google
          </button>` : ''}
        <button class="note-card-action-btn" data-dl-edit="${dl.id}"
          style="padding:6px 8px;font-size:16px;color:var(--text-muted)">✏️</button>
        <button class="note-card-action-btn del" data-dl-del="${dl.id}"
          style="padding:6px 8px;font-size:16px">🗑️</button>
      </div>
    </div>`;
}

// -----------------------------------------------------------------
// Form aggiungi / modifica scadenza (pushed sub-screen)
// -----------------------------------------------------------------
function _openDeadlineForm(existing, activeStudents) {
  const isNew = !existing;

  pushScreen('deadline-form', (el) => {
    const studentOptions = activeStudents.map(s =>
      `<option value="${s.id}" ${existing && existing.studentId === s.id ? 'selected' : ''}>${_dlEsc(s.pseudonym)}</option>`
    ).join('');

    el.innerHTML = `
      <div class="page-header">
        <button class="back-btn" id="dlf-back">‹ Scadenze</button>
        <h2>${isNew ? 'Nuova scadenza' : 'Modifica'}</h2>
      </div>
      <div class="page-body">

        ${activeStudents.length === 0 ? `
          <div class="alert alert--warning">
            <span>⚠️</span>
            <span>Aggiungi prima uno studente dalla scheda <strong>Studenti</strong>.</span>
          </div>` : ''}

        <div class="form-group">
          <label class="form-label">Studente</label>
          <select id="dlf-student">
            <option value="">— Seleziona studente —</option>
            ${studentOptions}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Tipo di scadenza</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">
            ${_DL_TYPES.map(type => `
              <button type="button"
                class="dl-type-btn ${existing && existing.type === type ? 'sel' : ''}"
                data-type="${type}">
                ${_DL_LABELS[type]}
              </button>`).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Data</label>
          <input type="date" id="dlf-date" value="${existing ? existing.date : ''}">
        </div>

        <button class="btn btn--primary" id="dlf-save">Salva</button>

        ${!isNew ? `
          <button class="btn btn--secondary" id="dlf-delete" style="color:var(--danger)">
            🗑️ Elimina scadenza
          </button>` : ''}

        <div style="height:16px"></div>
      </div>`;

    document.getElementById('dlf-back').addEventListener('click', () => popScreen());

    // Un solo tipo selezionabile alla volta
    el.querySelectorAll('.dl-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.dl-type-btn').forEach(b => b.classList.remove('sel'));
        btn.classList.add('sel');
      });
    });

    document.getElementById('dlf-save').addEventListener('click', () =>
      _saveDeadlineForm(el, existing)
    );

    const delBtn = document.getElementById('dlf-delete');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        const ok = await showModal({ title: 'Eliminare questa scadenza?', confirmLabel: 'Elimina', danger: true });
        if (!ok) return;
        await Deadlines.delete(existing.id);
        popScreen();          // chiude il form
        showToast('Scadenza eliminata');
        _loadDeadlines();     // aggiorna la lista sotto
      });
    }
  });
}

// -----------------------------------------------------------------
// Salva (crea o aggiorna) una scadenza
// -----------------------------------------------------------------
async function _saveDeadlineForm(el, existing) {
  const studentId = parseInt(document.getElementById('dlf-student').value);
  const typeBtn   = el.querySelector('.dl-type-btn.sel');
  const date      = document.getElementById('dlf-date').value;

  let valid = true;

  const studentSel = document.getElementById('dlf-student');
  studentSel.style.borderColor = studentId ? '' : 'var(--danger)';
  if (!studentId) valid = false;

  const dateSel = document.getElementById('dlf-date');
  dateSel.style.borderColor = date ? '' : 'var(--danger)';
  if (!date) valid = false;

  if (!typeBtn) {
    el.querySelectorAll('.dl-type-btn').forEach(b => b.style.outline = '2px solid var(--danger)');
    setTimeout(() => el.querySelectorAll('.dl-type-btn').forEach(b => b.style.outline = ''), 1500);
    valid = false;
  }

  if (!valid) return;

  const data = { studentId, type: typeBtn.dataset.type, date };

  if (existing) {
    await Deadlines.update({ ...existing, ...data });
    showToast('Scadenza aggiornata ✓');
  } else {
    await Deadlines.add(data);
    showToast('Scadenza aggiunta ✓');
  }

  popScreen();          // chiude il form
  _loadDeadlines();     // aggiorna la lista
}

// -----------------------------------------------------------------
// Apre Google Calendar con l'evento precompilato
// -----------------------------------------------------------------
function _openGoogleCalendar(dl, pseudonym) {
  const [yr, mo, dd] = dl.date.split('-').map(Number);

  const start  = dl.date.replace(/-/g, '');
  const endDt  = new Date(yr, mo - 1, dd + 1);
  const endStr = endDt.toISOString().split('T')[0].replace(/-/g, '');

  const title  = encodeURIComponent(`${_DL_LABELS[dl.type]} — ${pseudonym}`);
  const detail = encodeURIComponent(
    `Scadenza: ${_DL_LABELS[dl.type]}\nStudente: ${pseudonym}\n\n⏰ Aggiungi un promemoria 14 giorni prima.`
  );

  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${title}&dates=${start}/${endStr}&details=${detail}&sf=true&output=xml`;

  window.open(url, '_blank');
}

// -----------------------------------------------------------------
// Utility interna
// -----------------------------------------------------------------
function _dlEsc(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
