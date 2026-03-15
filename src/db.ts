import * as SQLite from 'expo-sqlite';
import { KesimHistory, Visit } from './models';

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY NOT NULL,
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

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const getDb = async () => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('visits.db');
  }
  return dbPromise;
};

export const initDb = async () => {
  const db = await getDb();
  await db.execAsync(CREATE_SQL);
  await db.execAsync(CREATE_KESIM_HISTORY_SQL);

  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(visits)');
  const hasCoopName = columns.some(c => c.name === 'coop_name');
  if (!hasCoopName) {
    await db.execAsync('ALTER TABLE visits ADD COLUMN coop_name TEXT');
  }
};

export const insertVisit = async (v: Visit) => {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO visits (
      id, coop_name, producer_name, field_officer, visit_date, arrival_time, departure_time,
      stay_minutes, coop_area_m2, entry_date, entry_count, chick_origin, breeder_and_age,
      density_per_m2, first_week_death_count, first_week_death_percent,
      visit_death_count, visit_death_percent, chick_age, oca, std_oca, ger_std,
      coop_remaining, total_live_kg, feed_used, fcr, randiman,
      ventilation_capacity, biosecurity, notes, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      v.id, v.coop_name, v.producer_name, v.field_officer, v.visit_date, v.arrival_time, v.departure_time,
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

export const updateVisit = async (v: Visit) => {
  const db = await getDb();
  await db.runAsync(
    `UPDATE visits SET
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
