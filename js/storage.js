/**
 * storage.js — Couche de données (localStorage)
 * v3 : correction bug date UTC vs heure locale
 */

const DB = {

  KEY_USERS    : 'ptg_users',
  KEY_RECORDS  : 'ptg_records',
  KEY_SESSION  : 'ptg_session',
  KEY_LOGO     : 'ptg_logo',
  KEY_COMPANY  : 'ptg_company',

  /* ─── INIT ──────────────────────────────────── */
  init() {
    if (!this.getUsers().find(u => u.role === 'admin')) {
      const users = this.getUsers();
      users.unshift({ id:'admin', username:'admin', password:'Admin@2024', role:'admin', createdAt: new Date().toISOString() });
      localStorage.setItem(this.KEY_USERS, JSON.stringify(users));
    }
    this._scheduleMidnightReset();
  },

  /* ─── ENTREPRISE ─────────────────────────────── */
  getCompany() {
    return JSON.parse(localStorage.getItem(this.KEY_COMPANY) || '{"name":"","lateHour":8,"lateMinute":0}');
  },
  saveCompany(data) {
    localStorage.setItem(this.KEY_COMPANY, JSON.stringify(data));
  },

  /* ─── UTILISATEURS ───────────────────────────── */
  getUsers()     { return JSON.parse(localStorage.getItem(this.KEY_USERS) || '[]'); },
  saveUsers(u)   { localStorage.setItem(this.KEY_USERS, JSON.stringify(u)); },
  findUser(u, p) { return this.getUsers().find(x => x.username === u && x.password === p) || null; },
  getEmployees() { return this.getUsers().filter(u => u.role === 'employee'); },

  addUser(username, password) {
    const users = this.getUsers();
    if (users.find(u => u.username === username)) return { ok: false, msg: 'Identifiant déjà utilisé.' };
    users.push({ id: 'emp_' + Date.now(), username, password, role: 'employee', createdAt: new Date().toISOString() });
    this.saveUsers(users);
    return { ok: true };
  },

  deleteUser(username) {
    this.saveUsers(this.getUsers().filter(u => u.username !== username));
  },

  updateUser(username, newPassword) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.username === username);
    if (idx === -1) return { ok: false, msg: 'Employé introuvable.' };
    users[idx].password = newPassword;
    this.saveUsers(users);
    return { ok: true };
  },

  /* ─── SESSION ────────────────────────────────── */
  setSession(user) {
    sessionStorage.setItem(this.KEY_SESSION, JSON.stringify({
      username: user.username, role: user.role, loginAt: new Date().toISOString()
    }));
  },
  getSession()   { return JSON.parse(sessionStorage.getItem(this.KEY_SESSION) || 'null'); },
  clearSession() { sessionStorage.removeItem(this.KEY_SESSION); },

  /* ─── POINTAGES ──────────────────────────────── */
  getRecords()   { return JSON.parse(localStorage.getItem(this.KEY_RECORDS) || '[]'); },
  saveRecords(r) { localStorage.setItem(this.KEY_RECORDS, JSON.stringify(r)); },

  // ✅ CORRECTION PRINCIPALE : utilise la date LOCALE et non UTC
  getTodayKey() {
    return this._localDateStr(new Date());
  },

  getTodayRecord(username) {
    const date = this.getTodayKey();
    const records = this.getRecords();
    let rec = records.find(r => r.username === username && r.date === date);
    if (!rec) {
      rec = { username, date, arrival: null, departure: null, posArrival: null, posDeparture: null, motif: '' };
      records.push(rec);
      this.saveRecords(records);
    }
    return rec;
  },

  punchArrival(username, position) {
    const now  = this._timeNow();
    const date = this.getTodayKey();
    const records = this.getRecords();
    const idx = records.findIndex(r => r.username === username && r.date === date);
    const posStr = position ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : 'Non disponible';
    if (idx === -1) {
      records.push({ username, date, arrival: now, departure: null, posArrival: posStr, posDeparture: null, motif: '' });
    } else {
      records[idx].arrival    = now;
      records[idx].posArrival = posStr;
    }
    this.saveRecords(records);
    return now;
  },

  punchDeparture(username, position) {
    const now  = this._timeNow();
    const date = this.getTodayKey();
    const records = this.getRecords();
    const idx = records.findIndex(r => r.username === username && r.date === date);
    const posStr = position ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : 'Non disponible';
    if (idx === -1) {
      records.push({ username, date, arrival: null, departure: now, posArrival: null, posDeparture: posStr, motif: '' });
    } else {
      records[idx].departure    = now;
      records[idx].posDeparture = posStr;
    }
    this.saveRecords(records);
    return now;
  },

  saveMotif(username, motif) {
    const date    = this.getTodayKey();
    const records = this.getRecords();
    const idx = records.findIndex(r => r.username === username && r.date === date);
    if (idx !== -1) { records[idx].motif = motif; }
    else { records.push({ username, date, arrival: null, departure: null, posArrival: null, posDeparture: null, motif }); }
    this.saveRecords(records);
  },

  /* ─── STATUTS ────────────────────────────────── */
  /*
   * Retourne un objet booléen { present, late, partial, absent }
   *
   *  absent  → pas d'arrivée
   *  present → a pointé l'arrivée (quelle que soit l'heure)
   *  late    → présent mais arrivée après la limite configurée
   *  partial → présent mais départ non signalé
   */
  getRecordStatus(rec) {
    const co = this.getCompany();
    const lateLimit = `${String(co.lateHour).padStart(2,'0')}:${String(co.lateMinute).padStart(2,'0')}`;

    if (!rec.arrival || rec.arrival === 'Non Signalé') {
      return { present: false, late: false, partial: false, absent: true };
    }

    // L'heure d'arrivée est au format "HH:MM:SS" → on prend les 5 premiers caractères "HH:MM"
    const arrivalHHMM  = rec.arrival.substring(0, 5);
    const isLate       = arrivalHHMM > lateLimit;
    const hasDeparture = rec.departure && rec.departure !== 'Non Signalé';

    return {
      present : true,
      late    : isLate,
      partial : !hasDeparture,
      absent  : false
    };
  },

  // Label unique pour badge (priorité : absent > late > partial > present)
  getRecordStatusLabel(rec) {
    const s = this.getRecordStatus(rec);
    if (s.absent)  return 'absent';
    if (s.late)    return 'late';
    if (s.partial) return 'partial';
    return 'present';
  },

  getStatsByDate(date) {
    const employees = this.getEmployees();
    const records   = this.getRecords().filter(r => r.date === date);
    const total     = employees.length;
    let present = 0, absent = 0, late = 0, partial = 0;

    employees.forEach(emp => {
      const rec = records.find(r => r.username === emp.username);
      if (!rec) { absent++; return; }
      const s = this.getRecordStatus(rec);
      if (s.absent)  { absent++;  return; }
      if (s.present)   present++;
      if (s.late)      late++;
      if (s.partial)   partial++;
    });

    return { date, total, present, absent, late, partial };
  },

  getStatsRange(from, to) {
    const days = [];
    const cur  = new Date(from + 'T00:00:00');
    const end  = new Date(to   + 'T00:00:00');
    while (cur <= end) {
      days.push(this._localDateStr(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days.map(d => this.getStatsByDate(d));
  },

  /* ─── RESET MINUIT ───────────────────────────── */
  runMidnightReset() {
    const yesterday = this._dateOffset(-1);
    const employees = this.getEmployees();
    const records   = this.getRecords();
    let changed = false;

    employees.forEach(emp => {
      let rec = records.find(r => r.username === emp.username && r.date === yesterday);
      if (!rec) {
        records.push({
          username: emp.username, date: yesterday,
          arrival: 'Non Signalé', departure: 'Non Signalé',
          posArrival: '—', posDeparture: '—', motif: ''
        });
        changed = true;
      } else {
        if (!rec.arrival)      { rec.arrival      = 'Non Signalé'; changed = true; }
        if (!rec.departure)    { rec.departure     = 'Non Signalé'; changed = true; }
        if (!rec.posArrival)   { rec.posArrival    = '—'; }
        if (!rec.posDeparture) { rec.posDeparture  = '—'; }
      }
    });

    if (changed) this.saveRecords(records);
    localStorage.setItem('ptg_lastReset', yesterday);
  },

  _scheduleMidnightReset() {
    const lastReset = localStorage.getItem('ptg_lastReset');
    const yesterday = this._dateOffset(-1);
    const today     = this.getTodayKey();
    if (lastReset !== yesterday && lastReset !== today) this.runMidnightReset();

    const now      = new Date();
    const midnight = new Date(now);
    midnight.setHours(23, 59, 0, 0);
    if (now > midnight) midnight.setDate(midnight.getDate() + 1);

    setTimeout(() => {
      this.runMidnightReset();
      setInterval(() => this.runMidnightReset(), 24 * 60 * 60 * 1000);
    }, midnight - now);
  },

  /* ─── LOGO ───────────────────────────────────── */
  saveLogo(d) { localStorage.setItem(this.KEY_LOGO, d); },
  getLogo()   { return localStorage.getItem(this.KEY_LOGO) || ''; },

  /* ─── HELPERS ────────────────────────────────── */
  _timeNow() {
    return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  },

  // ✅ Date locale YYYY-MM-DD (évite le décalage UTC)
  _localDateStr(d) {
    const date = d || new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const j = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${j}`;
  },

  _dateOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return this._localDateStr(d);
  }
};

DB.init();
