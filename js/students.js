// js/students.js — Gestione studenti

const _ANNI    = ['1','2','3','4','5'];
const _SEZIONI = ['A','B','C','D','E','F','G'];

// -----------------------------------------------------------------
// Tab principale Studenti
// -----------------------------------------------------------------
async function renderStudents() {
  const el = document.getElementById('tab-studenti');
  el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding-top:80px"><div class="spinner"></div></div>';

  const allStudents = await Students.getAll(true);
  const active   = allStudents.filter(s => !s.archived);
  const archived = allStudents.filter(s =>  s.archived);

  el.innerHTML = `
    <div class="page-body">

      <button class="btn btn--primary" id="add-student-btn">+ Aggiungi studente</button>

      ${active.length === 0 ? `
        <div class="empty-state" style="padding-top:24px">
          <div class="empty-icon">👤</div>
          <div class="empty-title">Nessuno studente</div>
          <div class="empty-text">Aggiungi il tuo primo studente per iniziare a registrare le osservazioni.</div>
        </div>` : `
        <div class="settings-section-title">Attivi (${active.length})</div>
        <div class="list-block">
          ${active.map(s => `
            <button class="list-item" data-sid="${s.id}">
              <div class="list-item-content">
                <div class="list-item-title">${_escHtml(s.pseudonym)}</div>
                <div class="list-item-sub">Classe ${s.year || '—'}${s.section || ''} · ${s.weeklyHours ? s.weeklyHours + ' ore/sett.' : 'ore non specificate'}</div>
              </div>
              <span class="list-item-arrow">›</span>
            </button>`).join('')}
        </div>`}

      ${archived.length > 0 ? `
        <div class="settings-section-title">Archiviati (${archived.length})</div>
        <div class="list-block">
          ${archived.map(s => `
            <button class="list-item" data-sid="${s.id}">
              <div class="list-item-content">
                <div class="list-item-title" style="color:var(--text-muted)">${_escHtml(s.pseudonym)}</div>
                <div class="list-item-sub">Archiviato · Classe ${s.year || '—'}${s.section || ''}</div>
              </div>
              <span class="list-item-arrow">›</span>
            </button>`).join('')}
        </div>` : ''}

    </div>`;

  document.getElementById('add-student-btn').addEventListener('click', () => openStudentForm(null));

  el.querySelectorAll('[data-sid]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const student = await Students.get(parseInt(btn.dataset.sid));
      if (student) openStudentForm(student);
    });
  });
}

