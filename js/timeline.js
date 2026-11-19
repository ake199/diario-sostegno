// js/timeline.js — Timeline osservazioni per studente

const _TL_TAGS = [
  'Autonomia', 'Comunicazione', 'Relazione',
  'Apprendimento', 'Comportamento', 'Progresso', 'Difficoltà'
];

const _TL_TAG_CLASS = {
  'Autonomia':     'autonomia',
  'Comunicazione': 'comunicazione',
  'Relazione':     'relazione',
  'Apprendimento': 'apprendimento',
  'Comportamento': 'comportamento',
  'Progresso':     'progresso',
  'Difficoltà':    'difficolta'
};

let _tlStudentId = null;

// -----------------------------------------------------------------
// Tab principale Timeline
// -----------------------------------------------------------------
async function renderTimeline() {
  const el = document.getElementById('tab-timeline');
  el.innerHTML = '<div style="display:flex;justify-content:center;padding-top:80px"><div class="spinner"></div></div>';

  const students = await Students.getAll(false);

  if (students.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">Nessuno studente</div>
        <div class="empty-text">Aggiungi uno studente in <strong>Studenti</strong> per vedere le sue note qui.</div>
      </div>`;
    return;
  }

  // Ripristina l'ultimo studente selezionato
  const saved = parseInt(localStorage.getItem('ds_tl_student') || '0');
  if (saved && students.find(s => s.id === saved)) {
    _tlStudentId = saved;
  } else {
    _tlStudentId = students[0].id;
  }

  const chipsHTML = students.map(s => `
    <button class="filter-chip ${s.id === _tlStudentId ? 'active' : ''}" data-stid="${s.id}">
      ${_tlEsc(s.pseudonym)}
    </button>`).join('');

  el.innerHTML = `
    <div class="filter-bar" id="tl-chips">${chipsHTML}</div>
    <div id="tl-notes"></div>`;

  el.querySelectorAll('[data-stid]').forEach(chip => {
    chip.addEventListener('click', async () => {
      _tlStudentId = parseInt(chip.dataset.stid);
      localStorage.setItem('ds_tl_student', _tlStudentId);
      el.querySelectorAll('[data-stid]').forEach(c =>
        c.classList.toggle('active', parseInt(c.dataset.stid) === _tlStudentId)
      );
      await _renderNotesList();
    });
  });

  await _renderNotesList();
}

// -----------------------------------------------------------------
// Renderizza la lista note per lo studente selezionato
// -----------------------------------------------------------------
async function _renderNotesList() {
  const notesEl = document.getElementById('tl-notes');
  if (!notesEl || !_tlStudentId) return;

  notesEl.innerHTML = '<div style="display:flex;justify-content:center;padding:24px"><div class="spinner"></div></div>';

  const [student, observations] = await Promise.all([
    Students.get(_tlStudentId),
    Observations.getForStudent(_tlStudentId)
  ]);

  if (!student) return;

  // Ordina per data decrescente (più recente prima)
  observations.sort((a, b) => b.datetime - a.datetime);

  if (observations.length === 0) {
    notesEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <div class="empty-title">Nessuna nota ancora</div>
        <div class="empty-text">Torna in <strong>Home</strong> e tocca il tile di ${_tlEsc(student.pseudonym)} per aggiungere la prima osservazione.</div>
      </div>`;
    return;
  }

  notesEl.innerHTML = `
    <div class="settings-section-title" style="padding-top:4px;display:flex;align-items:center;justify-content:space-between;padding-right:var(--sp-md)">
      <span>${observations.length} osservazion${observations.length === 1 ? 'e' : 'i'} · ${_tlEsc(student.pseudonym)}</span>
      <button id="tl-syn-btn" style="font-size:12px;font-weight:600;color:var(--accent);background:none;border:none;cursor:pointer;padding:4px 0;white-space:nowrap">✂️ Sintesi</button>
    </div>
    <div style="padding:4px var(--sp-md) var(--sp-lg);display:flex;flex-direction:column;gap:12px">
      ${observations.map(obs => _buildNoteCard(obs)).join('')}
    </div>`;

  const synBtn = document.getElementById('tl-syn-btn');
  if (synBtn) synBtn.addEventListener('click', () => openSynthesisScreen(student.id));

  notesEl.querySelectorAll('[data-edit-obs]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const obs = await Observations.get(parseInt(btn.dataset.editObs));
      if (obs) _openEditScreen(obs, student);
    });
  });

  notesEl.querySelectorAll('[data-del-obs]').forEach(btn => {
    btn.addEventListener('click', () => _deleteNote(parseInt(btn.dataset.delObs)));
  });
}

