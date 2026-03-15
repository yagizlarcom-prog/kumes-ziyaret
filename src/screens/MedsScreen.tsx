import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import {
  deleteMedicationEntry,
  getDailyMedicationEntries,
  insertMedicationEntry,
  updateMedicationEntry
} from '../db';
import { MedicationEntry } from '../models';
import { toNumber, toISODate } from '../utils';

type Props = {
  onBack: () => void;
  onSaved: () => void;
  initialCoopName?: string;
};

type MedItem = {
  code: string;
  name: string;
  unit: string;
};

const MEDS: MedItem[] = [
  { code: '600101-00643', name: 'LAVICOL %48 2,5 KG', unit: 'AD' },
  { code: '600101-00422', name: 'DELAMOX %80 1KG', unit: 'AD' },
  { code: '600101-00375', name: 'POULFENICOL %30 OR.SUS. 3 LT', unit: 'AD' },
  { code: '600101-00411', name: 'FLORMIS %30 2,5 LT', unit: 'AD' },
  { code: '600101-00583', name: 'SMARTCID PLUS 10 LT', unit: 'AD' },
  { code: '600101-00514', name: 'MOKSISEM 1KG %80', unit: 'AD' },
  { code: '600101-00014', name: 'MEDIQUINOL %20 ORAL ÇÖZELTİ (2,5 LT.)', unit: 'AD' },
  { code: '600101-00561', name: 'LINKOMIS 40 1,5 KG', unit: 'AD' },
  { code: '600101-00670', name: 'MEDIQUINOL %10 2,5 LT', unit: 'AD' },
  { code: '600101-00145', name: 'AFLORIN R L (5 LT.)', unit: 'AD' },
  { code: '600101-00638', name: 'AGCALMİK PREMİKS 1 LT', unit: 'AD' },
  { code: '600101-00393', name: 'LAVICOL 1 KG %48', unit: 'AD' },
  { code: '600101-00669', name: 'MENTOFORTE LİQUİDE', unit: 'AD' },
  { code: '600101-00647', name: 'MEDICOL 2,5 LT', unit: 'AD' },
  { code: '600101-00582', name: 'SMART MENT LIFE PLUS 5 LT', unit: 'AD' },
  { code: '600101-00590', name: 'CARDIOSOUL 5 LT', unit: 'AD' },
  { code: '600101-00243', name: 'MEDIFLOR %30 (2,5 LT.)', unit: 'AD' },
  { code: '600101-00554', name: 'CHEMIMIX 5 LT', unit: 'AD' },
  { code: '600101-00587', name: 'AGREGO PREMİKS 5 LT', unit: 'AD' },
  { code: '600101-00547', name: 'CINNAMUNE 5 LT', unit: 'AD' },
  { code: '600101-00593', name: 'UNIPOWER LIKIT 5 LT', unit: 'AD' },
  { code: '600101-00478', name: 'HYDRODOXX 500 1 KG', unit: 'AD' },
  { code: '600101-00345', name: 'DOKSIMIS %50 1KG', unit: 'AD' },
  { code: '600101-00553', name: 'TANACİD 5 LT', unit: 'AD' },
  { code: '600101-00446', name: 'GRIPPOZON 1 LT', unit: 'AD' },
  { code: '600101-00346', name: 'ENROMIS %20 3 LT', unit: 'AD' },
  { code: '600101-00252', name: 'MEDICALIN ORAL ÇÖZELTİ (1,5 KG.)', unit: 'AD' },
  { code: '600101-00671', name: 'MEDOX %50 1 KG', unit: 'AD' },
  { code: '600101-00585', name: 'ZOVIROX 1KG', unit: 'AD' },
  { code: '600101-00251', name: 'PHARMACIN ORAL %100 (1 KG.)', unit: 'AD' },
  { code: '600101-00258', name: 'SMART PROLIVE 50 GR.', unit: 'AD' },
  { code: '600101-00644', name: 'RESPICURE', unit: 'AD' },
  { code: '600201-00092', name: 'SALMONELLA PREBİYOTİK LT', unit: 'ML' }
];

