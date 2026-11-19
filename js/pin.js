// js/pin.js — Gestione PIN (creazione, verifica, blocco automatico)

const PIN_KEY          = 'ds_pin_hash';
const LAST_ACTIVE_KEY  = 'ds_last_active';
const ATTEMPTS_KEY     = 'ds_attempts';
const LOCKED_UNTIL_KEY = 'ds_locked_until';

const INACTIVITY_MS = 10 * 60 * 1000; // 10 minuti
const MAX_ATTEMPTS  = 5;
const LOCKOUT_MS    = 5 * 60 * 1000;  // 5 minuti

// ============================================================
// Hash (SHA-256) — sicuro anche per uso locale
// ============================================================
async function hashPIN(pin) {
  const data = new TextEncoder().encode(pin + ':diario-sostegno-2024');
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

function hasPIN()    { return !!localStorage.getItem(PIN_KEY); }
async function setPIN(pin) {
  localStorage.setItem(PIN_KEY, await hashPIN(pin));
}
async function verifyPIN(pin) {
  return (await hashPIN(pin)) === localStorage.getItem(PIN_KEY);
}
function clearPIN()  { localStorage.removeItem(PIN_KEY); }

// ============================================================
// Inattività
// ============================================================
function touchActivity() {
  localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
}

function isInactive() {
  const last = parseInt(localStorage.getItem(LAST_ACTIVE_KEY) || '0');
  return !last || (Date.now() - last > INACTIVITY_MS);
}

// ============================================================
// Blocco per tentativi
// ============================================================
function isLockedOut() {
  const until = parseInt(localStorage.getItem(LOCKED_UNTIL_KEY) || '0');
  return Date.now() < until;
}

function lockoutSecondsLeft() {
  const until = parseInt(localStorage.getItem(LOCKED_UNTIL_KEY) || '0');
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

function recordFailedAttempt() {
  const attempts = (parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0')) + 1;
  localStorage.setItem(ATTEMPTS_KEY, attempts.toString());
  if (attempts >= MAX_ATTEMPTS) {
    localStorage.setItem(LOCKED_UNTIL_KEY, (Date.now() + LOCKOUT_MS).toString());
    localStorage.setItem(ATTEMPTS_KEY, '0');
    return { locked: true };
  }
  return { locked: false, remaining: MAX_ATTEMPTS - attempts };
}

function clearLockout() {
  localStorage.setItem(ATTEMPTS_KEY, '0');
  localStorage.removeItem(LOCKED_UNTIL_KEY);
}

// ============================================================
// UI — Schermata CREAZIONE PIN
// ============================================================
let _setupResolve = null;
let _setupStep    = 'first';
let _setupFirst   = '';
let _setupInput   = '';

function showPINSetup() {
  return new Promise(resolve => {
    _setupResolve = resolve;
    _setupStep    = 'first';
    _setupFirst   = '';
    _setupInput   = '';

    const ov = document.getElementById('pin-setup-overlay');
    _setSetupSubtitle('Scegli un PIN di 4 cifre');
    _setSetupError('');
    _updateSetupDots();
    ov.classList.remove('hidden');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Tastierino setup
  document.getElementById('setup-pad').addEventListener('click', e => {
    const btn = e.target.closest('[data-digit]');
    const del = e.target.closest('#setup-del');
    if (btn) _setupPressDigit(btn.dataset.digit);
    if (del) _setupPressBack();
  });

  // Tastierino verifica
  document.getElementById('pin-pad').addEventListener('click', e => {
    const btn = e.target.closest('[data-digit]');
    const del = e.target.closest('#pin-del');
    if (btn && !btn.disabled) _pinPressDigit(btn.dataset.digit);
    if (del) _pinPressBack();
  });
});

function _setupPressDigit(d) {
  if (_setupInput.length >= 4) return;
  _setupInput += d;
  _updateSetupDots();
  if (_setupInput.length === 4) setTimeout(_processSetup, 150);
}

function _setupPressBack() {
  _setupInput = _setupInput.slice(0, -1);
  _updateSetupDots();
}

async function _processSetup() {
  if (_setupStep === 'first') {
    _setupFirst = _setupInput;
    _setupInput = '';
    _setupStep  = 'confirm';
    _setSetupSubtitle('Conferma il PIN');
    _setSetupError('');
    _updateSetupDots();
  } else {
    if (_setupInput === _setupFirst) {
      await setPIN(_setupInput);
      document.getElementById('pin-setup-overlay').classList.add('hidden');
      touchActivity();
      clearLockout();
      if (_setupResolve) { _setupResolve(); _setupResolve = null; }
    } else {
      _setSetupError('I PIN non corrispondono. Riprova dall\'inizio.');
      _setupStep  = 'first';
      _setupFirst = '';
      _setupInput = '';
      _setSetupSubtitle('Scegli un PIN di 4 cifre');
      _updateSetupDots();
    }
  }
}

function _setSetupSubtitle(msg) {
  document.getElementById('setup-subtitle').textContent = msg;
}

function _setSetupError(msg) {
  const el = document.getElementById('setup-error');
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
  if (msg) {
    el.classList.remove('shake');
    void el.offsetWidth; // reflow per animazione
    el.classList.add('shake');
  }
}

function _updateSetupDots() {
  for (let i = 0; i < 4; i++) {
    document.getElementById('setup-dot-' + i)
      .classList.toggle('filled', i < _setupInput.length);
  }
}

// ============================================================
// UI — Schermata INSERIMENTO PIN (verifica)
// ============================================================
let _pinResolve   = null;
let _pinInput     = '';
let _lockInterval = null;

function showPINEntry(message) {
  return new Promise(resolve => {
    _pinResolve = resolve;
    _pinInput   = '';

    const ov = document.getElementById('pin-overlay');
    document.getElementById('pin-subtitle').textContent = message || 'Inserisci il PIN';
    _setPinError('');
    _updatePinDots();
    ov.classList.remove('hidden');

    if (isLockedOut()) _startLockCountdown();
  });
}

function _pinPressDigit(d) {
  if (isLockedOut()) return;
  if (_pinInput.length >= 4) return;
  _pinInput += d;
  _updatePinDots();
  if (_pinInput.length === 4) setTimeout(_processPIN, 150);
}

function _pinPressBack() {
  _pinInput = _pinInput.slice(0, -1);
  _updatePinDots();
}

async function _processPIN() {
  const ok = await verifyPIN(_pinInput);
  if (ok) {
    clearLockout();
    touchActivity();
    if (_lockInterval) { clearInterval(_lockInterval); _lockInterval = null; }
    document.getElementById('pin-overlay').classList.add('hidden');
    if (_pinResolve) { _pinResolve(); _pinResolve = null; }
  } else {
    const result = recordFailedAttempt();
    if (result.locked) {
      _startLockCountdown();
    } else {
      _setPinError(`PIN errato. Tentativi rimasti: ${result.remaining}`);
    }
    _pinInput = '';
    _updatePinDots();
  }
}

function _startLockCountdown() {
  _setPinKeypadDisabled(true);
  _updateLockMsg();
  if (_lockInterval) clearInterval(_lockInterval);
  _lockInterval = setInterval(() => {
    if (!isLockedOut()) {
      clearInterval(_lockInterval);
      _lockInterval = null;
      _setPinKeypadDisabled(false);
      _setPinError('');
    } else {
      _updateLockMsg();
    }
  }, 1000);
}

function _updateLockMsg() {
  const s = lockoutSecondsLeft();
  const m = Math.floor(s / 60);
  const ss = s % 60;
  _setPinError(`Troppi tentativi. Riprova tra ${m > 0 ? m + 'm ' : ''}${ss}s.`);
}

function _setPinError(msg) {
  const el = document.getElementById('pin-error');
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
  if (msg) {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }
}

function _updatePinDots() {
  for (let i = 0; i < 4; i++) {
    document.getElementById('pin-dot-' + i)
      .classList.toggle('filled', i < _pinInput.length);
  }
}

function _setPinKeypadDisabled(disabled) {
  document.querySelectorAll('#pin-pad [data-digit]')
    .forEach(b => b.disabled = disabled);
}

// ============================================================
// Monitor inattività (eseguito dopo il login)
// ============================================================
function startInactivityMonitor() {
  ['touchstart', 'touchend', 'mousedown', 'keydown'].forEach(ev => {
    document.addEventListener(ev, touchActivity, { passive: true });
  });

  setInterval(() => {
    if (hasPIN() && isInactive()) {
      // Blocca mostrando la schermata PIN
      showPINEntry('L\'app è bloccata. Inserisci il PIN.').then(() => {
        // Sbloccato: nessuna azione necessaria
      });
    }
  }, 30_000); // controlla ogni 30 secondi
}
