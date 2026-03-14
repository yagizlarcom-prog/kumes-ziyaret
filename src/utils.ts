export const pad2 = (n: number) => n.toString().padStart(2, '0');

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const formatDateTR = (iso?: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Intl.DateTimeFormat('tr-TR').format(new Date(y, m - 1, d));
};

export const isoDateFromDateTime = (iso?: string) => {
  if (!iso) return '';
  return toISODate(new Date(iso));
};

export const formatTimeTR = (iso?: string) => {
  if (!iso) return '';
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(iso));
};

export const dateToTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export const timeToDate = (time?: string) => {
  const now = new Date();
  if (!time) return now;
  const [h, m] = time.split(':').map(Number);
  if (Number.isFinite(h)) now.setHours(h);
  if (Number.isFinite(m)) now.setMinutes(m);
  now.setSeconds(0);
  now.setMilliseconds(0);
  return now;
};

export const calcStayMinutes = (start?: string, end?: string) => {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return null;
  let minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  return minutes;
};

export const formatMinutes = (mins?: number | null) => {
  if (mins == null) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${pad2(h)}:${pad2(m)}`;
};

export const toNumber = (value: string) => {
  if (value == null) return null;
  const cleaned = value.replace(',', '.').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

export const toFixedOrNull = (n: number | null, digits = 2) =>
  n == null ? null : Number(n.toFixed(digits));
