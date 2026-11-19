// js/settings.js — Impostazioni (Parte 7)

async function renderSettings() {
  const el = document.getElementById('tab-impostazioni');
  el.innerHTML = '<div style="display:flex;justify-content:center;padding-top:80px"><div class="spinner"></div></div>';

  const [subjects, q1s, q1e, q2s, q2e, lastBackup] = await Promise.all([
    Settings.get('subjects'),
    Settings.get('q1_start'),
    Settings.get('q1_end'),
    Settings.get('q2_start'),
    Settings.get('q2_end'),
    Settings.get('last_backup')
  ]);

  const backupLabel = lastBackup
    ? new Date(lastBackup).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Mai effettuato';

  const card = 'background:var(--bg-elevated);border-radius:var(--r-md);border:1.5px solid var(--border);padding:var(--sp-md);margin:0 var(--sp-md) var(--sp-sm)';

  el.innerHTML = `
    <div class="page-body" style="gap:0;padding:0 0 var(--sp-lg)">

      <!-- MATERIE -->
      <div class="settings-section-title">Materie</div>
      <div style="${card}">
        <div id="subj-list" style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px">
          ${(subjects || []).map((s, i) => _sRow(s, i)).join('')}
        </div>
        <div style="display:flex;gap:8px">
          <input type="text" id="subj-new" placeholder="Nuova materia…"
            style="flex:1;font-size:15px;padding:9px 12px;border-radius:var(--r-sm);border:1.5px solid var(--border);background:var(--bg);color:var(--text)">
          <button class="btn btn--primary btn--sm" id="subj-add-btn" style="width:auto;white-space:nowrap">+ Aggiungi</button>
        </div>
      </div>

      <!-- DATE QUADRIMESTRI -->
      <div class="settings-section-title" style="margin-top:4px">Date quadrimestri</div>
      <div style="${card}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">1° quad. inizio</label>
            <input type="date" id="q1s" value="${q1s || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">1° quad. fine</label>
            <input type="date" id="q1e" value="${q1e || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">2° quad. inizio</label>
            <input type="date" id="q2s" value="${q2s || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">2° quad. fine</label>
            <input type="date" id="q2e" value="${q2e || ''}">
          </div>
        </div>
        <button class="btn btn--primary btn--sm" id="save-dates-btn" style="width:auto;margin-top:4px">Salva date</button>
      </div>

      <!-- SICUREZZA -->
      <div class="settings-section-title" style="margin-top:4px">Sicurezza</div>
      <div style="${card};display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div>
          <div style="font-size:15px;font-weight:600;color:var(--text)">PIN di accesso</div>
          <div class="form-hint">Cambia il tuo PIN di 4 cifre</div>
        </div>
        <button class="btn btn--secondary btn--sm" id="change-pin-btn" style="width:auto;white-space:nowrap">🔑 Cambia PIN</button>
      </div>

      <!-- BACKUP -->
      <div class="settings-section-title" style="margin-top:4px">Backup dati</div>
      <div style="${card};display:flex;flex-direction:column;gap:14px">
        <div style="font-size:13px;color:var(--text-muted)">
          Ultimo backup: <strong style="color:var(--text)">${backupLabel}</strong>
        </div>

        <div>
          <button class="btn btn--primary" id="export-btn">💾 Esporta backup JSON</button>
          <div class="form-hint" style="margin-top:4px">
            Scarica un file JSON con tutti i dati (escluso il PIN). Conservalo in un posto sicuro.
          </div>
        </div>

        <hr style="margin:0;border-color:var(--border)">

        <div>
          <div class="form-label" style="margin-bottom:8px">Importa da file</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <label style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:var(--r-sm);border:1.5px solid var(--border);background:var(--bg-elevated);font-size:14px;font-weight:600;color:var(--text);cursor:pointer">
              📂 Scegli file
              <input type="file" id="import-file" accept=".json" style="display:none">
            </label>
            <span id="import-filename" style="font-size:13px;color:var(--text-muted)">Nessun file</span>
          </div>
          <button class="btn btn--secondary" id="import-btn"
            style="margin-top:10px;display:none">📥 Importa dati</button>
          <div class="form-hint" style="margin-top:6px;color:var(--warning)">
            ⚠️ L'importazione sovrascrive tutti i dati attuali. Il PIN rimane invariato.
          </div>
        </div>
      </div>

      <!-- ZONA PERICOLO -->
      <div class="settings-section-title" style="margin-top:4px;color:var(--danger)">Zona pericolosa</div>
      <div style="${card};border-color:color-mix(in srgb,var(--danger) 35%,transparent)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div style="min-width:0;flex:1">
            <div style="font-size:15px;font-weight:600;color:var(--danger)">Elimina tutti i dati</div>
            <div class="form-hint">Studenti, osservazioni e scadenze vengono eliminati definitivamente. Il PIN rimane.</div>
          </div>
          <button id="delete-all-btn"
            style="padding:8px 14px;border-radius:var(--r-sm);border:none;background:var(--danger);color:#fff;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0">
            🗑️ Elimina tutto
          </button>
        </div>
      </div>

      <div style="height:16px"></div>
    </div>`;

  _attachSubjectEvents(subjects || []);
  _attachDateEvents();
  _attachPinEvent();
  _attachBackupEvents();
}

// -----------------------------------------------------------------
// Gestione materie
// -----------------------------------------------------------------
function _sRow(subj, i) {
  return `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--bg);border-radius:var(--r-sm);border:1.5px solid var(--border)">
      <span style="flex:1;font-size:14px;color:var(--text)">${_sEsc(subj)}</span>
      <button class="subj-del" data-idx="${i}"
        style="font-size:16px;background:none;border:none;cursor:pointer;color:var(--text-muted);padding:0 4px;line-height:1"
        aria-label="Rimuovi ${_sEsc(subj)}">✕</button>
    </div>`;
}

