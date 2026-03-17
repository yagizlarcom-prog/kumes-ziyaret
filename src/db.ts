import * as SQLite from 'expo-sqlite';
import { BreederAgeEntry, CoopPeriod, KesimHistory, MedicationEntry, Visit } from './models';

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY NOT NULL,
  period_id TEXT,
  coop_name TEXT,
  producer_name TEXT NOT NULL,
  field_officer TEXT,
  visit_date TEXT,
  arrival_time TEXT,
  departure_time TEXT,
  stay_minutes INTEGER,
  coop_area_m2 REAL,
  entry_date TEXT,
  entry_count INTEGER,
  chick_origin TEXT,
  breeder_and_age TEXT,
  density_per_m2 REAL,
  first_week_death_count INTEGER,
  first_week_death_percent REAL,
  visit_death_count INTEGER,
  visit_death_percent REAL,
  chick_age TEXT,
  oca REAL,
  std_oca REAL,
  ger_std REAL,
  coop_remaining INTEGER,
  total_live_kg REAL,
  feed_used REAL,
  fcr REAL,
  randiman REAL,
  ventilation_capacity TEXT,
  biosecurity TEXT,
  notes TEXT,
  created_at TEXT
);
`;

const CREATE_KESIM_HISTORY_SQL = `
CREATE TABLE IF NOT EXISTS kesim_history (
  id TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL,
  animal_count INTEGER,
  created_at TEXT
);
`;

const CREATE_MEDS_SQL = `
CREATE TABLE IF NOT EXISTS meds (
  id TEXT PRIMARY KEY NOT NULL,
  period_id TEXT,
  coop_name TEXT NOT NULL,
  med_code TEXT,
  med_name TEXT NOT NULL,
  unit TEXT,
  quantity REAL,
  created_at TEXT
);
`;

const CREATE_COOP_PERIODS_SQL = `
CREATE TABLE IF NOT EXISTS coop_periods (
  id TEXT PRIMARY KEY NOT NULL,
  coop_name TEXT NOT NULL,
  started_at TEXT,
  created_at TEXT
);
`;

const CREATE_BREEDER_AGES_SQL = `
CREATE TABLE IF NOT EXISTS breeder_ages (
  id TEXT PRIMARY KEY NOT NULL,
  coop_name TEXT NOT NULL,
  breeder_age TEXT NOT NULL,
  created_at TEXT
);
`;


let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const getDb = async () => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('visits.db');
  }
  return dbPromise;
};


const backfillCoopPeriods = async (db: SQLite.SQLiteDatabase) => {
  const coopRows = await db.getAllAsync<{ coop_name: string }>(
    `SELECT DISTINCT coop_name FROM visits
     WHERE coop_name IS NOT NULL
       AND trim(coop_name) <> ''
       AND (period_id IS NULL OR period_id = '')`
  );

  for (const row of coopRows) {
    const coop = row.coop_name.trim();
    if (!coop) continue;

    const existing = await db.getAllAsync<CoopPeriod>(
      'SELECT * FROM coop_periods WHERE coop_name = ? COLLATE NOCASE ORDER BY started_at DESC, created_at DESC LIMIT 1',
      [coop]
    );

    let periodId = existing[0]?.id;
    if (!periodId) {
      periodId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const now = new Date().toISOString();
      await db.runAsync(
        'INSERT INTO coop_periods (id, coop_name, started_at, created_at) VALUES (?,?,?,?)',
        [periodId, coop, now, now]
      );
    }

    await db.runAsync(
      'UPDATE visits SET period_id = ? WHERE coop_name = ? COLLATE NOCASE AND (period_id IS NULL OR period_id = "")',
      [periodId, coop]
    );
  }
};
export const initDb = async () => {
  const db = await getDb();
  await db.execAsync(CREATE_SQL);
  await db.execAsync(CREATE_KESIM_HISTORY_SQL);
  await db.execAsync(CREATE_MEDS_SQL);
  await db.execAsync(CREATE_COOP_PERIODS_SQL);
  await db.execAsync(CREATE_BREEDER_AGES_SQL);

  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(visits)');
  const hasCoopName = columns.some(c => c.name === 'coop_name');
  if (!hasCoopName) {
    await db.execAsync('ALTER TABLE visits ADD COLUMN coop_name TEXT');
  }
  const hasPeriodId = columns.some(c => c.name === 'period_id');
  if (!hasPeriodId) {
    await db.execAsync('ALTER TABLE visits ADD COLUMN period_id TEXT');
  }

  await backfillCoopPeriods(db);
};

export const insertVisit = async (v: Visit) => {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO visits (
      id, period_id, coop_name, producer_name, field_officer, visit_date, arrival_time, departure_time,
      stay_minutes, coop_area_m2, entry_date, entry_count, chick_origin, breeder_and_age,
      density_per_m2, first_week_death_count, first_week_death_percent,
      visit_death_count, visit_death_percent, chick_age, oca, std_oca, ger_std,
      coop_remaining, total_live_kg, feed_used, fcr, randiman,
      ventilation_capacity, biosecurity, notes, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      v.id, v.period_id ?? null, v.coop_name, v.producer_name, v.field_officer, v.visit_date, v.arrival_time, v.departure_time,
      v.stay_minutes, v.coop_area_m2, v.entry_date, v.entry_count, v.chick_origin, v.breeder_and_age,
      v.density_per_m2, v.first_week_death_count, v.first_week_death_percent,
      v.visit_death_count, v.visit_death_percent, v.chick_age, v.oca, v.std_oca, v.ger_std,
      v.coop_remaining, v.total_live_kg, v.feed_used, v.fcr, v.randiman,
      v.ventilation_capacity, v.biosecurity, v.notes, v.created_at
    ]
  );
};

export const getVisits = async () => {
  const db = await getDb();
  return db.getAllAsync<Visit>('SELECT * FROM visits ORDER BY visit_date DESC, created_at DESC');
};

export const getRecentVisits = async (limit = 50) => {
  const db = await getDb();
  return db.getAllAsync<Visit>(
    'SELECT * FROM visits ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
};

export const getLatestVisitByCoopName = async (coopName: string, periodId?: string | null) => {
  const db = await getDb();
  const trimmed = coopName.trim();
  if (!trimmed) return null;
  const query = periodId
    ? 'SELECT * FROM visits WHERE coop_name = ? COLLATE NOCASE AND period_id = ? ORDER BY created_at DESC LIMIT 1'
    : 'SELECT * FROM visits WHERE coop_name = ? COLLATE NOCASE ORDER BY created_at DESC LIMIT 1';
  const params = periodId ? [trimmed, periodId] : [trimmed];
  const rows = await db.getAllAsync<Visit>(query, params);
  return rows[0] ?? null;
};


export const getLatestCoopPeriod = async (coopName: string) => {
  const db = await getDb();
  const trimmed = coopName.trim();
  if (!trimmed) return null;
  const rows = await db.getAllAsync<CoopPeriod>(
    'SELECT * FROM coop_periods WHERE coop_name = ? COLLATE NOCASE ORDER BY started_at DESC, created_at DESC LIMIT 1',
    [trimmed]
  );
  return rows[0] ?? null;
};

export const startNewCoopPeriod = async (coopName: string) => {
  const db = await getDb();
  const trimmed = coopName.trim();
  if (!trimmed) {
    throw new Error('Kümes adı boş.');
  }
  const now = new Date().toISOString();
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await db.runAsync(
    'INSERT INTO coop_periods (id, coop_name, started_at, created_at) VALUES (?,?,?,?)',
    [id, trimmed, now, now]
  );
  return { id, coop_name: trimmed, started_at: now, created_at: now } as CoopPeriod;
};

export const ensureCoopPeriodId = async (coopName: string) => {
  const existing = await getLatestCoopPeriod(coopName);
  if (existing?.id) return existing.id;
  const created = await startNewCoopPeriod(coopName);
  return created.id;
};

export const updateVisit = async (v: Visit) => {
  const db = await getDb();
  await db.runAsync(
    `UPDATE visits SET
      period_id = ?,
      coop_name = ?,
      producer_name = ?,
      field_officer = ?,
      visit_date = ?,
      arrival_time = ?,
      departure_time = ?,
      stay_minutes = ?,
      coop_area_m2 = ?,
      entry_date = ?,
      entry_count = ?,
      chick_origin = ?,
      breeder_and_age = ?,
      density_per_m2 = ?,
      first_week_death_count = ?,
      first_week_death_percent = ?,
      visit_death_count = ?,
      visit_death_percent = ?,
      chick_age = ?,
      oca = ?,
      std_oca = ?,
      ger_std = ?,
      coop_remaining = ?,
      total_live_kg = ?,
      feed_used = ?,
      fcr = ?,
      randiman = ?,
      ventilation_capacity = ?,
      biosecurity = ?,
      notes = ?,
      created_at = ?
    WHERE id = ?`,
    [
      v.period_id ?? null,
      v.coop_name,
      v.producer_name,
      v.field_officer,
      v.visit_date,
      v.arrival_time,
      v.departure_time,
      v.stay_minutes,
      v.coop_area_m2,
      v.entry_date,
      v.entry_count,
      v.chick_origin,
      v.breeder_and_age,
      v.density_per_m2,
      v.first_week_death_count,
      v.first_week_death_percent,
      v.visit_death_count,
      v.visit_death_percent,
      v.chick_age,
      v.oca,
      v.std_oca,
      v.ger_std,
      v.coop_remaining,
      v.total_live_kg,
      v.feed_used,
      v.fcr,
      v.randiman,
      v.ventilation_capacity,
      v.biosecurity,
      v.notes,
      v.created_at,
      v.id
    ]
  );
};

export const deleteVisit = async (id: string) => {
  const db = await getDb();
  await db.runAsync('DELETE FROM visits WHERE id = ?', [id]);
};

export const insertKesimHistory = async (owner: string, animalCount: number | null) => {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO kesim_history (id, owner, animal_count, created_at)
     VALUES (?,?,?,?)`,
    [
      `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      owner,
      animalCount,
      new Date().toISOString()
    ]
  );
};

export const getKesimHistory = async (limit = 3) => {
  const db = await getDb();
  return db.getAllAsync<KesimHistory>(
    'SELECT * FROM kesim_history ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
};

export const insertMedicationEntry = async (entry: MedicationEntry) => {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO meds (
      id, coop_name, med_code, med_name, unit, quantity, created_at
    ) VALUES (?,?,?,?,?,?,?)`,
    [
      entry.id,
      entry.coop_name,
      entry.med_code,
      entry.med_name,
      entry.unit,
      entry.quantity,
      entry.created_at
    ]
  );
};