// -----------------------------------------------------------------
// Card singola osservazione
// -----------------------------------------------------------------
function _buildNoteCard(obs) {
  const dt      = new Date(obs.datetime);
  const dateStr = dt.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = dt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  const tagsHTML = (obs.tags || []).map(t => {
    const cls = _TL_TAG_CLASS[t] || t.toLowerCase();
    return `<span class="tag tag--${cls}">${_tlEsc(t)}</span>`;
  }).join('');

  const abcBadge = obs.hasABC
    ? `<span style="display:inline-flex;align-items:center;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;background:var(--bg-card);color:var(--text-soft);border:1.5px solid var(--border)">ABC</span>`
    : '';

  return `
    <div class="note-card">
      <div class="note-card-meta">
        <span>${dateStr} · ${timeStr}</span>
        ${obs.subject ? `<span style="font-size:12px;color:var(--accent);font-weight:600">📚 ${_tlEsc(obs.subject)}</span>` : ''}
      </div>
      <div class="note-card-text">${_tlEsc(obs.text)}</div>
      ${(tagsHTML || abcBadge) ? `
        <div class="note-card-tags">
          ${tagsHTML}
          ${abcBadge}
        </div>` : ''}
      <div class="note-card-actions">
        <button class="note-card-action-btn" data-edit-obs="${obs.id}">✏️ Modifica</button>
        <button class="note-card-action-btn del" data-del-obs="${obs.id}">🗑️ Elimina</button>
      </div>
    </div>`;
}

