// js/notes.js — Schermata nota rapida

const _ALL_TAGS = [
  'Autonomia', 'Comunicazione', 'Relazione',
  'Apprendimento', 'Comportamento', 'Progresso', 'Difficoltà'
];

// -----------------------------------------------------------------
// Apre la schermata di inserimento nota per uno studente
// -----------------------------------------------------------------
function openNoteScreen(studentId) {
  pushScreen('note-entry', (el) => {
    // Mostra subito uno spinner mentre carica
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%">
        <div class="spinner"></div>
      </div>`;

    // Carica studente e materie in parallelo
    Promise.all([
      Students.get(studentId),
      Settings.get('subjects')
    ]).then(([student, allSubjects]) => {
      if (!student) { popScreen(); return; }

      // Materie: quelle dello studente, o tutte se non specificate
      const subjects = (student.subjects && student.subjects.length > 0)
        ? student.subjects
        : (allSubjects || ['Altro']);

      // Ultima materia usata per questo studente
      const lastSubj = localStorage.getItem('ds_last_subj_' + studentId) || subjects[0] || '';

      // Timestamp dell'osservazione = adesso (quando apri la schermata)
      const timestamp = new Date();
      const dateStr   = timestamp.toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long'
      });
      const timeStr   = timestamp.toLocaleTimeString('it-IT', {
        hour: '2-digit', minute: '2-digit'
      });
      const dateLabel = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

      el.innerHTML = `
        <div class="page-header">
          <button class="back-btn" id="note-back">‹ ${_escNote(student.pseudonym)}</button>
          <button class="btn btn--primary btn--sm" id="note-save" style="margin-left:auto">Salva</button>
        </div>

        <div class="page-body" style="gap:14px">

          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:13px;color:var(--text-soft)">${dateLabel} · ${timeStr}</span>
            <div style="margin-left:auto;display:flex;align-items:center;gap:6px">
              <span style="font-size:13px;color:var(--text-muted)">📚</span>
              <select id="note-subject" style="font-size:14px;padding:6px 10px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-elevated);color:var(--text);max-width:160px;width:auto">
                ${subjects.map(s => `<option value="${_escNote(s)}" ${s === lastSubj ? 'selected' : ''}>${_escNote(s)}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <textarea
              id="note-text"
              placeholder="Non usare nomi: scrivi &quot;lo studente&quot;"
              style="min-height:130px;font-size:16px;line-height:1.65"></textarea>
          </div>

          <div class="form-group">
            <div class="form-label">Tag osservazione</div>
            <div class="tag-selector" id="note-tags" style="margin-top:4px">
              ${_ALL_TAGS.map(t => `
                <button type="button" class="tag-btn" data-tag="${t}">${t}</button>
              `).join('')}
            </div>
          </div>

          <div class="abc-block">
            <button type="button" class="abc-toggle" id="abc-toggle" aria-expanded="false">
              <span>Blocco ABC — Antecedente · Comportamento · Conseguenza</span>
              <span class="abc-arrow">▼</span>
            </button>
            <div class="abc-fields hidden" id="abc-fields">
              <div class="form-group">
                <label class="form-label">Antecedente</label>
                <textarea id="abc-a" placeholder="Cosa è successo prima del comportamento..." style="min-height:60px"></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Comportamento osservato</label>
                <textarea id="abc-b" placeholder="Descrivi il comportamento specifico..." style="min-height:60px"></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Conseguenza</label>
                <textarea id="abc-c" placeholder="Cosa è successo dopo..." style="min-height:60px"></textarea>
              </div>
            </div>
          </div>

          <div style="height:8px"></div>
        </div>`;

      // Toggle tag
      el.querySelectorAll('#note-tags .tag-btn').forEach(btn => {
        btn.addEventListener('click', () => btn.classList.toggle('sel'));
      });

      // Toggle ABC
      document.getElementById('abc-toggle').addEventListener('click', () => {
        const fields = document.getElementById('abc-fields');
        const toggle = document.getElementById('abc-toggle');
        const isOpen = toggle.getAttribute('aria-expanded') === 'true';
        fields.classList.toggle('hidden', isOpen);
        toggle.setAttribute('aria-expanded', String(!isOpen));
      });

      // Torna indietro
      document.getElementById('note-back').addEventListener('click', () => popScreen());

      // Salva
      document.getElementById('note-save').addEventListener('click', () =>
        _saveNote(studentId, timestamp)
      );
    });
  });
}

// -----------------------------------------------------------------
// Salva la nota in IndexedDB
// -----------------------------------------------------------------
async function _saveNote(studentId, timestamp) {
  const textEl = document.getElementById('note-text');
  if (!textEl) return;

  const text = textEl.value.trim();
  if (!text) {
    textEl.style.borderColor = 'var(--danger)';
    textEl.focus();
    return;
  }
  textEl.style.borderColor = '';

  const tags    = Array.from(document.querySelectorAll('#note-tags .tag-btn.sel')).map(b => b.dataset.tag);
  const subject = document.getElementById('note-subject')?.value || '';

  const toggle  = document.getElementById('abc-toggle');
  const abcOpen = toggle?.getAttribute('aria-expanded') === 'true';
  const antecedent  = abcOpen ? (document.getElementById('abc-a')?.value.trim()  || '') : '';
  const behavior    = abcOpen ? (document.getElementById('abc-b')?.value.trim()  || '') : '';
  const consequence = abcOpen ? (document.getElementById('abc-c')?.value.trim()  || '') : '';
  const hasABC = abcOpen && (antecedent || behavior || consequence);

  const obs = {
    studentId,
    text,
    tags,
    subject,
    datetime:    timestamp.getTime(),
    hasABC:      !!hasABC,
    antecedent,
    behavior,
    consequence
  };

  await Observations.add(obs);

  // Ricorda l'ultima materia usata per questo studente
  if (subject) localStorage.setItem('ds_last_subj_' + studentId, subject);

  popScreen();
  showToast('Nota salvata ✓');
}

// -----------------------------------------------------------------
// Utility interna
// -----------------------------------------------------------------
function _escNote(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
