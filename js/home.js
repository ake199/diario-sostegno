// js/home.js — Schermata Home (Parte 2)
function renderHome() {
  document.getElementById('tab-home').innerHTML = `
    <div class="home-header">
      <div class="home-greeting">📒 Diario di Sostegno</div>
      <div class="home-date">${new Date().toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long' })}</div>
    </div>
    <div style="padding:16px">
      <div class="alert alert--info">
        <span>ℹ️</span>
        <span>App installata correttamente. Le funzioni complete arriveranno nei prossimi aggiornamenti.</span>
      </div>
    </div>
  `;
}
