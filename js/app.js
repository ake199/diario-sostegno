// js/app.js — Inizializzazione app e navigazione

// ============================================================
// Avvio
// ============================================================
async function initApp() {
  // Registra il service worker per il funzionamento offline
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Apri il database IndexedDB
  await openDB();

  // Carica le impostazioni predefinite se è la prima apertura
  await _initDefaultSettings();

  // Flusso PIN
  if (!hasPIN()) {
    // Prima apertura: obbliga la creazione del PIN
    await showPINSetup();
  } else if (isInactive()) {
    // Già usata in passato ma scaduto il timeout
    await showPINEntry();
  }

  // Mostra l'app
  document.getElementById('app').classList.remove('hidden');

  // Navigazione
  _setupBottomNav();

  // Avvia il monitor di inattività
  startInactivityMonitor();

  // Mostra la schermata Home
  navigateTo('home');
}

async function _initDefaultSettings() {
  // Materie predefinite
  if (await Settings.get('subjects') === undefined) {
    await Settings.set('subjects', [
      'Italiano', 'Latino', 'Storia', 'Geografia', 'Filosofia',
      'Scienze Umane', 'Diritto ed Economia', 'Inglese',
      'Matematica', 'Fisica', 'Scienze Naturali', 'Storia dell\'Arte',
      'Scienze Motorie', 'Religione/Alternativa', 'Altro'
    ]);
  }

  // Date quadrimestri (calcola l'anno scolastico corrente)
  if (await Settings.get('q1_start') === undefined) {
    const now  = new Date();
    const yr   = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    await Settings.set('q1_start', `${yr}-09-10`);
    await Settings.set('q1_end',   `${yr + 1}-01-31`);
    await Settings.set('q2_start', `${yr + 1}-02-01`);
    await Settings.set('q2_end',   `${yr + 1}-06-10`);
  }
}

// ============================================================
// Navigazione tab
// ============================================================
let _currentTab = 'home';

function _setupBottomNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.tab));
  });
}

function navigateTo(tab) {
  // Aggiorna nav
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  // Aggiorna sezioni
  document.querySelectorAll('.tab-content').forEach(s => {
    s.classList.toggle('active', s.id === 'tab-' + tab);
  });
  _currentTab = tab;
  _renderTab(tab);
  touchActivity();
}

function _renderTab(tab) {
  switch (tab) {
    case 'home':         renderHome();         break;
    case 'studenti':     renderStudents();     break;
    case 'timeline':     renderTimeline();     break;
    case 'statistiche':  renderStats();        break;
    case 'impostazioni': renderSettings();     break;
  }
}

// ============================================================
// Stack schermate secondarie (slide da destra, stile iOS)
// ============================================================
const _screenStack = [];

function pushScreen(id, buildFn) {
  const container = document.getElementById('screen-stack');

  // Rimuovi eventuale schermata già esistente con lo stesso id
  const old = document.getElementById('screen-' + id);
  if (old) old.remove();

  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.id = 'screen-' + id;
  container.appendChild(screen);

  buildFn(screen); // la funzione riempie la schermata

  container.style.pointerEvents = 'all';
  requestAnimationFrame(() => requestAnimationFrame(() => screen.classList.add('visible')));

  _screenStack.push(id);
  touchActivity();
  return screen;
}

function popScreen() {
  if (_screenStack.length === 0) return;
  const id = _screenStack.pop();
  const screen = document.getElementById('screen-' + id);
  if (screen) {
    screen.classList.remove('visible');
    setTimeout(() => screen.remove(), 300);
  }
  if (_screenStack.length === 0) {
    document.getElementById('screen-stack').style.pointerEvents = 'none';
  }
  // Ricarica il tab corrente
  _renderTab(_currentTab);
  touchActivity();
}

function popAllScreens() {
  while (_screenStack.length > 0) popScreen();
}

// ============================================================
// Utility di formattazione date
// ============================================================
function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

function formatDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) +
         ' ' +
         d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function formatDateForInput(ts) {
  if (!ts) return '';
  return new Date(ts).toISOString().split('T')[0];
}

function isoToTs(iso) {
  return iso ? new Date(iso).getTime() : 0;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ============================================================
// Utility modale semplice (per conferme)
// ============================================================
function showModal({ title, body, cancelLabel = 'Annulla', confirmLabel = 'Conferma', danger = false }) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-title">${title}</div>
        ${body ? `<div class="modal-body">${body}</div>` : ''}
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">
          <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" id="modal-confirm">${confirmLabel}</button>
          <button class="btn btn--secondary" id="modal-cancel">${cancelLabel}</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    backdrop.querySelector('#modal-confirm').addEventListener('click', () => {
      backdrop.remove(); resolve(true);
    });
    backdrop.querySelector('#modal-cancel').addEventListener('click', () => {
      backdrop.remove(); resolve(false);
    });
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) { backdrop.remove(); resolve(false); }
    });
  });
}

// Toast non invasivo
function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:calc(var(--nav-h) + 16px + env(safe-area-inset-bottom,0px));
    left:50%;transform:translateX(-50%);
    background:${type === 'success' ? '#27AE60' : '#C0392B'};
    color:white;padding:10px 20px;border-radius:100px;
    font-size:14px;font-weight:600;z-index:9999;
    box-shadow:0 4px 12px rgba(0,0,0,0.2);
    animation:slideUp 0.2s ease;white-space:nowrap;
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ============================================================
// Avvio quando il DOM è pronto
// ============================================================
document.addEventListener('DOMContentLoaded', initApp);
