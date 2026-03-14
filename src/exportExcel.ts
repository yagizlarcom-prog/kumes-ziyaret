import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import { Visit } from './models';
import { formatDateTR, isoDateFromDateTime, toISODate } from './utils';

const MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const TEMPLATE_MODULE = require('../assets/template.xlsx');

const DAILY_SHEET_CANDIDATES = ['1', 'GÜNLÜK', 'GUNLUK'];
const COOP_SHEET_CANDIDATES = ['GENEL'];

const OUTPUT_DAILY_SHEET = 'Günlük Ziyaretler';
const OUTPUT_COOP_SHEET = 'Kümes Kayýtlarý';

const numberOrEmpty = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? '' : n;

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

const setCellIfEmpty = (ws: any, r: number, c: number, value: string | number) => {
  const addr = XLSX.utils.encode_cell({ r, c });
  const existing = ws[addr];
  if (existing?.f) return;
  if (existing?.v != null && existing.v !== '') return;
  ws[addr] = {
    ...(existing || {}),
    v: value,
    t: typeof value === 'number' ? 'n' : 's'
  };
};

const fillSheet = (ws: any, visits: Visit[], options: { producerName: (v: Visit) => string }) => {
  const headerRow = findRowByText(ws, 'ÜRETÝCÝ ÝSMÝ');
  if (headerRow == null) return;

  const nextSectionRow = findRowByText(ws, 'HESAP GÖRECEK ÜRETÝCÝLER :');
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const startRow = headerRow + 1;
  const endRow = (nextSectionRow != null ? nextSectionRow - 1 : range.e.r);

  const capacity = endRow - startRow + 1;
  if (visits.length > capacity) {
    throw new Error(`Þablonda ${capacity} satýr var. ${visits.length} kayýt sýðmýyor.`);
  }

  visits.forEach((v, idx) => {
    const r = startRow + idx;

    setCellIfEmpty(ws, r, 1, options.producerName(v));
    setCellIfEmpty(ws, r, 2, v.field_officer || '');
    setCellIfEmpty(ws, r, 3, formatDateTR(v.visit_date));
    setCellIfEmpty(ws, r, 4, v.arrival_time || '');
    setCellIfEmpty(ws, r, 5, v.departure_time || '');
    setCellIfEmpty(ws, r, 7, numberOrEmpty(v.coop_area_m2));
    setCellIfEmpty(ws, r, 8, formatDateTR(v.entry_date));
    setCellIfEmpty(ws, r, 9, numberOrEmpty(v.entry_count));
    setCellIfEmpty(ws, r, 10, v.chick_origin || '');
    setCellIfEmpty(ws, r, 11, v.breeder_and_age || '');
    setCellIfEmpty(ws, r, 13, numberOrEmpty(v.first_week_death_count));
    setCellIfEmpty(ws, r, 15, numberOrEmpty(v.visit_death_count));
    setCellIfEmpty(ws, r, 18, numberOrEmpty(v.oca));
    setCellIfEmpty(ws, r, 19, numberOrEmpty(v.std_oca));
    setCellIfEmpty(ws, r, 23, numberOrEmpty(v.feed_used));
    setCellIfEmpty(ws, r, 26, v.ventilation_capacity || '');
    setCellIfEmpty(ws, r, 27, v.biosecurity || '');
    setCellIfEmpty(ws, r, 28, v.notes || '');
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
    throw new Error('Dosya klasörü eriþilemedi.');
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
    throw new Error('Bu cihazda paylaþým desteklenmiyor.');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: MIME_TYPE,
    UTI: 'com.microsoft.excel.xlsx'
  });
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
