import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import JSZip from 'jszip';
import { Visit } from './models';

const MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const TEMPLATE_MODULE = require('../assets/template.xlsx');

const DAILY_SHEET_CANDIDATES = ['1', 'GÜNLÜK', 'GUNLUK'];
const COOP_SHEET_CANDIDATES = ['GENEL'];

export type ExcelExportMode = 'daily' | 'coops';

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

const escapeXmlText = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');

const normalizeCellAttrs = (attrs: string, desiredT: string | null) => {
  let out = attrs;
  out = out.replace(/\s+t="[^"]*"/g, '');
  out = out.replace(/\s+t='[^']*'/g, '');
  if (desiredT) out += ` t="${desiredT}"`;
  return out;
};

const updateCellXml = (
  sheetXml: string,
  addr: string,
  innerXml: string,
  desiredT: string | null
) => {
  // Full cell: <c r="B4" s="139"><v>...</v></c>
  const full = new RegExp(`<c([^>]*)r="${addr}"([^>]*)>([\\s\\S]*?)<\\/c>`);
  if (full.test(sheetXml)) {
    return sheetXml.replace(full, (_m, pre, post) => {
      const attrs = normalizeCellAttrs(`${pre}r="${addr}"${post}`, desiredT);
      return `<c${attrs}>${innerXml}</c>`;
    });
  }
  // Self-closing cell: <c r="B4" s="139" />
  const self = new RegExp(`<c([^>]*)r="${addr}"([^>]*)\\/>`);
  if (self.test(sheetXml)) {
    return sheetXml.replace(self, (_m, pre, post) => {
      const attrs = normalizeCellAttrs(`${pre}r="${addr}"${post}`, desiredT);
      return `<c${attrs}>${innerXml}</c>`;
    });
  }
  throw new Error(
    `Şablonda ${addr} hücresi bulunamadı. (Template değişmiş olabilir)`
  );
};

const setCellNumber = (sheetXml: string, addr: string, value: number | null) => {
  if (value == null || Number.isNaN(value)) return sheetXml;
  return updateCellXml(sheetXml, addr, `<v>${value}</v>`, null);
};

const setCellString = (
  sheetXml: string,
  addr: string,
  value: string | null | undefined
) => {
  const text = value ? value.trim() : '';
  if (!text) return sheetXml;
  const escaped = escapeXmlText(text);
  return updateCellXml(
    sheetXml,
    addr,
    `<is><t xml:space="preserve">${escaped}</t></is>`,
    'inlineStr'
  );
};

const findTemplateSheetName = (available: string[], candidates: string[]) => {
  for (const name of candidates) {
    if (available.includes(name)) return name;
  }
  return null;
};

const parseWorkbookSheetInfo = (workbookXml: string) => {
  const sheets: { name: string; rId: string; index: number }[] = [];
  const re = /<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(workbookXml))) {
    sheets.push({ name: m[1], rId: m[2], index: idx });
    idx += 1;
  }
  return sheets;
};

const parseWorkbookRels = (relsXml: string) => {
  const map = new Map<string, string>();
  const re = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(relsXml))) {
    map.set(m[1], m[2]);
  }
  return map;
};

const setActiveTab = (workbookXml: string, activeTabIndex: number) => {
  if (!Number.isFinite(activeTabIndex)) return workbookXml;
  if (workbookXml.includes('activeTab=')) {
    return workbookXml.replace(/activeTab="\d+"/, `activeTab="${activeTabIndex}"`);
  }
  // Fallback: add activeTab to workbookView if missing.
  return workbookXml.replace(
    /<workbookView\b([^>]*)\/>/,
    `<workbookView$1 activeTab="${activeTabIndex}" />`
  );
};

const setSheetTabSelected = (sheetXml: string, selected: boolean) => {
  const has = /<sheetView\b[^>]*tabSelected="1"/.test(sheetXml);
  if (selected) {
    if (has) return sheetXml;
    return sheetXml.replace(/<sheetView\b/, '<sheetView tabSelected="1"');
  }
  if (!has) return sheetXml;
  return sheetXml.replace(/\s+tabSelected="1"/, '');
};

