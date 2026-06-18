/**
 * admin.js v4 — version stable et déboguée
 */

/* ── Vérification session ────────────────────── */
const session = DB.getSession();
if (!session || session.role !== 'admin') {
  window.location.href = '../index.html';
}

/* ── Logo & Entreprise ───────────────────────── */
(function initHeader() {
  const logo = DB.getLogo();
  if (logo) {
    const img = document.getElementById('headerLogo');
    img.src = logo;
    img.style.display = 'block';
  }
  const co = DB.getCompany();
  if (co.name) {
    document.getElementById('headerCompany').textContent = co.name + ' — Admin';
  }
})();

/* ── Navigation ──────────────────────────────── */
function showSection(id, link) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  if (link) link.classList.add('active');

  if (id === 'dashboard') renderDashboard();
  if (id === 'employees') renderEmployees();
  if (id === 'records')   { populateFilterEmployee(); renderRecords(); }
  if (id === 'stats')     { populateStatsEmployee(); renderStats(); }
  if (id === 'settings')  loadSettings();
}

/* ════════════════════════════════════════════
   TABLEAU DE BORD
   ════════════════════════════════════════════ */

function renderDashboard() {
  // Récupère la date du champ ou utilise aujourd'hui
  const inp  = document.getElementById('dashDate');
  const today = DB.getTodayKey();

  // Force la valeur si vide
  if (!inp.value) inp.value = today;
  const date = inp.value;

  // Récupère TOUS les enregistrements et filtre par date
  const allRecords  = DB.getRecords();
  const allEmployees = DB.getEmployees();
  const dayRecords  = allRecords.filter(r => r.date === date);

  // Calcul manuel des KPI (sans passer par getStatsByDate pour éviter tout problème)
  let present = 0, absent = 0, late = 0, partial = 0;
  const total = allEmployees.length;

  allEmployees.forEach(emp => {
    const rec = dayRecords.find(r => r.username === emp.username);

    if (!rec || !rec.arrival || rec.arrival === 'Non Signalé') {
      absent++;
      return;
    }

    // L'employé a pointé son arrivée → présent
    present++;

    // Vérifie le retard
    const co = DB.getCompany();
    const lateLimit = String(co.lateHour).padStart(2,'0') + ':' + String(co.lateMinute).padStart(2,'0');
    const arrHHMM   = rec.arrival.substring(0, 5);
    if (arrHHMM > lateLimit) late++;

    // Vérifie départ non signalé
    if (!rec.departure || rec.departure === 'Non Signalé') partial++;
  });

  // Mise à jour des KPI
  document.getElementById('kpiTotal').textContent   = total;
  document.getElementById('kpiPresent').textContent = present;
  document.getElementById('kpiAbsent').textContent  = absent;
  document.getElementById('kpiLate').textContent    = late;
  document.getElementById('kpiPartial').textContent = partial;

  // Tableau de détail
  const tbody = document.getElementById('dashDetailBody');
  const empty = document.getElementById('dashEmpty');

  if (allEmployees.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = allEmployees.map(emp => {
    const rec = dayRecords.find(r => r.username === emp.username);

    if (!rec || !rec.arrival || rec.arrival === 'Non Signalé') {
      return `<tr>
        <td><strong>${esc(emp.username)}</strong></td>
        <td>${badgeTime(null)}</td>
        <td>${badgeTime(null)}</td>
        <td><span class="badge badge-missing">Absent</span></td>
      </tr>`;
    }

    // Calcul statut
    const co = DB.getCompany();
    const lateLimit = String(co.lateHour).padStart(2,'0') + ':' + String(co.lateMinute).padStart(2,'0');
    const arrHHMM   = rec.arrival.substring(0, 5);
    const isLate    = arrHHMM > lateLimit;
    const hasDepart = rec.departure && rec.departure !== 'Non Signalé';

    let badgeHTML = '<span class="badge badge-present">Présent</span>';
    if (isLate)    badgeHTML += ' <span class="badge badge-late">En retard</span>';
    if (!hasDepart) badgeHTML += ' <span class="badge badge-partial">Départ non signalé</span>';

    return `<tr>
      <td><strong>${esc(emp.username)}</strong></td>
      <td>${badgeTime(rec.arrival)}</td>
      <td>${badgeTime(rec.departure)}</td>
      <td>${badgeHTML}</td>
    </tr>`;
  }).join('');
}

/* ════════════════════════════════════════════
   EMPLOYÉS
   ════════════════════════════════════════════ */

let editMode = false, editTarget = null;

function renderEmployees() {
  const employees = DB.getEmployees();
  const tbody = document.getElementById('empTableBody');
  const empty = document.getElementById('emptyEmp');

  if (employees.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = employees.map((emp, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${esc(emp.username)}</strong></td>
      <td>${new Date(emp.createdAt).toLocaleDateString('fr-FR')}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon" onclick="openEditModal('${esc(emp.username)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Modifier
          </button>
          <button class="btn-icon danger" onclick="askDelete('${esc(emp.username)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
            Supprimer
          </button>
        </div>
      </td>
    </tr>`).join('');
}

function openModal() {
  editMode = false; editTarget = null;
  document.getElementById('modalTitle').textContent = 'Ajouter un employé';
  document.getElementById('newUsername').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('newUsername').disabled = false;
  document.getElementById('modalError').style.display = 'none';
  document.getElementById('empModal').style.display = 'flex';
}

function openEditModal(username) {
  editMode = true; editTarget = username;
  document.getElementById('modalTitle').textContent = 'Modifier le mot de passe';
  document.getElementById('newUsername').value = username;
  document.getElementById('newUsername').disabled = true;
  document.getElementById('newPassword').value = '';
  document.getElementById('modalError').style.display = 'none';
  document.getElementById('empModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('empModal').style.display = 'none';
}

function saveEmployee() {
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newPassword').value;
  const errEl    = document.getElementById('modalError');

  if (!username || !password) { showModalError(errEl, 'Veuillez remplir tous les champs.'); return; }
  if (password.length < 4)    { showModalError(errEl, 'Mot de passe : 4 caractères minimum.'); return; }

  const result = editMode ? DB.updateUser(editTarget, password) : DB.addUser(username, password);
  if (!result.ok) { showModalError(errEl, result.msg); return; }

  closeModal();
  renderEmployees();
  populateFilterEmployee();
  populateStatsEmployee();
}

let deleteTarget = null;

function askDelete(username) {
  deleteTarget = username;
  document.getElementById('deleteEmpName').textContent = username;
  document.getElementById('deleteModal').style.display = 'flex';
}

function closeDeleteModal() {
  deleteTarget = null;
  document.getElementById('deleteModal').style.display = 'none';
}

function confirmDelete() {
  if (deleteTarget) DB.deleteUser(deleteTarget);
  deleteTarget = null;
  closeDeleteModal();
  renderEmployees();
  populateFilterEmployee();
  populateStatsEmployee();
}

function showModalError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}

function toggleModalPw() {
  const input = document.getElementById('newPassword');
  const icon  = document.getElementById('modalEyeIcon');
  if (input.type === 'password') {
    input.type = 'text';
    icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
  } else {
    input.type = 'password';
    icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
  }
}

/* ════════════════════════════════════════════
   POINTAGES
   ════════════════════════════════════════════ */

function populateFilterEmployee() {
  const sel = document.getElementById('filterEmployee');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Tous</option>';
  DB.getEmployees().forEach(e => {
    const o = document.createElement('option');
    o.value = e.username; o.textContent = e.username;
    sel.appendChild(o);
  });
  sel.value = cur;
}

function getFilteredRecords() {
  let records = DB.getRecords();
  const ef = document.getElementById('filterEmployee').value;
  const ff = document.getElementById('filterFrom').value;
  const tf = document.getElementById('filterTo').value;
  if (ef) records = records.filter(r => r.username === ef);
  if (ff) records = records.filter(r => r.date >= ff);
  if (tf) records = records.filter(r => r.date <= tf);
  records.sort((a, b) => b.date.localeCompare(a.date) || a.username.localeCompare(b.username));
  return records;
}

function renderRecords() {
  const records = getFilteredRecords();
  const tbody   = document.getElementById('recordsTableBody');
  const empty   = document.getElementById('emptyRecords');

  if (records.length === 0) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  tbody.innerHTML = records.map(r => `
    <tr>
      <td>${formatDate(r.date)}</td>
      <td><strong>${esc(r.username)}</strong></td>
      <td>${badgeTime(r.arrival)}</td>
      <td class="pos-cell">${posLink(r.posArrival)}</td>
      <td>${badgeTime(r.departure)}</td>
      <td class="pos-cell">${posLink(r.posDeparture)}</td>
      <td class="motif-cell">${r.motif ? esc(r.motif) : '<span class="text-muted">—</span>'}</td>
    </tr>`).join('');
}

function posLink(pos) {
  if (!pos || pos === '—' || pos === 'Non disponible' || pos === 'Non Signalé') {
    return `<span class="text-muted">${esc(pos || '—')}</span>`;
  }
  const parts = pos.split(',');
  if (parts.length === 2) {
    const lat = parts[0].trim(), lng = parts[1].trim();
    return `<a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16" target="_blank" class="pos-link">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
      </svg>
      ${esc(lat)}, ${esc(lng)}
    </a>`;
  }
  return esc(pos);
}

function resetFilters() {
  document.getElementById('filterEmployee').value = '';
  document.getElementById('filterFrom').value = '';
  document.getElementById('filterTo').value = '';
  renderRecords();
}

/* ════════════════════════════════════════════
   STATISTIQUES
   ════════════════════════════════════════════ */

function populateStatsEmployee() {
  const sel = document.getElementById('statsEmployee');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Tous les employés</option>';
  DB.getEmployees().forEach(e => {
    const o = document.createElement('option');
    o.value = e.username; o.textContent = e.username;
    sel.appendChild(o);
  });
  sel.value = cur;
}

function getStatsData() {
  const empFilter  = document.getElementById('statsEmployee').value;
  const today      = DB.getTodayKey();
  const fromFilter = document.getElementById('statsFrom').value || today;
  const toFilter   = document.getElementById('statsTo').value   || today;

  let records = DB.getRecords();
  if (empFilter) records = records.filter(r => r.username === empFilter);
  records = records.filter(r => r.date >= fromFilter && r.date <= toFilter);
  records.sort((a, b) => b.date.localeCompare(a.date) || a.username.localeCompare(b.username));
  return records;
}

function renderStats() {
  // Initialise les dates si vides
  const today = DB.getTodayKey();
  const sf = document.getElementById('statsFrom');
  const st = document.getElementById('statsTo');
  if (!st.value) st.value = today;
  if (!sf.value) {
    const d = new Date(); d.setDate(d.getDate() - 29);
    sf.value = DB._localDateStr(d);
  }

  const records = getStatsData();
  const tbody   = document.getElementById('statsTableBody');
  const empty   = document.getElementById('emptyStats');
  const summary = document.getElementById('statsSummary');

  if (records.length === 0) {
    tbody.innerHTML = ''; empty.style.display = 'block'; summary.innerHTML = '';
    return;
  }
  empty.style.display = 'none';

  // Calcul résumé
  let present = 0, absent = 0, late = 0, partial = 0;
  const co = DB.getCompany();
  const lateLimit = String(co.lateHour).padStart(2,'0') + ':' + String(co.lateMinute).padStart(2,'0');

  records.forEach(r => {
    if (!r.arrival || r.arrival === 'Non Signalé') { absent++; return; }
    present++;
    if (r.arrival.substring(0,5) > lateLimit) late++;
    if (!r.departure || r.departure === 'Non Signalé') partial++;
  });

  summary.innerHTML = `
    <div class="stats-kpi-row">
      <div class="stats-kpi kpi-present"><strong>${present}</strong><span>Présents</span></div>
      <div class="stats-kpi kpi-absent"><strong>${absent}</strong><span>Absents</span></div>
      <div class="stats-kpi kpi-late"><strong>${late}</strong><span>Retards</span></div>
      <div class="stats-kpi kpi-partial"><strong>${partial}</strong><span>Départ non signalé</span></div>
      <div class="stats-kpi kpi-total"><strong>${records.length}</strong><span>Total entrées</span></div>
    </div>`;

  tbody.innerHTML = records.map(r => {
    const isAbsent = !r.arrival || r.arrival === 'Non Signalé';
    const isLate   = !isAbsent && r.arrival.substring(0,5) > lateLimit;
    const noDepart = !r.departure || r.departure === 'Non Signalé';

    let badgeHTML = '';
    if (isAbsent) {
      badgeHTML = '<span class="badge badge-missing">Absent</span>';
    } else {
      badgeHTML = '<span class="badge badge-present">Présent</span>';
      if (isLate)   badgeHTML += ' <span class="badge badge-late">En retard</span>';
      if (noDepart) badgeHTML += ' <span class="badge badge-partial">Départ non signalé</span>';
    }

    return `<tr>
      <td>${formatDate(r.date)}</td>
      <td><strong>${esc(r.username)}</strong></td>
      <td>${badgeTime(r.arrival)}</td>
      <td>${badgeTime(r.departure)}</td>
      <td>${badgeHTML}</td>
      <td class="motif-cell">${r.motif ? esc(r.motif) : '<span class="text-muted">—</span>'}</td>
    </tr>`;
  }).join('');
}

function resetStatsFilters() {
  document.getElementById('statsEmployee').value = '';
  document.getElementById('statsFrom').value = '';
  document.getElementById('statsTo').value = '';
  renderStats();
}

/* ════════════════════════════════════════════
   PARAMÈTRES
   ════════════════════════════════════════════ */

function loadSettings() {
  const co = DB.getCompany();
  document.getElementById('settingCompanyName').value = co.name || '';
  document.getElementById('lateHour').value   = co.lateHour   !== undefined ? co.lateHour   : 8;
  document.getElementById('lateMinute').value = co.lateMinute !== undefined ? co.lateMinute : 0;
  const logo = DB.getLogo();
  if (logo) {
    const prev = document.getElementById('settingLogoPreview');
    prev.src = logo; prev.style.display = 'block';
  }
}

document.getElementById('settingLogoInput').addEventListener('change', function () {
  const file = this.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    DB.saveLogo(e.target.result);
    const prev = document.getElementById('settingLogoPreview');
    prev.src = e.target.result; prev.style.display = 'block';
    const img = document.getElementById('headerLogo');
    img.src = e.target.result; img.style.display = 'block';
  };
  reader.readAsDataURL(file);
});

function saveSettings() {
  const name       = document.getElementById('settingCompanyName').value.trim();
  const lateHour   = parseInt(document.getElementById('lateHour').value)   || 8;
  const lateMinute = parseInt(document.getElementById('lateMinute').value) || 0;
  DB.saveCompany({ name, lateHour, lateMinute });
  document.getElementById('headerCompany').textContent = name ? name + ' — Admin' : 'Administration';
  showFlash('✓ Paramètres enregistrés.');
}

/* ════════════════════════════════════════════
   EXPORTS PDF
   ════════════════════════════════════════════ */

function exportPDF() {
  const records = getFilteredRecords();
  if (!records.length) { alert('Aucune donnée à exporter.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const co  = DB.getCompany();

  doc.setFillColor(26,39,68); doc.rect(0,0,297,22,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(13); doc.setFont('helvetica','bold');
  doc.text((co.name ? co.name + ' — ' : '') + 'Registre de Pointage', 14, 14);
  doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text('Généré le ' + new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'}), 283, 14, {align:'right'});

  doc.autoTable({
    startY: 28,
    head: [['Date','Employé','Arrivée','Pos. Arrivée','Départ','Pos. Départ','Motif']],
    body: records.map(r => [
      formatDate(r.date), r.username,
      r.arrival   || '—', r.posArrival   || '—',
      r.departure || '—', r.posDeparture || '—',
      r.motif     || '—'
    ]),
    styles: { font:'helvetica', fontSize:8, cellPadding:3 },
    headStyles: { fillColor:[16,185,129], textColor:255, fontStyle:'bold' },
    alternateRowStyles: { fillColor:[248,250,252] },
    columnStyles: { 0:{cellWidth:22},1:{cellWidth:25},2:{cellWidth:20},3:{cellWidth:38},4:{cellWidth:20},5:{cellWidth:38} }
  });

  const pages = doc.getNumberOfPages();
  for (let i=1;i<=pages;i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150); doc.text(`Page ${i}/${pages}`,148,205,{align:'center'}); }
  doc.save('pointages_' + DB.getTodayKey() + '.pdf');
}

function exportStatsPDF() {
  const records = getStatsData();
  if (!records.length) { alert('Aucune donnée à exporter.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const co  = DB.getCompany();
  const lateLimit = String(co.lateHour).padStart(2,'0') + ':' + String(co.lateMinute).padStart(2,'0');

  doc.setFillColor(26,39,68); doc.rect(0,0,297,22,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(13); doc.setFont('helvetica','bold');
  doc.text((co.name ? co.name + ' — ' : '') + 'Statistiques de Pointage', 14, 14);
  doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text('Généré le ' + new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'}), 283, 14, {align:'right'});

  doc.autoTable({
    startY: 28,
    head: [['Date','Employé','Arrivée','Départ','Statut','Motif']],
    body: records.map(r => {
      const isAbsent = !r.arrival || r.arrival === 'Non Signalé';
      const isLate   = !isAbsent && r.arrival.substring(0,5) > lateLimit;
      const noDepart = !r.departure || r.departure === 'Non Signalé';
      let statut = isAbsent ? 'Absent' : 'Présent';
      if (!isAbsent && isLate)   statut += ' / En retard';
      if (!isAbsent && noDepart) statut += ' / Départ non signalé';
      return [formatDate(r.date), r.username, r.arrival||'—', r.departure||'—', statut, r.motif||'—'];
    }),
    styles: { font:'helvetica', fontSize:8, cellPadding:3 },
    headStyles: { fillColor:[59,130,246], textColor:255, fontStyle:'bold' },
    alternateRowStyles: { fillColor:[248,250,252] }
  });

  const pages = doc.getNumberOfPages();
  for (let i=1;i<=pages;i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150); doc.text(`Page ${i}/${pages}`,148,205,{align:'center'}); }
  doc.save('statistiques_' + DB.getTodayKey() + '.pdf');
}

/* ════════════════════════════════════════════
   EXPORTS EXCEL
   ════════════════════════════════════════════ */

function exportExcel() {
  const records = getFilteredRecords();
  if (!records.length) { alert('Aucune donnée à exporter.'); return; }
  const data = [["Date","Employé","Heure d'arrivée","Position arrivée","Heure de départ","Position départ","Motif"]];
  records.forEach(r => data.push([formatDate(r.date), r.username, r.arrival||'—', r.posArrival||'—', r.departure||'—', r.posDeparture||'—', r.motif||'—']));
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:14},{wch:18},{wch:14},{wch:30},{wch:14},{wch:30},{wch:35}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pointages');
  XLSX.writeFile(wb, 'pointages_' + DB.getTodayKey() + '.xlsx');
}

function exportStatsExcel() {
  const records = getStatsData();
  if (!records.length) { alert('Aucune donnée à exporter.'); return; }
  const co = DB.getCompany();
  const lateLimit = String(co.lateHour).padStart(2,'0') + ':' + String(co.lateMinute).padStart(2,'0');
  const data = [["Date","Employé","Heure d'arrivée","Heure de départ","Statut","Motif"]];
  records.forEach(r => {
    const isAbsent = !r.arrival || r.arrival === 'Non Signalé';
    const isLate   = !isAbsent && r.arrival.substring(0,5) > lateLimit;
    const noDepart = !r.departure || r.departure === 'Non Signalé';
    let statut = isAbsent ? 'Absent' : 'Présent';
    if (!isAbsent && isLate)   statut += ' / En retard';
    if (!isAbsent && noDepart) statut += ' / Départ non signalé';
    data.push([formatDate(r.date), r.username, r.arrival||'—', r.departure||'—', statut, r.motif||'—']);
  });
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:14},{wch:18},{wch:14},{wch:14},{wch:30},{wch:35}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Statistiques');
  XLSX.writeFile(wb, 'statistiques_' + DB.getTodayKey() + '.xlsx');
}

/* ── Helpers ─────────────────────────────────── */
function badgeTime(val) {
  if (!val)                  return '<span class="badge badge-none">—</span>';
  if (val === 'Non Signalé') return '<span class="badge badge-missing">Non Signalé</span>';
  return `<span class="badge badge-ok">${esc(val)}</span>`;
}

function statusBadge(status) {
  const map = {
    present : ['badge-present', 'Présent'],
    absent  : ['badge-missing', 'Absent'],
    late    : ['badge-late',    'En retard'],
    partial : ['badge-partial', 'Départ non signalé']
  };
  const [cls, label] = map[status] || ['badge-none', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function formatDate(d) {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let flashTimer;
function showFlash(msg) {
  let el = document.getElementById('adminFlash');
  if (!el) {
    el = document.createElement('div');
    el.id = 'adminFlash';
    el.className = 'flash-msg flash-success';
    document.body.appendChild(el);
  }
  el.textContent = msg; el.style.display = 'block';
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function logout() {
  DB.clearSession();
  window.location.href = '../index.html';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeDeleteModal(); }
});

/* ── Initialisation au chargement ────────────── */
renderDashboard();
