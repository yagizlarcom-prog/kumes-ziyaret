import JSZip from 'jszip';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';

const MIME_ZIP = 'application/zip';
const EK10_TEMPLATE = require('../assets/EK10_SABLON.docx');
const NAKIL_TEMPLATE = require('../assets/NAKIL_SABLON.docx');

const pad2 = (n: number) => n.toString().padStart(2, '0');

const formatDateTR = (d: Date) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
const formatDateFile = (d: Date) => `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;

const addDays = (d: Date, days: number) => {
  const next = new Date(d.getTime());
  next.setDate(next.getDate() + days);
  return next;
};

const calculateDates = (kesimDate: Date) => {
  const maxibanBas = addDays(kesimDate, -30);
  const maxibanBit = addDays(kesimDate, -10);
  const montebanBas = maxibanBit;
  const montebanBit = addDays(montebanBas, 7);
  const varClone = addDays(kesimDate, -16);

  return {
    kesim: formatDateTR(kesimDate),
    maxibanBas: formatDateTR(maxibanBas),
    maxibanBit: formatDateTR(maxibanBit),
    montebanBas: formatDateTR(montebanBas),
    montebanBit: formatDateTR(montebanBit),
    varClone: formatDateTR(varClone),
    today: formatDateTR(kesimDate)
  };
};

const safeFileName = (text: string) =>
  text.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();

const loadTemplateBase64 = async (moduleRef: number) => {
  const asset = Asset.fromModule(moduleRef);
  await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
};

const replacePlaceholders = async (docxBase64: string, replacements: Record<string, string>) => {
  const zip = await JSZip.loadAsync(docxBase64, { base64: true });
  const files = Object.keys(zip.files).filter(name => name.startsWith('word/') && name.endsWith('.xml'));

  for (const name of files) {
    const file = zip.file(name);
    if (!file) continue;
    const text = await file.async('string');
    let updated = text;
    for (const [key, value] of Object.entries(replacements)) {
      updated = updated.split(key).join(value);
    }
    zip.file(name, updated);
  }

  return zip.generateAsync({ type: 'base64' });
};

export const createKesimZip = async (owner: string, animalCount: number) => {
  if (!FileSystem.documentDirectory) {
    throw new Error('Dosya klasörü erişilemedi.');
  }

  const today = new Date();
  const dates = calculateDates(today);

  const replacements: Record<string, string> = {
    '{{KUMES_SAHIBI}}': owner,
    '{{HAYVAN_SAYISI}}': String(animalCount),
    '{{KESIM_TARIHI}}': dates.kesim,
    '{{MAXIBAN_BAS}}': dates.maxibanBas,
    '{{MAXIBAN_BIT}}': dates.maxibanBit,
    '{{MONTEBAN_BAS}}': dates.montebanBas,
    '{{MONTEBAN_BIT}}': dates.montebanBit,
    '{{VAR_CLONE_TARIH}}': dates.varClone,
    '{{TARIH}}': dates.today,
    '{{NAKIL_TARIHI}}': dates.today
  };

  const ek10Base64 = await loadTemplateBase64(EK10_TEMPLATE);
  const nakilBase64 = await loadTemplateBase64(NAKIL_TEMPLATE);

  const ek10Filled = await replacePlaceholders(ek10Base64, replacements);
  const nakilFilled = await replacePlaceholders(nakilBase64, replacements);

  const fileDate = formatDateFile(today);
  const safeOwner = safeFileName(owner || 'Kumes');

  const zip = new JSZip();
  zip.file(`EK10_${safeOwner}_${fileDate}.docx`, ek10Filled, { base64: true });
  zip.file(`NAKIL_${safeOwner}_${fileDate}.docx`, nakilFilled, { base64: true });

  const zipBase64 = await zip.generateAsync({ type: 'base64' });
  const fileName = `Belgeler_${safeOwner}_${fileDate}.zip`;
  const fileUri = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, zipBase64, {
    encoding: FileSystem.EncodingType.Base64
  });

  return { fileUri, fileName };
};

export const shareKesimZip = async (fileUri: string) => {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Bu cihazda paylaşım desteklenmiyor.');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: MIME_ZIP,
    UTI: 'public.zip-archive'
  });
};

export const saveKesimZipToDirectory = async (fileUri: string, fileName: string) => {
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
    MIME_ZIP
  );

  await FileSystem.writeAsStringAsync(safFileUri, base64, {
    encoding: FileSystem.EncodingType.Base64
  });

  return safFileUri;
};
