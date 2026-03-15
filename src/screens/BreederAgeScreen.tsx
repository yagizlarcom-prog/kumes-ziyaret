import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { deleteBreederAge, getBreederAges, insertBreederAge, updateBreederAge } from '../db';
import { BreederAgeEntry } from '../models';
import { formatDateTR, formatTimeTR, isoDateFromDateTime } from '../utils';

type Props = {
  onBack: () => void;
  onSaved: () => void;
};

export default function BreederAgeScreen({ onBack, onSaved }: Props) {
  const [coopName, setCoopName] = useState('');
  const [breederAge, setBreederAge] = useState('');
  const [entries, setEntries] = useState<BreederAgeEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<BreederAgeEntry | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const load = async () => {
    const data = await getBreederAges(200);
    setEntries(data);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const save = async () => {
    if (!coopName.trim()) {
      Alert.alert('Uyarı', 'Kümes adı gerekli.');
      return;
    }
    if (!breederAge.trim()) {
      Alert.alert('Uyarı', 'Damızlık yaşı gerekli.');
      return;
    }
    await insertBreederAge(coopName, breederAge);
    setCoopName('');
    setBreederAge('');
    await load();
    onSaved();
  };

  const startEdit = (entry: BreederAgeEntry) => {
    setEditingEntry(entry);
    setEditingValue(entry.breeder_age);
  };

  const saveEdit = async () => {
    if (!editingEntry) return;
    if (!editingValue.trim()) {
      Alert.alert('Uyarı', 'Damızlık yaşı gerekli.');
      return;
    }
    await updateBreederAge(editingEntry.id, editingValue);
    await load();
    setEditingEntry(null);
    setEditingValue('');
  };

  const removeEdit = async () => {
    if (!editingEntry) return;
    Alert.alert('Sil', 'Bu damızlık yaşı kaydını silmek istiyor musun?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await deleteBreederAge(editingEntry.id);
          await load();
          setEditingEntry(null);
          setEditingValue('');
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
        <Text style={styles.title}>Damızlık Yaşları</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Kümes Adı</Text>
        <TextInput
          style={styles.input}
          placeholder="Örn: GÜLSE"
          value={coopName}
          onChangeText={setCoopName}
        />

        <Text style={styles.label}>Damızlık Yaşı</Text>
        <TextInput
          style={styles.input}
          placeholder="Örn: 32 hafta"
          value={breederAge}
          onChangeText={setBreederAge}
        />

        <Pressable style={[styles.button, styles.primary]} onPress={save}>
          <Text style={styles.buttonText}>Kaydet</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Kayıtlar</Text>
        <FlatList
          data={entries}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>Henüz kayıt yok.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.entryCard} onPress={() => startEdit(item)}>
              <Text style={styles.entryTitle}>{item.coop_name}</Text>
              <Text style={styles.entryAge}>{item.breeder_age}</Text>
              <Text style={styles.entryMeta}>
                {formatDateTR(isoDateFromDateTime(item.created_at))} · {formatTimeTR(item.created_at)}
              </Text>
              <Text style={styles.entryHint}>Düzenlemek için dokun</Text>
            </Pressable>
          )}
        />
      </View>

      {editingEntry ? (
        <View style={styles.editModal}>
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>Düzenle</Text>
            <Text style={styles.editLabel}>{editingEntry.coop_name}</Text>
            <TextInput
              style={styles.editInput}
              value={editingValue}
              onChangeText={setEditingValue}
              placeholder="Damızlık yaşı"
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
  button: { marginTop: 16, padding: 12, borderRadius: 10, alignItems: 'center' },
  primary: { backgroundColor: '#2E7D32' },
  primarySmall: { backgroundColor: '#2E7D32', flex: 1 },
  ghostSmall: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', flex: 1 },
  buttonText: { color: '#fff', fontWeight: '600' },
  ghostText: { color: '#333' },
  sectionTitle: { marginTop: 18, fontWeight: '700', color: '#1B1B1B' },
  list: { paddingVertical: 12, gap: 10 },
  emptyText: { textAlign: 'center', color: '#777', marginTop: 8 },
  entryCard: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#eee', backgroundColor: '#fff' },
  entryTitle: { fontWeight: '700', color: '#2E7D32' },
  entryAge: { marginTop: 4, color: '#333', fontWeight: '600' },
  entryMeta: { color: '#777', marginTop: 6, fontSize: 12 },
  entryHint: { color: '#888', marginTop: 4, fontSize: 12 },
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
