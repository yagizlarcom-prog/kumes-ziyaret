export type Visit = {
  id: string;
  coop_name: string;
  producer_name: string;
  field_officer: string;
  visit_date: string; // YYYY-MM-DD
  arrival_time: string; // HH:mm
  departure_time: string; // HH:mm
  stay_minutes: number | null;
  coop_area_m2: number | null;
  entry_date: string; // YYYY-MM-DD
  entry_count: number | null;
  chick_origin: string;
  breeder_and_age: string;
  density_per_m2: number | null;
  first_week_death_count: number | null;
  first_week_death_percent: number | null;
  visit_death_count: number | null;
  visit_death_percent: number | null;
  chick_age: string;
  oca: number | null;
  std_oca: number | null;
  ger_std: number | null;
  coop_remaining: number | null;
  total_live_kg: number | null;
  feed_used: number | null;
  fcr: number | null;
  randiman: number | null;
  ventilation_capacity: string;
  biosecurity: string;
  notes: string;
  created_at: string;
};