export const getDailyMedicationEntries = async (dateIso: string) => {
  const db = await getDb();
  return db.getAllAsync<MedicationEntry>(
    "SELECT * FROM meds WHERE date(created_at, 'localtime') = ? ORDER BY created_at ASC",
    [dateIso]
  );
};

export const updateMedicationEntry = async (id: string, quantity: number) => {
  const db = await getDb();
  await db.runAsync('UPDATE meds SET quantity = ? WHERE id = ?', [quantity, id]);
};

export const deleteMedicationEntry = async (id: string) => {
  const db = await getDb();
  await db.runAsync('DELETE FROM meds WHERE id = ?', [id]);
};

export const insertBreederAge = async (coopName: string, breederAge: string) => {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO breeder_ages (id, coop_name, breeder_age, created_at) VALUES (?,?,?,?)',
    [`${Date.now()}-${Math.random().toString(16).slice(2)}`, coopName.trim(), breederAge.trim(), now]
  );
};

export const getBreederAges = async (limit = 100) => {
  const db = await getDb();
  return db.getAllAsync<BreederAgeEntry>(
    'SELECT * FROM breeder_ages ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
};

export const getLatestBreederAgeByCoop = async (coopName: string) => {
  const db = await getDb();
  const trimmed = coopName.trim();
  if (!trimmed) return null;
  const rows = await db.getAllAsync<BreederAgeEntry>(
    'SELECT * FROM breeder_ages WHERE coop_name = ? COLLATE NOCASE ORDER BY created_at DESC LIMIT 1',
    [trimmed]
  );
  return rows[0] ?? null;
};

export const updateBreederAge = async (id: string, breederAge: string) => {
  const db = await getDb();
  await db.runAsync('UPDATE breeder_ages SET breeder_age = ? WHERE id = ?', [breederAge.trim(), id]);
};

export const deleteBreederAge = async (id: string) => {
  const db = await getDb();
  await db.runAsync('DELETE FROM breeder_ages WHERE id = ?', [id]);
};
























