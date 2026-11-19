// js/db.js — Strato dati (IndexedDB)
// Tutti i dati dell'app vengono salvati qui, sul telefono.

const DB_NAME    = 'DiarioSostegno';
const DB_VERSION = 1;

let _db = null;

// Apre (o crea) il database
function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;

      // Impostazioni chiave-valore
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // Studenti
      if (!db.objectStoreNames.contains('students')) {
        const st = db.createObjectStore('students', { keyPath: 'id', autoIncrement: true });
        st.createIndex('archived', 'archived', { unique: false });
      }

      // Osservazioni (note)
      if (!db.objectStoreNames.contains('observations')) {
        const ob = db.createObjectStore('observations', { keyPath: 'id', autoIncrement: true });
        ob.createIndex('studentId', 'studentId', { unique: false });
        ob.createIndex('datetime',  'datetime',  { unique: false });
      }

      // Scadenze
      if (!db.objectStoreNames.contains('deadlines')) {
        const dl = db.createObjectStore('deadlines', { keyPath: 'id', autoIncrement: true });
        dl.createIndex('studentId', 'studentId', { unique: false });
        dl.createIndex('date',      'date',      { unique: false });
      }
    };

    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

// Converte una richiesta IndexedDB in Promise
function p(request) {
  return new Promise((res, rej) => {
    request.onsuccess = () => res(request.result);
    request.onerror   = () => rej(request.error);
  });
}

// Shortcut per ottenere un object store
function store(name, mode = 'readonly') {
  return _db.transaction(name, mode).objectStore(name);
}

// ============================================================
// Settings
// ============================================================
const Settings = {
  async get(key) {
    await openDB();
    const row = await p(store('settings').get(key));
    return row ? row.value : undefined;
  },
  async set(key, value) {
    await openDB();
    return p(store('settings', 'readwrite').put({ key, value }));
  },
  async getAll() {
    await openDB();
    return p(store('settings').getAll());
  }
};

// ============================================================
// Studenti
// Struttura: { id, pseudonym, year, section, weeklyHours, subjects[], generalNotes, archived, createdAt, updatedAt }
// ============================================================
const Students = {
  async getAll(includeArchived = false) {
    await openDB();
    const all = await p(store('students').getAll());
    return includeArchived ? all : all.filter(s => !s.archived);
  },
  async get(id) {
    await openDB();
    return p(store('students').get(id));
  },
  async add(student) {
    await openDB();
    student.archived  = false;
    student.createdAt = Date.now();
    student.updatedAt = Date.now();
    return p(store('students', 'readwrite').add(student));
  },
  async update(student) {
    await openDB();
    student.updatedAt = Date.now();
    return p(store('students', 'readwrite').put(student));
  },
  async archive(id) {
    const s = await this.get(id);
    if (s) { s.archived = true; await this.update(s); }
  },
  async unarchive(id) {
    const s = await this.get(id);
    if (s) { s.archived = false; await this.update(s); }
  }
};

// ============================================================
// Osservazioni
// Struttura: { id, studentId, text, tags[], subject, datetime, hasABC, antecedent, behavior, consequence, createdAt, updatedAt }
// ============================================================
const Observations = {
  async getForStudent(studentId) {
    await openDB();
    const idx = store('observations').index('studentId');
    return p(idx.getAll(studentId));
  },
  async getAll() {
    await openDB();
    return p(store('observations').getAll());
  },
  async get(id) {
    await openDB();
    return p(store('observations').get(id));
  },
  async add(obs) {
    await openDB();
    obs.createdAt = Date.now();
    obs.updatedAt = Date.now();
    return p(store('observations', 'readwrite').add(obs));
  },
  async update(obs) {
    await openDB();
    obs.updatedAt = Date.now();
    return p(store('observations', 'readwrite').put(obs));
  },
  async delete(id) {
    await openDB();
    return p(store('observations', 'readwrite').delete(id));
  }
};

// ============================================================
// Scadenze
// Struttura: { id, studentId, type ('glo_i'|'glo_m'|'glo_f'|'pei'), date 'YYYY-MM-DD', createdAt }
// ============================================================
const Deadlines = {
  async getAll() {
    await openDB();
    return p(store('deadlines').getAll());
  },
  async getForStudent(studentId) {
    await openDB();
    return p(store('deadlines').index('studentId').getAll(studentId));
  },
  async add(dl) {
    await openDB();
    dl.createdAt = Date.now();
    return p(store('deadlines', 'readwrite').add(dl));
  },
  async update(dl) {
    await openDB();
    return p(store('deadlines', 'readwrite').put(dl));
  },
  async delete(id) {
    await openDB();
    return p(store('deadlines', 'readwrite').delete(id));
  }
};

// ============================================================
// Backup export / import
// ============================================================
const Backup = {
  async export() {
    await openDB();
    const [students, observations, deadlines, settings] = await Promise.all([
      Students.getAll(true),
      Observations.getAll(),
      Deadlines.getAll(),
      Settings.getAll()
    ]);
    return {
      version:    1,
      exportedAt: new Date().toISOString(),
      students,
      observations,
      deadlines,
      // Il PIN non viene mai esportato per sicurezza
      settings: settings.filter(s => s.key !== 'pin_hash')
    };
  },

  async import(data) {
    await openDB();
    if (!data || data.version !== 1) throw new Error('File di backup non valido.');

    const t = _db.transaction(['students', 'observations', 'deadlines', 'settings'], 'readwrite');

    // Svuota i tre store (non toccare le impostazioni PIN)
    await new Promise((res, rej) => {
      const c = t.objectStore('students').clear();
      c.onsuccess = res; c.onerror = rej;
    });
    await new Promise((res, rej) => {
      const c = t.objectStore('observations').clear();
      c.onsuccess = res; c.onerror = rej;
    });
    await new Promise((res, rej) => {
      const c = t.objectStore('deadlines').clear();
      c.onsuccess = res; c.onerror = rej;
    });

    for (const s of (data.students     || [])) t.objectStore('students').put(s);
    for (const o of (data.observations || [])) t.objectStore('observations').put(o);
    for (const d of (data.deadlines    || [])) t.objectStore('deadlines').put(d);
    for (const s of (data.settings     || [])) {
      if (s.key !== 'pin_hash') t.objectStore('settings').put(s);
    }

    return new Promise((res, rej) => { t.oncomplete = res; t.onerror = rej; });
  },

  async deleteAll() {
    await openDB();
    const t = _db.transaction(['students', 'observations', 'deadlines'], 'readwrite');
    t.objectStore('students').clear();
    t.objectStore('observations').clear();
    t.objectStore('deadlines').clear();
    return new Promise((res, rej) => { t.oncomplete = res; t.onerror = rej; });
  }
};