const fillSheetXml = (sheetXml: string, visits: Visit[], mode: ExcelExportMode) => {
  // Template table is fixed:
  // - Header row: 3
  // - Data rows: 4..17 (14 rows)
  const startRow = 4;
  const capacity = 14;
  if (visits.length > capacity) {
    throw new Error(`Şablonda ${capacity} satır var. ${visits.length} kayıt sığmıyor.`);
  }

  const producerText = (v: Visit) => {
    if (mode !== 'coops') return v.producer_name || '';
    const coop = v.coop_name?.trim();
    const prod = v.producer_name?.trim();
    if (coop && prod) return `${coop} - ${prod}`;
    return coop || prod || '';
  };

  let xml = sheetXml;
  visits.forEach((v, i) => {
    const row = startRow + i;

    // Inputs (computed columns in the template are left as formulas)
    xml = setCellString(xml, `B${row}`, producerText(v));
    xml = setCellString(xml, `C${row}`, v.field_officer);
    xml = setCellNumber(xml, `D${row}`, toExcelDate(v.visit_date));
    xml = setCellNumber(xml, `E${row}`, toExcelTime(v.arrival_time));
    xml = setCellNumber(xml, `F${row}`, toExcelTime(v.departure_time));
    // G = kalış süresi (formula) -> skip
    xml = setCellNumber(xml, `H${row}`, numberOrNull(v.coop_area_m2));
    xml = setCellNumber(xml, `I${row}`, toExcelDate(v.entry_date));
    xml = setCellNumber(xml, `J${row}`, numberOrNull(v.entry_count));
    xml = setCellString(xml, `K${row}`, v.chick_origin);
    xml = setCellString(xml, `L${row}`, v.breeder_and_age);
    // M = adet/m2 (formula) -> skip
    xml = setCellNumber(xml, `N${row}`, numberOrNull(v.first_week_death_count));
    // O = ( % ) (formula) -> skip
    xml = setCellNumber(xml, `P${row}`, numberOrNull(v.visit_death_count));
    // Q = ölüm % (formula) -> skip
    xml = setCellString(xml, `R${row}`, v.chick_age);
    xml = setCellNumber(xml, `S${row}`, numberOrNull(v.oca));
    xml = setCellNumber(xml, `T${row}`, numberOrNull(v.std_oca));
    // U = GER/STD (formula) -> skip
    // V/W/Y/Z etc are computed in template -> skip
    xml = setCellNumber(xml, `X${row}`, numberOrNull(v.feed_used));
    xml = setCellString(xml, `AA${row}`, v.ventilation_capacity);
    xml = setCellString(xml, `AB${row}`, v.biosecurity);
    xml = setCellString(xml, `AC${row}`, v.notes);
  });

  return xml;
};

const loadTemplateBase64 = async () => {
  const asset = Asset.fromModule(TEMPLATE_MODULE);
  await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64
  });
};

export const createExcelFile = async (visits: Visit[], mode: ExcelExportMode) => {
  if (!FileSystem.documentDirectory) {
    throw new Error('Dosya klasörü erişilemedi.');
  }

  const templateBase64 = await loadTemplateBase64();

  // IMPORTANT:
  // The "xlsx" library cannot preserve template styling when writing.
  // We therefore patch the template XLSX (zip) and only update cell values in the sheet XML.
  // This keeps all formatting / borders / colors / column widths untouched.
  const zip = await JSZip.loadAsync(templateBase64, { base64: true });

  const workbookXml = await zip.file('xl/workbook.xml')?.async('string');
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  if (!workbookXml || !relsXml) {
    throw new Error('Şablon bozuk: workbook.xml bulunamadı.');
  }

  const sheets = parseWorkbookSheetInfo(workbookXml);
  const relMap = parseWorkbookRels(relsXml);
  const availableSheetNames = sheets.map(s => s.name);

  const dailySheetName =
    findTemplateSheetName(availableSheetNames, DAILY_SHEET_CANDIDATES) ||
    availableSheetNames[0];
  const coopSheetName =
    findTemplateSheetName(availableSheetNames, COOP_SHEET_CANDIDATES) ||
    availableSheetNames[0];

  const targetSheetName = mode === 'daily' ? dailySheetName : coopSheetName;
  const otherSheetName = mode === 'daily' ? coopSheetName : dailySheetName;

  const targetSheet = sheets.find(s => s.name === targetSheetName);
  const otherSheet = sheets.find(s => s.name === otherSheetName);
  if (!targetSheet) {
    throw new Error(`Şablonda sheet bulunamadı: ${targetSheetName}`);
  }

  const targetRel = relMap.get(targetSheet.rId);
  if (!targetRel) {
    throw new Error(`Şablonda sheet ilişkisi bulunamadı: ${targetSheetName}`);
  }
  const targetPath = `xl/${targetRel}`;

  const targetSheetXml = await zip.file(targetPath)?.async('string');
  if (!targetSheetXml) {
    throw new Error(`Şablonda sheet xml bulunamadı: ${targetPath}`);
  }

  const sortedVisits = [...visits].sort((a, b) =>
    (a.created_at || '').localeCompare(b.created_at || '')
  );
  let newTargetXml = fillSheetXml(targetSheetXml, sortedVisits, mode);
  newTargetXml = setSheetTabSelected(newTargetXml, true);
  zip.file(targetPath, newTargetXml);

  if (otherSheet) {
    const otherRel = relMap.get(otherSheet.rId);
    if (otherRel) {
      const otherPath = `xl/${otherRel}`;
      const otherXml = await zip.file(otherPath)?.async('string');
      if (otherXml) {
        zip.file(otherPath, setSheetTabSelected(otherXml, false));
      }
    }
  }

  // Make sure Excel opens the relevant sheet.
  zip.file('xl/workbook.xml', setActiveTab(workbookXml, targetSheet.index));

  const wbout = await zip.generateAsync({ type: 'base64' });
  const fileName = `kumes_ziyaretleri_${mode}_${Date.now()}.xlsx`;
  const fileUri = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, wbout as any, {
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

