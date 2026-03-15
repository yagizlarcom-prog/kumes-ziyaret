import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { Visit } from './models';
import { isoDateFromDateTime, toISODate } from './utils';

const MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const TEMPLATE_MODULE = require('../assets/template.xlsx');

const DAILY_SHEET_CANDIDATES = ['1', 'GÜNLÜK', 'GUNLUK'];
const COOP_SHEET_CANDIDATES = ['GENEL'];

const OUTPUT_DAILY_SHEET = 'Günlük Ziyaretler';
const OUTPUT_COOP_SHEET = 'Kümes Kayıtları';

const numberOrNull = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? null : n;

const toExcelDate = (iso?: string) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  const utc = Date.UTC(y, m - 1, d);
  return utc / 86400000 + 25569;
};

const toExcelTime = (time?: string) => {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return (h * 60 + m) / (24 * 60);
};

const minutesToExcelTime = (mins?: number | null) =>
  mins == null ? null : mins / (24 * 60);

const findSheetName = (wb: any, candidates: string[]) => {
  for (const name of candidates) {
    if (wb.SheetNames.includes(name)) return name;
  }
  return null;
};

const renameSheet = (wb: any, oldName: string, newName: string) => {
  if (oldName === newName) return;
  const idx = wb.SheetNames.indexOf(oldName);
  if (idx === -1) return;
  wb.SheetNames[idx] = newName;
  wb.Sheets[newName] = wb.Sheets[oldName];
  delete wb.Sheets[oldName];
};

const findRowByText = (ws: any, text: string) => {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const target = text.trim().toUpperCase();
  for (let r = 0; r <= range.e.r; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
    if (!cell || cell.v == null) continue;
    if (String(cell.v).trim().toUpperCase() === target) return r;
  }
  return null;
};

const setCellValue = (
  ws: any,
  r: number,
  c: number,
  value: string | number | null | undefined,
  options?: { keepFormula?: boolean }
) => {
  if (value == null || value === '') return;
  const addr = XLSX.utils.encode_cell({ r, c });
  const existing = ws[addr];
  if (existing?.f && !options?.keepFormula) return;
  ws[addr] = {
    ...(existing || {}),
    v: value,
    t: typeof value === 'number' ? 'n' : 's'
  };
};

const fillSheet = (ws: any, visits: Visit[], options: { producerName: (v: Visit) => string }) => {
  const headerRow = findRowByText(ws, 'ÜRETİCİ İSMİ');
  if (headerRow == null) return;

  const nextSectionRow = findRowByText(ws, 'HESAP GÖRECEK ÜRETİCİLER :');
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const startRow = headerRow + 1;
  const endRow = (nextSectionRow != null ? nextSectionRow - 1 : range.e.r);

  const capacity = endRow - startRow + 1;
  if (visits.length > capacity) {
    throw new Error(`Şablonda ${capacity} satır var. ${visits.length} kayıt sığmıyor.`);
  }

  visits.forEach((v, idx) => {
    const r = startRow + idx;

    setCellValue(ws, r, 1, options.producerName(v));
    setCellValue(ws, r, 2, v.field_officer || '');
    setCellValue(ws, r, 3, toExcelDate(v.visit_date));
    setCellValue(ws, r, 4, toExcelTime(v.arrival_time));
    setCellValue(ws, r, 5, toExcelTime(v.departure_time));
    setCellValue(ws, r, 6, minutesToExcelTime(v.stay_minutes), { keepFormula: true });
    setCellValue(ws, r, 7, numberOrNull(v.coop_area_m2));
    setCellValue(ws, r, 8, toExcelDate(v.entry_date));
    setCellValue(ws, r, 9, numberOrNull(v.entry_count));
    setCellValue(ws, r, 10, v.chick_origin || '');
    setCellValue(ws, r, 11, v.breeder_and_age || '');
    setCellValue(ws, r, 12, numberOrNull(v.density_per_m2), { keepFormula: true });
    setCellValue(ws, r, 13, numberOrNull(v.first_week_death_count));
    setCellValue(ws, r, 14, numberOrNull(v.first_week_death_percent), { keepFormula: true });
    setCellValue(ws, r, 15, numberOrNull(v.visit_death_count));
    setCellValue(ws, r, 16, numberOrNull(v.visit_death_percent), { keepFormula: true });
    setCellValue(ws, r, 17, v.chick_age || '');
    setCellValue(ws, r, 18, numberOrNull(v.oca));
    setCellValue(ws, r, 19, numberOrNull(v.std_oca));
    setCellValue(ws, r, 20, numberOrNull(v.ger_std), { keepFormula: true });
    setCellValue(ws, r, 21, numberOrNull(v.coop_remaining), { keepFormula: true });
    setCellValue(ws, r, 22, numberOrNull(v.total_live_kg), { keepFormula: true });
    setCellValue(ws, r, 23, numberOrNull(v.feed_used));
    setCellValue(ws, r, 24, numberOrNull(v.fcr), { keepFormula: true });
    setCellValue(ws, r, 25, numberOrNull(v.randiman), { keepFormula: true });
    setCellValue(ws, r, 26, v.ventilation_capacity || '');
    setCellValue(ws, r, 27, v.biosecurity || '');
    setCellValue(ws, r, 28, v.notes || '');
  });
};

