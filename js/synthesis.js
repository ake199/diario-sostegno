// js/synthesis.js — Copia per sintesi PEI

// -----------------------------------------------------------------
// Apre la schermata "Copia per sintesi" per uno studente
// Accessibile dal pulsante nella Timeline
// -----------------------------------------------------------------
function openSynthesisScreen(studentId) {
  pushScreen('synthesis', (el) => {
    el.innerHTML = `
      <div class="page-header">
        <button class="back-btn" id="syn-back">‹ Timeline</button>
        <h2>Copia per sintesi</h2>
      </div>
      <div id="syn-body" style="display:flex;justify-content:center;padding-top:48px">
        <div class="spinner"></div>
      </div>`;

    document.getElementById('syn-back').addEventListener('click', () => popScreen());

    Promise.all([
      Students.get(studentId),
      Observations.getForStudent(studentId)
    ]).then(([student, observations]) => {
      if (!student || observations.length === 0) {
        document.getElementById('syn-body').innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">✂️</div>
            <div class="empty-title">Nessuna nota</div>
            <div class="empty-text">Aggiungi prima alcune osservazioni per ${student ? student.pseudonym : ''} per generare la sintesi.</div>
          </div>`;
        return;
      }

      // Ordina cronologicamente (più vecchia prima per la sintesi)
      observations.sort((a, b) => a.datetime - b.datetime);

      _buildSynthesisUI(el, student, observations);
    });
  });
}

// -----------------------------------------------------------------
// Costruisce l'interfaccia di selezione note
// -----------------------------------------------------------------
function _buildSynthesisUI(el, student, observations) {
  const bodyEl = document.getElementById('syn-body');

  bodyEl.innerHTML = `
    <div class="page-body" style="gap:12px">

      <div class="alert alert--info">
        <span>ℹ️</span>
        <span>Seleziona le osservazioni da includere, poi tocca <strong>Genera testo</strong> per ottenere un estratto pronto da incollare nella relazione o nel PEI.</span>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:13px;font-weight:600;color:var(--text-soft)">${observations.length} osservazioni disponibili</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn--secondary btn--sm" id="syn-sel-all" style="width:auto">Tutte</button>
          <button class="btn btn--secondary btn--sm" id="syn-sel-none" style="width:auto">Nessuna</button>
        </div>
      </div>

      <div id="syn-obs-list" style="display:flex;flex-direction:column;gap:6px">
        ${observations.map((obs, i) => _buildCheckRow(obs, i)).join('')}
      </div>

      <button class="btn btn--primary" id="syn-generate">Genera testo per sintesi</button>

      <div id="syn-result" class="hidden">
        <div class="form-label" style="margin-bottom:6px">Testo generato — tocca e seleziona tutto per copiare</div>
        <textarea id="syn-text"
          style="min-height:260px;font-size:13px;line-height:1.65;font-family:monospace"
          readonly></textarea>
        <button class="btn btn--primary" id="syn-copy">📋 Copia negli appunti</button>
        <div class="form-hint" style="text-align:center">Poi incolla direttamente nel documento PEI o nella relazione.</div>
      </div>

      <div style="height:16px"></div>
    </div>`;

  // Seleziona tutto / nessuna
  document.getElementById('syn-sel-all').addEventListener('click', () => {
    el.querySelectorAll('.syn-check').forEach(cb => { cb.checked = true; });
  });
  document.getElementById('syn-sel-none').addEventListener('click', () => {
    el.querySelectorAll('.syn-check').forEach(cb => { cb.checked = false; });
  });

  // Genera
  document.getElementById('syn-generate').addEventListener('click', () =>
    _generateText(el, student, observations)
  );

  // Copia
  document.getElementById('syn-copy').addEventListener('click', () =>
    _copyToClipboard()
  );
}

// -----------------------------------------------------------------
// Riga osservazione con checkbox
// -----------------------------------------------------------------
function _buildCheckRow(obs, i) {
  const dt      = new Date(obs.datetime);
  const dateStr = dt.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  const tags    = (obs.tags || []).join(', ');
  const preview = obs.text.length > 70 ? obs.text.slice(0, 70) + '…' : obs.text;

  return `
    <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--bg-elevated);border-radius:var(--r-sm);cursor:pointer;border:1.5px solid var(--border)">
      <input type="checkbox" class="syn-check" data-idx="${i}" checked
        style="margin-top:3px;accent-color:var(--accent);width:18px;height:18px;flex-shrink:0">
      <div style="min-width:0;flex:1">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:2px">
          ${dateStr}${obs.subject ? ' · ' + obs.subject : ''}
          ${tags ? ' · <span style="color:var(--accent)">' + tags + '</span>' : ''}
          ${obs.hasABC ? ' · <span style="color:var(--text-muted)">ABC</span>' : ''}
        </div>
        <div style="font-size:13px;color:var(--text);line-height:1.45">${preview}</div>
      </div>
    </label>`;
}

// -----------------------------------------------------------------
// Genera il testo formattato per la sintesi
// -----------------------------------------------------------------
function _generateText(el, student, observations) {
  const checked = Array.from(el.querySelectorAll('.syn-check:checked'))
    .map(cb => parseInt(cb.dataset.idx));

  if (checked.length === 0) {
    showToast('Seleziona almeno una osservazione', 'error');
    return;
  }

  const selected = checked.map(i => observations[i]);

  // Periodo
  const dates     = selected.map(o => o.datetime).sort((a, b) => a - b);
  const dateFrom  = new Date(dates[0]).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  const dateTo    = new Date(dates[dates.length - 1]).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

  const lines = [];

  lines.push(`OSSERVAZIONI — ${student.pseudonym}`);
  lines.push(`Periodo: ${dateFrom} – ${dateTo}`);
  lines.push(`Numero osservazioni: ${selected.length}`);
  lines.push('');
  lines.push('─'.repeat(45));

  // Raggruppa per tag
  const ALL_TAGS = ['Autonomia', 'Comunicazione', 'Relazione', 'Apprendimento', 'Comportamento', 'Progresso', 'Difficoltà'];
  const tagGroups = {};
  const noTag = [];

  selected.forEach(obs => {
    const tags = obs.tags || [];
    if (tags.length === 0) {
      noTag.push(obs);
    } else {
      tags.forEach(t => {
        if (!tagGroups[t]) tagGroups[t] = [];
        tagGroups[t].push(obs);
      });
    }
  });

  // Stampa in ordine dei tag definiti
  ALL_TAGS.forEach(tag => {
    if (!tagGroups[tag] || tagGroups[tag].length === 0) return;
    lines.push('');
    lines.push(`${tag.toUpperCase()} (${tagGroups[tag].length})`);
    lines.push('');
    tagGroups[tag].forEach(obs => {
      const dt  = new Date(obs.datetime).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const sub = obs.subject ? ` · ${obs.subject}` : '';
      lines.push(`▸ [${dt}${sub}]`);
      lines.push(obs.text);
      if (obs.hasABC && (obs.antecedent || obs.behavior || obs.consequence)) {
        lines.push('  Blocco ABC:');
        if (obs.antecedent)  lines.push(`  A: ${obs.antecedent}`);
        if (obs.behavior)    lines.push(`  B: ${obs.behavior}`);
        if (obs.consequence) lines.push(`  C: ${obs.consequence}`);
      }
      lines.push('');
    });
    lines.push('─'.repeat(45));
  });

  // Note senza tag
  if (noTag.length > 0) {
    lines.push('');
    lines.push(`OSSERVAZIONI GENERALI (${noTag.length})`);
    lines.push('');
    noTag.forEach(obs => {
      const dt  = new Date(obs.datetime).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const sub = obs.subject ? ` · ${obs.subject}` : '';
      lines.push(`▸ [${dt}${sub}]`);
      lines.push(obs.text);
      if (obs.hasABC && (obs.antecedent || obs.behavior || obs.consequence)) {
        lines.push('  Blocco ABC:');
        if (obs.antecedent)  lines.push(`  A: ${obs.antecedent}`);
        if (obs.behavior)    lines.push(`  B: ${obs.behavior}`);
        if (obs.consequence) lines.push(`  C: ${obs.consequence}`);
      }
      lines.push('');
    });
    lines.push('─'.repeat(45));
  }

  lines.push('');
  lines.push('Generato con Diario di Sostegno');

  const text = lines.join('\n');
  document.getElementById('syn-text').value = text;

  const resultEl = document.getElementById('syn-result');
  resultEl.classList.remove('hidden');
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// -----------------------------------------------------------------
// Copia negli appunti (con fallback)
// -----------------------------------------------------------------
async function _copyToClipboard() {
  const text = document.getElementById('syn-text')?.value;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    showToast('Copiato negli appunti ✓');
  } catch {
    // Fallback: seleziona il testo manualmente
    const ta = document.getElementById('syn-text');
    ta.select();
    ta.setSelectionRange(0, 99999);
    document.execCommand('copy');
    showToast('Copiato negli appunti ✓');
  }
}