// -----------------------------------------------------------------
// Schermata modifica nota
// -----------------------------------------------------------------
function _openEditScreen(obs, student) {
  pushScreen('note-edit', async (el) => {
    const allSubjects = (await Settings.get('subjects')) || ['Altro'];
    const subjects = (student.subjects && student.subjects.length > 0)
      ? student.subjects
      : allSubjects;

    const dt      = new Date(obs.datetime);
    const dateStr = dt.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeStr = dt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const dateLabel = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

    el.innerHTML = `
      <div class="page-header">
        <button class="back-btn" id="edit-back">‹ ${_tlEsc(student.pseudonym)}</button>
        <button class="btn btn--primary btn--sm" id="edit-save" style="margin-left:auto">Salva</button>
      </div>

      <div class="page-body" style="gap:14px">

        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:13px;color:var(--text-soft)">📅 ${dateLabel} · ${timeStr}</span>
          <div style="margin-left:auto;display:flex;align-items:center;gap:6px">
            <span style="font-size:13px;color:var(--text-muted)">📚</span>
            <select id="edit-subject" style="font-size:14px;padding:6px 10px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-elevated);color:var(--text);max-width:160px;width:auto">
              ${subjects.map(s => `<option value="${_tlEsc(s)}" ${s === obs.subject ? 'selected' : ''}>${_tlEsc(s)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-group">
          <textarea
            id="edit-text"
            placeholder="Non usare nomi: scrivi &quot;lo studente&quot;"
            style="min-height:130px;font-size:16px;line-height:1.65">${_tlEsc(obs.text)}</textarea>
        </div>

        <div class="form-group">
          <div class="form-label">Tag osservazione</div>
          <div class="tag-selector" id="edit-tags" style="margin-top:4px">
            ${_TL_TAGS.map(t => `
              <button type="button" class="tag-btn ${(obs.tags || []).includes(t) ? 'sel' : ''}" data-tag="${t}">${t}</button>
            `).join('')}
          </div>
        </div>

        <div class="abc-block">
          <button type="button" class="abc-toggle" id="edit-abc-toggle"
            aria-expanded="${obs.hasABC ? 'true' : 'false'}">
            <span>Blocco ABC — Antecedente · Comportamento · Conseguenza</span>
            <span class="abc-arrow">▼</span>
          </button>
          <div class="abc-fields ${obs.hasABC ? '' : 'hidden'}" id="edit-abc-fields">
            <div class="form-group">
              <label class="form-label">Antecedente</label>
              <textarea id="edit-abc-a" style="min-height:60px">${_tlEsc(obs.antecedent || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Comportamento osservato</label>
              <textarea id="edit-abc-b" style="min-height:60px">${_tlEsc(obs.behavior || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Conseguenza</label>
              <textarea id="edit-abc-c" style="min-height:60px">${_tlEsc(obs.consequence || '')}</textarea>
            </div>
          </div>
        </div>

        <hr>

        <button class="btn btn--secondary" id="edit-delete" style="color:var(--danger)">
          🗑️ Elimina questa nota
        </button>

        <div style="height:8px"></div>
      </div>`;

    // Toggle tag
    el.querySelectorAll('#edit-tags .tag-btn').forEach(btn => {
      btn.addEventListener('click', () => btn.classList.toggle('sel'));
    });

    // Toggle ABC
    document.getElementById('edit-abc-toggle').addEventListener('click', () => {
      const fields = document.getElementById('edit-abc-fields');
      const toggle = document.getElementById('edit-abc-toggle');
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      fields.classList.toggle('hidden', isOpen);
      toggle.setAttribute('aria-expanded', String(!isOpen));
    });

    // Torna indietro
    document.getElementById('edit-back').addEventListener('click', () => popScreen());

    // Salva modifiche
    document.getElementById('edit-save').addEventListener('click', () =>
      _saveEditedNote(obs, student.id)
    );

    // Elimina dalla schermata di modifica
    document.getElementById('edit-delete').addEventListener('click', () =>
      _deleteNote(obs.id, true)
    );
  });
}

// -----------------------------------------------------------------
// Salva la nota modificata
// -----------------------------------------------------------------
async function _saveEditedNote(existingObs, studentId) {
  const textEl = document.getElementById('edit-text');
  if (!textEl) return;

  const text = textEl.value.trim();
  if (!text) {
    textEl.style.borderColor = 'var(--danger)';
    textEl.focus();
    return;
  }
  textEl.style.borderColor = '';

  const tags    = Array.from(document.querySelectorAll('#edit-tags .tag-btn.sel')).map(b => b.dataset.tag);
  const subject = document.getElementById('edit-subject')?.value || '';

  const toggle  = document.getElementById('edit-abc-toggle');
  const abcOpen = toggle?.getAttribute('aria-expanded') === 'true';
  const antecedent  = abcOpen ? (document.getElementById('edit-abc-a')?.value.trim()  || '') : '';
  const behavior    = abcOpen ? (document.getElementById('edit-abc-b')?.value.trim()  || '') : '';
  const consequence = abcOpen ? (document.getElementById('edit-abc-c')?.value.trim()  || '') : '';
  const hasABC = abcOpen && (antecedent || behavior || consequence);

  await Observations.update({
    ...existingObs,
    text,
    tags,
    subject,
    hasABC:      !!hasABC,
    antecedent,
    behavior,
    consequence
  });

  popScreen();
  showToast('Nota aggiornata ✓');
}

// -----------------------------------------------------------------
// Elimina una nota (con conferma)
// -----------------------------------------------------------------
async function _deleteNote(obsId, fromEditScreen = false) {
  const ok = await showModal({
    title: 'Eliminare questa nota?',
    body:  'L\'osservazione verrà eliminata definitivamente.',
    confirmLabel: 'Elimina',
    danger: true
  });
  if (!ok) return;

  await Observations.delete(obsId);

  if (fromEditScreen) popScreen();   // chiude la schermata di modifica
  await _renderNotesList();          // aggiorna la lista
  showToast('Nota eliminata');
}

// -----------------------------------------------------------------
// Utility interna
// -----------------------------------------------------------------
function _tlEsc(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