// -----------------------------------------------------------------
// Form crea / modifica studente
// -----------------------------------------------------------------
async function openStudentForm(student) {
  const isNew    = !student;
  const subjects = (await Settings.get('subjects')) || [];

  pushScreen('student-form', async (el) => {
    const selSubj = student ? (student.subjects || []) : [];

    el.innerHTML = `
      <div class="page-header">
        <button class="back-btn" id="sf-back">‹ Studenti</button>
        <h2>${isNew ? 'Nuovo studente' : 'Modifica'}</h2>
      </div>
      <div class="page-body">

        <div class="alert alert--warning">
          <span>⚠️</span>
          <span><strong>Privacy:</strong> usa solo uno pseudonimo o le iniziali (es. "M.R.", "Studente A"). Non inserire mai il nome completo o dati identificativi. Non esiste un campo per la diagnosi.</span>
        </div>

        <div class="form-group">
          <label class="form-label">Pseudonimo o iniziali *</label>
          <input type="text" id="sf-pseudo"
            placeholder="es. M.R.  oppure  Studente A"
            value="${student ? _escHtml(student.pseudonym) : ''}"
            maxlength="40"
            autocomplete="off">
        </div>

        <div class="form-group">
          <label class="form-label">Classe</label>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" style="font-size:11px">Anno</label>
              <select id="sf-year">
                ${_ANNI.map(y => `<option value="${y}" ${student && student.year === y ? 'selected' : ''}>${y}°</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:11px">Sezione</label>
              <select id="sf-section">
                ${_SEZIONI.map(s => `<option value="${s}" ${student && student.section === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Ore settimanali di sostegno</label>
          <input type="number" id="sf-hours"
            placeholder="es. 10"
            min="1" max="40"
            value="${student && student.weeklyHours ? student.weeklyHours : ''}">
        </div>

        ${subjects.length > 0 ? `
        <div class="form-group">
          <label class="form-label">Materie seguite</label>
          <div class="form-hint">Tocca le materie in cui segui questo studente.</div>
          <div class="tag-selector" id="sf-subjects" style="margin-top:8px">
            ${subjects.map(s => `
              <button type="button" class="tag-btn ${selSubj.includes(s) ? 'sel' : ''}" data-subj="${_escHtml(s)}">${_escHtml(s)}</button>
            `).join('')}
          </div>
        </div>` : ''}

        <div class="form-group">
          <label class="form-label">Note generali</label>
          <div class="form-hint">Contesto, obiettivi generali, informazioni utili. Non inserire diagnosi.</div>
          <textarea id="sf-notes" placeholder="Annotazioni sullo studente..." style="margin-top:4px">${student ? _escHtml(student.generalNotes || '') : ''}</textarea>
        </div>

        <button class="btn btn--primary" id="sf-save">Salva</button>

        ${!isNew ? `
          <button class="btn btn--secondary" id="sf-archive">
            ${student.archived ? '📂 Ripristina studente' : '📁 Archivia studente'}
          </button>` : ''}

        <div style="height:16px"></div>
      </div>`;

    // Torna indietro
    document.getElementById('sf-back').addEventListener('click', () => popScreen());

    // Toggle materie
    el.querySelectorAll('#sf-subjects .tag-btn').forEach(btn => {
      btn.addEventListener('click', () => btn.classList.toggle('sel'));
    });

    // Salva
    document.getElementById('sf-save').addEventListener('click', () => _saveStudentForm(el, student));

    // Archivia / ripristina
    const archBtn = document.getElementById('sf-archive');
    if (archBtn) {
      archBtn.addEventListener('click', async () => {
        const msg = student.archived
          ? 'Ripristinare questo studente come attivo?'
          : 'Archiviare questo studente? Resterà visibile nell\'archivio con tutte le sue note.';
        const ok = await showModal({
          title: msg,
          confirmLabel: student.archived ? 'Ripristina' : 'Archivia'
        });
        if (!ok) return;
        if (student.archived) await Students.unarchive(student.id);
        else                   await Students.archive(student.id);
        popScreen();
        showToast(student.archived ? 'Studente ripristinato' : 'Studente archiviato');
      });
    }
  });
}

// -----------------------------------------------------------------
// Salva il form studente
// -----------------------------------------------------------------
async function _saveStudentForm(el, existing) {
  const pseudoInput = document.getElementById('sf-pseudo');
  const pseudo = pseudoInput.value.trim();

  if (!pseudo) {
    pseudoInput.style.borderColor = 'var(--danger)';
    pseudoInput.focus();
    return;
  }
  pseudoInput.style.borderColor = '';

  const selSubjBtns = el.querySelectorAll('#sf-subjects .tag-btn.sel');
  const selectedSubjects = Array.from(selSubjBtns).map(b => b.dataset.subj);

  const data = {
    pseudonym:    pseudo,
    year:         document.getElementById('sf-year').value,
    section:      document.getElementById('sf-section').value,
    weeklyHours:  parseInt(document.getElementById('sf-hours').value) || null,
    subjects:     selectedSubjects,
    generalNotes: document.getElementById('sf-notes').value.trim(),
  };

  if (existing) {
    await Students.update({ ...existing, ...data });
    showToast('Studente aggiornato ✓');
  } else {
    await Students.add(data);
    showToast('Studente aggiunto ✓');
  }

  popScreen();
}

// -----------------------------------------------------------------
// Utility interna
// -----------------------------------------------------------------
function _escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