function _attachSubjectEvents(initSubjs) {
  let subjs = [...initSubjs];

  function rerender() {
    const list = document.getElementById('subj-list');
    if (!list) return;
    list.innerHTML = subjs.map((s, i) => _sRow(s, i)).join('');
    list.querySelectorAll('.subj-del').forEach(btn => btn.addEventListener('click', onDel));
  }

  async function onDel(e) {
    const i = parseInt(e.currentTarget.dataset.idx);
    if (subjs.length <= 1) { showToast('Almeno una materia è necessaria', 'error'); return; }
    subjs.splice(i, 1);
    await Settings.set('subjects', subjs);
    rerender();
    showToast('Materia rimossa');
  }

  // Collega i bottoni elimina già presenti
  document.querySelectorAll('.subj-del').forEach(btn => btn.addEventListener('click', onDel));

  async function onAdd() {
    const input = document.getElementById('subj-new');
    if (!input) return;
    const val = input.value.trim();
    if (!val) { input.style.borderColor = 'var(--danger)'; input.focus(); return; }
    input.style.borderColor = '';
    if (subjs.map(s => s.toLowerCase()).includes(val.toLowerCase())) {
      showToast('Materia già presente', 'error'); return;
    }
    subjs.push(val);
    await Settings.set('subjects', subjs);
    input.value = '';
    rerender();
    showToast(`"${val}" aggiunta ✓`);
  }

  document.getElementById('subj-add-btn')?.addEventListener('click', onAdd);
  document.getElementById('subj-new')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); onAdd(); }
  });
}

// -----------------------------------------------------------------
// Date quadrimestri
// -----------------------------------------------------------------
function _attachDateEvents() {
  document.getElementById('save-dates-btn')?.addEventListener('click', async () => {
    await Promise.all([
      Settings.set('q1_start', document.getElementById('q1s').value),
      Settings.set('q1_end',   document.getElementById('q1e').value),
      Settings.set('q2_start', document.getElementById('q2s').value),
      Settings.set('q2_end',   document.getElementById('q2e').value)
    ]);
    showToast('Date quadrimestri salvate ✓');
  });
}

// -----------------------------------------------------------------
// Cambio PIN
// -----------------------------------------------------------------
function _attachPinEvent() {
  document.getElementById('change-pin-btn')?.addEventListener('click', async () => {
    // 1) verifica il PIN attuale
    await showPINEntry('Inserisci il PIN attuale per continuare');
    // 2) imposta il nuovo PIN (doppia digitazione)
    await showPINSetup();
    showToast('PIN aggiornato ✓');
  });
}

// -----------------------------------------------------------------
// Export / Import backup
// -----------------------------------------------------------------
function _attachBackupEvents() {
  // EXPORT
  document.getElementById('export-btn')?.addEventListener('click', async () => {
    try {
      const data     = await Backup.export();
      const json     = JSON.stringify(data, null, 2);
      const blob     = new Blob([json], { type: 'application/json' });
      const dateStr  = new Date().toISOString().slice(0, 10);
      const filename = `diario-sostegno-backup-${dateStr}.json`;

      // Su iOS Safari usa Web Share API se disponibile (apre il pannello "Condividi")
      if (navigator.canShare) {
        const file = new File([blob], filename, { type: 'application/json' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          await Settings.set('last_backup', Date.now());
          showToast('Backup condiviso ✓');
          renderSettings();
          return;
        }
      }

      // Fallback standard (Android/desktop)
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await Settings.set('last_backup', Date.now());
      showToast('Backup esportato ✓');
      renderSettings();
    } catch (err) {
      if (err.name !== 'AbortError') showToast('Errore durante l\'esportazione', 'error');
    }
  });

  // IMPORT — selezione file
  const fileInput = document.getElementById('import-file');
  const importBtn = document.getElementById('import-btn');

  fileInput?.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (f) {
      document.getElementById('import-filename').textContent = f.name;
      importBtn.style.display = '';
    }
  });

  importBtn?.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    const ok = await showModal({
      title:        'Importare il backup?',
      body:         'Tutti i dati attuali (studenti, osservazioni, scadenze) verranno sostituiti con quelli del file. Il PIN rimane invariato.',
      confirmLabel: 'Importa',
      danger:       true
    });
    if (!ok) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await Backup.import(data);
      showToast('Dati importati correttamente ✓');
      renderSettings();
    } catch {
      showToast('File non valido o corrotto', 'error');
    }
  });

  // DELETE ALL
  document.getElementById('delete-all-btn')?.addEventListener('click', async () => {
    const ok = await showModal({
      title:        'Eliminare tutti i dati?',
      body:         'Studenti, osservazioni e scadenze verranno eliminati definitivamente. Questa operazione non può essere annullata. Il PIN rimane invariato.',
      confirmLabel: 'Elimina tutto',
      danger:       true
    });
    if (!ok) return;

    const ok2 = await showModal({
      title:        'Ultima conferma',
      body:         'Sei assolutamente sicuro? Tutti i dati andranno persi per sempre. Prima esegui un backup se non lo hai già fatto.',
      confirmLabel: 'Sì, elimina definitivamente',
      danger:       true
    });
    if (!ok2) return;

    await Backup.deleteAll();
    showToast('Tutti i dati sono stati eliminati');
    renderSettings();
  });
}

// -----------------------------------------------------------------
// XSS escape
// -----------------------------------------------------------------
function _sEsc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
