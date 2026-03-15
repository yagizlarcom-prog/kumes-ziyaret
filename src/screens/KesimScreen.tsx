import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { createKesimZip, saveKesimZipToDirectory, shareKesimZip } from '../kesimDocs';
import { getKesimHistory, insertKesimHistory } from '../db';
import { KesimHistory } from '../models';

const pad2 = (n: number) => n.toString().padStart(2, '0');
const formatDateTR = (d: Date) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;

const addDays = (d: Date, days: number) => {
  const next = new Date(d.getTime());
  next.setDate(next.getDate() + days);
  return next;
};

const buildPreviewDates = () => {
  const today = new Date();
  const maxibanBas = addDays(today, -30);
  const maxibanBit = addDays(today, -10);
  const montebanBas = maxibanBit;
  const montebanBit = addDays(montebanBas, 7);
  const varClone = addDays(today, -16);

  return {
    kesim: formatDateTR(today),
    maxibanBas: formatDateTR(maxibanBas),
    maxibanBit: formatDateTR(maxibanBit),
    montebanBas: formatDateTR(montebanBas),
    montebanBit: formatDateTR(montebanBit),
    varClone: formatDateTR(varClone)
  };
};

type HistoryItem = {
  owner: string;
  animalCount: number | null;
};

const getUniqueHistory = (items: KesimHistory[], limit = 3): HistoryItem[] => {
  const out: HistoryItem[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const owner = (item.owner || '').trim();
    const count = item.animal_count ?? null;
    if (!owner) continue;
    const key = `${owner.toLowerCase()}|${count ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ owner, animalCount: count });
    if (out.length >= limit) break;
  }

  return out;
};

type Props = {
  onBack: () => void;
};

export default function KesimScreen({ onBack }: Props) {
  const [owner, setOwner] = useState('');
  const [animalCount, setAnimalCount] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const previewDates = useMemo(buildPreviewDates, []);

  const loadHistory = async () => {
    try {
      const data = await getKesimHistory(20);
      setHistory(getUniqueHistory(data));
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const onPickHistory = (item: HistoryItem) => {
    setOwner(item.owner);
    setAnimalCount(item.animalCount != null ? String(item.animalCount) : '');
  };

  const onGenerate = async () => {
    const trimmedOwner = owner.trim();
    const countNum = Number(animalCount);

    if (!trimmedOwner) {
      Alert.alert('Eksik Alan', 'Kümes sahibi ismi gerekli.');
      return;
    }

    if (!Number.isFinite(countNum) || countNum <= 0) {
      Alert.alert('Eksik Alan', 'Hayvan sayısı geçerli olmalı.');
      return;
    }

    setLoading(true);
    try {
      const { fileUri, fileName } = await createKesimZip(trimmedOwner, countNum);
      await insertKesimHistory(trimmedOwner, countNum);
      await loadHistory();

      try {
        await shareKesimZip(fileUri);
        Alert.alert('Başarılı', 'Belgeler paylaşıma hazır.');
      } catch (err) {
        if (Platform.OS === 'android') {
          const savedUri = await saveKesimZipToDirectory(fileUri, fileName);
          if (savedUri) {
            Alert.alert('Başarılı', 'Belgeler seçtiğiniz klasöre kaydedildi.');
          } else {
            Alert.alert('Bilgi', 'Klasör izni verilmedi, dosya kaydedilmedi.');
          }
        } else {
          const message = err instanceof Error ? err.message : 'Paylaşım yapılamadı.';
          Alert.alert('Hata', message);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Belge oluşturulamadı.';
      Alert.alert('Hata', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>Geri</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Kesim & Nakil Belgeleri</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Bilgiler</Text>
        <View style={styles.sectionCard}>
          <Field
            label="KÜMES SAHİBİ"
            value={owner}
            onChangeText={setOwner}
          />
          {history.length > 0 ? (
            <SuggestionRow items={history} onPick={onPickHistory} />
          ) : null}
          <NumberField
            label="KESİME GİDECEK HAYVAN SAYISI"
            value={animalCount}
            onChangeText={setAnimalCount}
          />
        </View>

        <Text style={styles.sectionTitle}>Otomatik Tarihler</Text>
        <View style={styles.sectionCard}>
          <InfoRow label="Kesim Tarihi" value={previewDates.kesim} />
          <InfoRow label="Maxiban Başlama" value={previewDates.maxibanBas} />
          <InfoRow label="Maxiban Bitiş" value={previewDates.maxibanBit} />
          <InfoRow label="Monteban Başlama" value={previewDates.montebanBas} />
          <InfoRow label="Monteban Bitiş" value={previewDates.montebanBit} />
          <InfoRow label="VAR 2 + CLONE" value={previewDates.varClone} />
        </View>

        <Pressable style={[styles.button, styles.primary]} onPress={onGenerate} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Belgeler Hazırlanıyor...' : 'Belgeleri Oluştur'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field(props: { label: string; value: string; onChangeText: (t: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput style={styles.input} value={props.value} onChangeText={props.onChangeText} />
    </View>
  );
}

function NumberField(props: { label: string; value: string; onChangeText: (t: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType="numeric"
      />
    </View>
  );
}

function InfoRow(props: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{props.label}</Text>
      <Text style={styles.infoValue}>{props.value}</Text>
    </View>
  );
}

function SuggestionRow(props: { items: HistoryItem[]; onPick: (item: HistoryItem) => void }) {
  return (
    <View style={styles.suggestionWrap}>
      <Text style={styles.suggestionLabel}>Son 3:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionChips}>
        {props.items.map(item => (
          <Pressable
            key={`${item.owner}-${item.animalCount ?? ''}`}
            style={styles.suggestionChip}
            onPress={() => props.onPick(item)}
          >
            <Text style={styles.suggestionText} numberOfLines={1} ellipsizeMode="tail">
              {item.owner} {item.animalCount != null ? `· ${item.animalCount}` : ''}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff'
  },
  backText: { color: '#333', fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1B1B1B' },
  headerSpacer: { width: 60 },
  scroll: { padding: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee'
  },
  field: { marginBottom: 12 },
  label: { marginBottom: 6, color: '#333' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoLabel: { color: '#555' },
  infoValue: { color: '#222', fontWeight: '600' },
  button: { marginTop: 16, padding: 14, borderRadius: 12, alignItems: 'center' },
  primary: { backgroundColor: '#2E7D32' },
  buttonText: { color: '#fff', fontWeight: '700' },
  suggestionWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  suggestionLabel: { fontSize: 12, color: '#666', marginRight: 8 },
  suggestionChips: { gap: 8, paddingRight: 6 },
  suggestionChip: {
    backgroundColor: '#E8F5E9',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    maxWidth: 200
  },
  suggestionText: { fontSize: 12, color: '#1B5E20' }
});
