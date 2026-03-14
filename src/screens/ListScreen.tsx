import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { getVisits } from '../db';
import { Visit } from '../models';
import { createExcelFile, saveExcelFileToDirectory, shareExcelFile } from '../exportExcel';
import { formatDateTR, formatTimeTR, isoDateFromDateTime, toISODate } from '../utils';

type Props = {
  onNew: () => void;
  onEdit: (visit: Visit) => void;
};

type CoopSection = {
  title: string;
  data: Visit[];
};

export default function ListScreen({ onNew, onEdit }: Props) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tab, setTab] = useState<'daily' | 'coops'>('daily');

  const load = async () => {
    setLoading(true);
    const data = await getVisits();
    setVisits(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const todayISO = toISODate(new Date());

  const dailyVisits = useMemo(
    () => visits.filter(v => isoDateFromDateTime(v.created_at) === todayISO),
    [visits, todayISO]
  );

  const coopSections = useMemo<CoopSection[]>(() => {
    const sorted = [...visits].sort((a, b) => {
      const coopCompare = (a.coop_name || '').localeCompare(b.coop_name || '');
      if (coopCompare !== 0) return coopCompare;
      return (a.visit_date || '').localeCompare(b.visit_date || '');
    });

    const map = new Map<string, Visit[]>();
    for (const visit of sorted) {
      const key = visit.coop_name?.trim() || 'Kümes Adı Yok';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(visit);
    }

    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [visits]);

  const exportExcel = async () => {
    if (visits.length === 0) {
      Alert.alert('Uyarı', 'Dışa aktarılacak kayıt yok.');
      return;
    }

    setExporting(true);
    try {
      const { fileUri, fileName } = await createExcelFile(visits);

      try {
        await shareExcelFile(fileUri);
        Alert.alert('Başarılı', 'Paylaşım ekranı açıldı.');
      } catch (err) {
        if (Platform.OS === 'android') {
          const savedUri = await saveExcelFileToDirectory(fileUri, fileName);
          if (savedUri) {
            Alert.alert('Başarılı', 'Dosya seçtiğiniz klasöre kaydedildi.');
          } else {
            Alert.alert('Bilgi', 'Klasör izni verilmedi, dosya kaydedilmedi.');
          }
        } else {
          const message = err instanceof Error ? err.message : 'Paylaşım yapılamadı.';
          Alert.alert('Hata', message);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Excel oluşturulamadı.';
      Alert.alert('Hata', message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kümes Ziyaretleri</Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={[styles.button, styles.primary]} onPress={onNew}>
          <Text style={styles.buttonText}>Yeni Ziyaret</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.secondary]} onPress={exportExcel} disabled={exporting}>
          <Text style={styles.buttonText}>{exporting ? 'Excel Hazırlanıyor...' : "Excel'e Aktar"}</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.ghost]} onPress={load}>
          <Text style={styles.ghostText}>{loading ? 'Yükleniyor...' : 'Yenile'}</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tabButton, tab === 'daily' && styles.tabActive]}
          onPress={() => setTab('daily')}
        >
          <Text style={[styles.tabText, tab === 'daily' && styles.tabTextActive]}>Günlük Ziyaretler</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, tab === 'coops' && styles.tabActive]}
          onPress={() => setTab('coops')}
        >
          <Text style={[styles.tabText, tab === 'coops' && styles.tabTextActive]}>Kümes Kayıtları</Text>
        </Pressable>
      </View>

      {tab === 'daily' ? (
        <FlatList
          data={dailyVisits}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>Bugün kayıt yok.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => onEdit(item)}>
              <Text style={styles.cardTitle}>{item.coop_name || 'Kümes Adı Yok'}</Text>
              <Text style={styles.cardSubtitle}>{item.producer_name}</Text>
              <Text style={styles.cardMeta}>
                Ziyaret: {formatDateTR(item.visit_date)} · Kayıt: {formatTimeTR(item.created_at)}
              </Text>
              <Text style={styles.cardHint}>Düzenlemek için dokun</Text>
            </Pressable>
          )}
        />
      ) : (
        <SectionList
          sections={coopSections}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>Kümes kaydı yok.</Text>}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>Kümes: {section.title}</Text>
          )}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => onEdit(item)}>
              <Text style={styles.cardTitle}>{item.producer_name}</Text>
              <Text style={styles.cardSubtitle}>{formatDateTR(item.visit_date)}</Text>
              <Text style={styles.cardHint}>Düzenlemek için dokun</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  actions: { paddingHorizontal: 16, gap: 10 },
  button: { padding: 12, borderRadius: 10, alignItems: 'center' },
  primary: { backgroundColor: '#2E7D32' },
  secondary: { backgroundColor: '#0277BD' },
  ghost: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' },
  buttonText: { color: '#fff', fontWeight: '600' },
  ghostText: { color: '#333' },
  tabs: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center'
  },
  tabActive: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  tabText: { color: '#333', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  list: { padding: 16, gap: 10 },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#eee' },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSubtitle: { color: '#666', marginTop: 4 },
  cardMeta: { color: '#666', marginTop: 6 },
  cardHint: { color: '#999', marginTop: 6, fontSize: 12 },
  emptyText: { color: '#777', textAlign: 'center', marginTop: 24 },
  sectionHeader: { fontSize: 14, fontWeight: '700', color: '#2E7D32', marginBottom: 8 }
});
