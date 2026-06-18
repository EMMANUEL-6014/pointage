/**
 * employee.js — Page de pointage employé avec géolocalisation
 */

const session = DB.getSession();
if (!session || session.role !== 'employee') window.location.href = '../index.html';

const username = session.username;

/* Header */
document.getElementById('empName').textContent = username;
const logo = DB.getLogo();
if (logo) { const img = document.getElementById('headerLogo'); img.src = logo; img.style.display = 'block'; }

const co = DB.getCompany();
if (co.name) document.getElementById('companyTitle').textContent = co.name;

/* Horloge */
function updateClock() {
  const now = new Date();
  document.getElementById('clockDisplay').textContent =
    now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  document.getElementById('dateDisplay').textContent =
    now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
updateClock();
setInterval(updateClock, 1000);

/* Statut du jour */
function loadTodayStatus() {
  const rec = DB.getTodayRecord(username);
  if (rec.arrival)   { setStatus('arrival', rec.arrival); document.getElementById('btnArrival').disabled = true; }
  if (rec.departure) { setStatus('departure', rec.departure); document.getElementById('btnDeparture').disabled = true; }
  if (rec.motif)     { document.getElementById('motifInput').value = rec.motif; }
  if (rec.posArrival)   document.getElementById('posArrivalDisplay').textContent = rec.posArrival;
  if (rec.posDeparture) document.getElementById('posDepartureDisplay').textContent = rec.posDeparture;
}

function setStatus(type, time) {
  const timeEl   = document.getElementById(type === 'arrival' ? 'arrivalTime' : 'departureTime');
  const statusEl = document.getElementById(type === 'arrival' ? 'arrivalStatus' : 'departureStatus');
  timeEl.textContent = time;
  statusEl.querySelector('.status-dot').classList.replace('dot-pending', 'dot-done');
}

loadTodayStatus();

/* Géolocalisation */
function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()  => resolve(null),
      { timeout: 8000 }
    );
  });
}

/* Pointage */
async function punch(type) {
  const btn = document.getElementById(type === 'arrival' ? 'btnArrival' : 'btnDeparture');
  btn.disabled = true;
  btn.classList.add('btn-loading');

  if (type === 'departure') {
    const rec = DB.getTodayRecord(username);
    if (!rec.arrival) {
      flash('Vous devez d\'abord pointer votre arrivée.', 'error');
      btn.disabled = false;
      btn.classList.remove('btn-loading');
      return;
    }
  }

  const position = await getPosition();
  let time;

  if (type === 'arrival') {
    time = DB.punchArrival(username, position);
    setStatus('arrival', time);
    const posStr = position ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : 'Non disponible';
    document.getElementById('posArrivalDisplay').textContent = posStr;
    flash('✓ Arrivée enregistrée à ' + time, 'success');
  } else {
    time = DB.punchDeparture(username, position);
    setStatus('departure', time);
    const posStr = position ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : 'Non disponible';
    document.getElementById('posDepartureDisplay').textContent = posStr;
    flash('✓ Départ enregistré à ' + time, 'success');
  }

  btn.classList.remove('btn-loading');
}

/* Motif */
function saveMotif() {
  const motif = document.getElementById('motifInput').value.trim();
  DB.saveMotif(username, motif);
  flash('✓ Motif enregistré.', 'success');
}

/* Flash */
let flashTimer;
function flash(msg, type) {
  const el = document.getElementById('flashMsg');
  el.textContent = msg;
  el.className = 'flash-msg flash-' + type;
  el.style.display = 'block';
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

function logout() { DB.clearSession(); window.location.href = '../index.html'; }