export default function MedsScreen({ onBack, onSaved, initialCoopName }: Props) {
  const [coopName, setCoopName] = useState(initialCoopName ?? '');
  const [search, setSearch] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [dailyEntries, setDailyEntries] = useState<MedicationEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<MedicationEntry | null>(null);
  const [editingQty, setEditingQty] = useState('');

  useEffect(() => {
    if (initialCoopName) setCoopName(initialCoopName);
  }, [initialCoopName]);

  const loadDaily = async () => {
    const today = toISODate(new Date());
    const data = await getDailyMedicationEntries(today);
    setDailyEntries(data);
  };

  useEffect(() => {
    loadDaily().catch(() => undefined);
  }, []);

  const filteredMeds = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return MEDS;
    return MEDS.filter(m => `${m.code} ${m.name}`.toLowerCase().includes(term));
  }, [search]);

  const setQty = (code: string, value: string) =>
    setQuantities(prev => ({ ...prev, [code]: value }));

  const save = async () => {
    if (!coopName.trim()) {
      Alert.alert('Uyarı', 'Kümes adı gerekli.');
      return;
    }

    const entries = MEDS.map(med => ({
      med,
      qty: toNumber(quantities[med.code])
    })).filter(item => item.qty && item.qty > 0);

    if (entries.length === 0) {
      Alert.alert('Uyarı', 'En az 1 ilaç için miktar girmelisin.');
      return;
    }

    for (const entry of entries) {
      const med = entry.med;
      const qty = entry.qty || 0;
      const payload: MedicationEntry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        coop_name: coopName.trim(),
        med_code: med.code,
        med_name: med.name,
        unit: med.unit,
        quantity: qty,
        created_at: new Date().toISOString()
      };
      await insertMedicationEntry(payload);
    }

    setQuantities({});
    await loadDaily();
    Alert.alert('Kaydedildi', 'İlaç kayıtları eklendi.');
    onSaved();
  };

  const startEdit = (entry: MedicationEntry) => {
    setEditingEntry(entry);
    setEditingQty(entry.quantity == null ? '' : String(entry.quantity));
  };

  const saveEdit = async () => {
    if (!editingEntry) return;
    const qty = toNumber(editingQty);
    if (!qty || qty <= 0) {
      Alert.alert('Uyarı', 'Miktar gerekli.');
      return;
    }
    await updateMedicationEntry(editingEntry.id, qty);
    await loadDaily();
    setEditingEntry(null);
    setEditingQty('');
  };

  const removeEdit = async () => {
    if (!editingEntry) return;
    Alert.alert('Sil', 'Bu ilaç kaydını silmek istiyor musun?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await deleteMedicationEntry(editingEntry.id);
          await loadDaily();
          setEditingEntry(null);
          setEditingQty('');
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.backText}>Geri</Text>
        </Pressable>
        <Text style={styles.title}>Günlük İlaç Ver</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Kümes Adı</Text>
        <TextInput
          style={styles.input}
          placeholder="Örn: GÜLSE"
          value={coopName}
          onChangeText={setCoopName}
        />

        <Text style={styles.label}>İlaçlar</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Ara (kod / isim)"
          value={search}
          onChangeText={setSearch}
        />

        <FlatList
          data={filteredMeds}
          keyExtractor={item => item.code}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.medRow}>
              <View style={styles.medInfo}>
                <Text style={styles.medName}>{item.name}</Text>
                <Text style={styles.medMeta}>{item.code} · {item.unit}</Text>
              </View>
              <View style={styles.qtyWrap}>
                <TextInput
                  style={styles.qtyInput}
                  placeholder="0"
                  value={quantities[item.code] || ''}
                  onChangeText={value => setQty(item.code, value)}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.qtyUnit}>{item.unit === 'AD' ? 'ADET' : item.unit}</Text>
              </View>
            </View>
          )}
        />

        <Pressable style={[styles.button, styles.primary]} onPress={save}>
          <Text style={styles.buttonText}>Kaydet</Text>
        </Pressable>

        {dailyEntries.length > 0 ? (
          <View style={styles.dailySection}>
            <Text style={styles.dailyTitle}>Bugün Eklenenler</Text>
            {dailyEntries.map(item => (
              <Pressable key={item.id} style={styles.dailyItem} onPress={() => startEdit(item)}>
                <Text style={styles.dailyName}>{item.coop_name}</Text>
                <Text style={styles.dailyMeta}>
                  {item.med_name} · {item.quantity} {item.unit === 'AD' ? 'ADET' : item.unit}
                </Text>
                <Text style={styles.dailyHint}>Düzenlemek için dokun</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {editingEntry ? (
        <View style={styles.editModal}>
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>İlaç Düzenle</Text>
            <Text style={styles.editLabel}>{editingEntry.med_name}</Text>
            <TextInput
              style={styles.editInput}
              value={editingQty}
              onChangeText={setEditingQty}
              keyboardType="decimal-pad"
              placeholder="Miktar"
            />
            <View style={styles.editRow}>
              <Pressable style={[styles.button, styles.ghostSmall]} onPress={() => setEditingEntry(null)}>
                <Text style={styles.ghostText}>Vazgeç</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.primarySmall]} onPress={saveEdit}>
                <Text style={styles.buttonText}>Kaydet</Text>
              </Pressable>
            </View>
            <Pressable style={styles.deleteMini} onPress={removeEdit}>
              <Text style={styles.deleteMiniText}>Sil</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  backText: { color: '#0277BD', fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: '#1B1B1B' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#eee', flex: 1 },
  label: { fontWeight: '600', marginTop: 8, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff'
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12
  },
  list: { gap: 10, paddingBottom: 12 },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    padding: 10
  },
  medInfo: { flex: 1, paddingRight: 10 },
  medName: { fontWeight: '600', color: '#1B1B1B' },
  medMeta: { color: '#777', marginTop: 4, fontSize: 12 },
  qtyWrap: { alignItems: 'flex-end', gap: 4 },
  qtyInput: {
    width: 70,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: 'center',
    backgroundColor: '#fff'
  },
  qtyUnit: { fontSize: 11, color: '#555', fontWeight: '600' },
  button: { marginTop: 16, padding: 12, borderRadius: 10, alignItems: 'center' },
  primary: { backgroundColor: '#2E7D32' },
  primarySmall: { backgroundColor: '#2E7D32', flex: 1 },
  ghostSmall: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', flex: 1 },
  buttonText: { color: '#fff', fontWeight: '600' },
  ghostText: { color: '#333' },
  dailySection: { marginTop: 20, gap: 8 },
  dailyTitle: { fontWeight: '700', color: '#1B1B1B' },
  dailyItem: { padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#eee', backgroundColor: '#fff' },
  dailyName: { fontWeight: '700', color: '#2E7D32' },
  dailyMeta: { color: '#444', marginTop: 4 },
  dailyHint: { color: '#888', marginTop: 4, fontSize: 12 },
  editModal: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  editCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '100%'
  },
  editTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  editLabel: { color: '#555', marginBottom: 8 },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12
  },
  editRow: { flexDirection: 'row', gap: 10 },
  deleteMini: { marginTop: 10, alignItems: 'center' },
  deleteMiniText: { color: '#B71C1C', fontWeight: '700' }
});