const loadTemplateBase64 = async () => {
  const asset = Asset.fromModule(TEMPLATE_MODULE);
  await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
};

export const createExcelFile = async (visits: Visit[]) => {
  if (!FileSystem.documentDirectory) {
    throw new Error('Dosya klasörü erişilemedi.');
  }

  const templateBase64 = await loadTemplateBase64();
  const wb = XLSX.read(templateBase64, { type: 'base64', cellStyles: true });

  const dailySheetName = findSheetName(wb, DAILY_SHEET_CANDIDATES) || wb.SheetNames[0];
  const coopSheetName = findSheetName(wb, COOP_SHEET_CANDIDATES) || wb.SheetNames[1] || wb.SheetNames[0];

  const todayISO = toISODate(new Date());
  const dailyVisits = visits.filter(v => isoDateFromDateTime(v.created_at) === todayISO);

  const coopVisits = [...visits].sort((a, b) => {
    const coopCompare = (a.coop_name || '').localeCompare(b.coop_name || '');
    if (coopCompare !== 0) return coopCompare;
    return (a.visit_date || '').localeCompare(b.visit_date || '');
  });

  fillSheet(wb.Sheets[dailySheetName], dailyVisits, {
    producerName: v => v.producer_name || ''
  });

  fillSheet(wb.Sheets[coopSheetName], coopVisits, {
    producerName: v => {
      const coop = v.coop_name?.trim();
      const prod = v.producer_name?.trim();
      if (coop && prod) return `${coop} - ${prod}`;
      return coop || prod || '';
    }
  });

  renameSheet(wb, dailySheetName, OUTPUT_DAILY_SHEET);
  renameSheet(wb, coopSheetName, OUTPUT_COOP_SHEET);

  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx', cellStyles: true });
  const fileName = `kumes_ziyaretleri_${Date.now()}.xlsx`;
  const fileUri = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, wbout, {
    encoding: FileSystem.EncodingType.Base64
  });

  return { fileUri, fileName };
};

export const shareExcelFile = async (fileUri: string) => {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Bu cihazda paylaşım desteklenmiyor.');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: MIME_TYPE,
    UTI: 'com.microsoft.excel.xlsx'
  });
};

export const openExcelFile = async (fileUri: string) => {
  if (Platform.OS === 'android') {
    const contentUri = await FileSystem.getContentUriAsync(fileUri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1,
      type: MIME_TYPE
    });
    return;
  }
  await shareExcelFile(fileUri);
};

export const saveExcelFileToDirectory = async (fileUri: string, fileName: string) => {
  const perms = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perms.granted) {
    return null;
  }

  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64
  });

  const safFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
    perms.directoryUri,
    fileName,
    MIME_TYPE
  );

  await FileSystem.writeAsStringAsync(safFileUri, base64, {
    encoding: FileSystem.EncodingType.Base64
  });

  return safFileUri;
};


