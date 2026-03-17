import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { deleteVisit, getDailyMedicationEntries, getLatestCoopPeriod, getVisits } from '../db';
import { MedicationEntry, Visit } from '../models';
import { createExcelFile, openExcelFile, saveExcelFileToDirectory, shareExcelFile } from '../exportExcel';
import { formatDateTR, formatTimeTR, isoDateFromDateTime, toISODate } from '../utils';

type Props = {
  onNewForm: () => void;
  onNewMeds: (coopName?: string) => void;
  onEdit: (visit: Visit) => void;
  onOpenKesim: () => void;
  onOpenBreeder: () => void;
  refreshKey: number;
};

type CoopSection = {
  title: string;
  data: Visit[];
};

export default function ListScreen({ onNewForm, onNewMeds, onEdit, onOpenKesim, onOpenBreeder, refreshKey }: Props) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [dailyMeds, setDailyMeds] = useState<MedicationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [tab, setTab] = useState<'daily' | 'coops'>('daily');
  const [selectedCoop, setSelectedCoop] = useState<string>('');
  const [selectedCoopPeriodId, setSelectedCoopPeriodId] = useState<string | null>(null);
  const [coopPickerOpen, setCoopPickerOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const today = toISODate(new Date());
    const [data, meds] = await Promise.all([
      getVisits(),
      getDailyMedicationEntries(today)
    ]);
    setVisits(data);
    setDailyMeds(meds);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  const todayISO = toISODate(new Date());
  const ninetyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d;
  }, []);
  const isWithin90Days = (iso?: string) => {
    if (!iso) return false;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return false;
    return date >= ninetyDaysAgo;
  };

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

  const coopNames = useMemo(
    () => coopSections.map(section => section.title),
    [coopSections]
  );

  useEffect(() => {
    if (tab === 'coops' && !selectedCoop && coopNames.length > 0) {
      setSelectedCoop(coopNames[0]);
    }
  }, [tab, selectedCoop, coopNames]);

  useEffect(() => {
    let active = true;
    if (tab !== 'coops' || !selectedCoop) {
      setSelectedCoopPeriodId(null);
      return;
    }
    getLatestCoopPeriod(selectedCoop)
      .then(period => {
        if (!active) return;
        setSelectedCoopPeriodId(period?.id ?? null);
      })
      .catch(() => {
        if (active) setSelectedCoopPeriodId(null);
      });

    return () => {
      active = false;
    };
  }, [tab, selectedCoop, visits]);

  const filteredCoopVisits = useMemo(() => {
    if (!selectedCoop) return [] as Visit[];
    return visits.filter(v => {
      const coopKey = (v.coop_name || 'Kümes Adı Yok').trim();
      if (coopKey !== selectedCoop) return false;
      if (selectedCoopPeriodId && v.period_id !== selectedCoopPeriodId) return false;
      return isWithin90Days(v.created_at);
    });
  }, [visits, selectedCoop, selectedCoopPeriodId, ninetyDaysAgo]);

  const coopSectionData = useMemo(() => {
    if (!selectedCoop) return [] as CoopSection[];
    return [{ title: selectedCoop, data: filteredCoopVisits }];
  }, [selectedCoop, filteredCoopVisits]);

  const getFilteredVisits = () => {
    if (tab === 'daily') return dailyVisits;
    return filteredCoopVisits;
  };

  const exportExcel = async () => {
    const data = getFilteredVisits();
    if (data.length === 0) {
      Alert.alert('Uyarı', tab === 'daily' ? 'Bugün kayıt yok.' : 'Bu kümes için kayıt yok.');
      return;
    }

    setExporting(true);
    try {
      const { fileUri, fileName } = await createExcelFile(data, tab);

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

  const viewExcel = async () => {
    const data = getFilteredVisits();
    if (data.length === 0) {
      Alert.alert('Uyarı', tab === 'daily' ? 'Bugün kayıt yok.' : 'Bu kümes için kayıt yok.');
      return;
    }

    setViewing(true);
    try {
      const { fileUri } = await createExcelFile(data, tab);
      await openExcelFile(fileUri);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Excel görüntülenemedi.';
      Alert.alert('Hata', message);
    } finally {
      setViewing(false);
    }
  };

  const confirmDelete = (visit: Visit) => {
    Alert.alert('Kaydı Sil', 'Bu ziyareti silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await deleteVisit(visit.id);
          load();
        }
      }
    ]);
  };

  const handleVisitPress = (visit: Visit) => {
    Alert.alert('Ziyaret', 'Ne yapmak istersiniz?', [
      { text: 'Formu Düzenle', onPress: () => onEdit(visit) },
      { text: 'İlaç Ekle', onPress: () => onNewMeds(visit.coop_name) },
      { text: 'Sil', style: 'destructive', onPress: () => confirmDelete(visit) },
      { text: 'Vazgeç', style: 'cancel' }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Kümes Ziyaretleri</Text>
          <Text style={styles.subtitle}>
            Bugün: {dailyVisits.length} · Toplam: {visits.length}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.primary]}
          onPress={() =>
            Alert.alert('Yeni Kayıt', 'Ne eklemek istersiniz?', [
              { text: 'Form', onPress: onNewForm },
              { text: 'İlaç Listesi', onPress: onNewMeds },
              { text: 'Vazgeç', style: 'cancel' }
            ])
          }
        >
          <Text style={styles.buttonText}>Yeni Ziyaret</Text>
        </Pressable>
        <View style={styles.row}>
          <Pressable
            style={[styles.button, styles.secondary, styles.half]}
            onPress={exportExcel}
            disabled={exporting}
          >
            <Text style={styles.buttonText}>{exporting ? 'Excel Hazırlanıyor...' : "Excel'e Aktar"}</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.outline, styles.half]}
            onPress={viewExcel}
            disabled={viewing}
          >
            <Text style={styles.outlineText}>{viewing ? 'Excel Açılıyor...' : "Excel'i Görüntüle"}</Text>
          </Pressable>
        </View>
        <Pressable style={[styles.button, styles.info]} onPress={onOpenBreeder}>
          <Text style={styles.buttonText}>Damızlık Yaşları</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.accent]} onPress={onOpenKesim}>
          <Text style={styles.buttonText}>Kesim/Nakil</Text>
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
          ListFooterComponent={
            dailyMeds.length > 0 ? (
              <View style={styles.medsSection}>
                <Text style={styles.medsTitle}>Günlük Verilen İlaçlar</Text>
                {Object.entries(
                  dailyMeds.reduce<Record<string, MedicationEntry[]>>((acc, med) => {
                    const key = med.coop_name || 'Kümes Adı Yok';
                    acc[key] = acc[key] || [];
                    acc[key].push(med);
                    return acc;
                  }, {})
                ).map(([coop, items]) => (
                  <View key={coop} style={styles.medsCard}>
                    <Text style={styles.medsCoop}>{coop}</Text>
                    {items.map(item => (
                      <Text key={item.id} style={styles.medsLine}>
                        {item.med_name} · {item.quantity} {item.unit === 'AD' ? 'ADET' : item.unit}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => handleVisitPress(item)}>
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
        <View style={{ flex: 1 }}>
          <View style={styles.coopPicker}>
            <Text style={styles.coopPickerLabel}>Seçili Kümes:</Text>
            <Pressable
              style={styles.coopPickerButton}
              onPress={() => setCoopPickerOpen(true)}
            >
              <Text style={styles.coopPickerText}>
                {selectedCoop || 'Kümes seç'}
              </Text>
            </Pressable>
          </View>
          <SectionList
            sections={coopSectionData}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.emptyText}>Kümes kaydı yok (son 90 gün).</Text>}
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionHeader}>Kümes: {section.title}</Text>
            )}
            renderItem={({ item }) => (
              <Pressable style={styles.card} onPress={() => handleVisitPress(item)}>
                <Text style={styles.cardTitle}>{item.producer_name}</Text>
                <Text style={styles.cardSubtitle}>{formatDateTR(item.visit_date)}</Text>
                <Text style={styles.cardHint}>Düzenlemek için dokun</Text>
              </Pressable>
            )}
          />
          <Modal visible={coopPickerOpen} transparent animationType="slide">
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Kümes Seç</Text>
                <SectionList
                  sections={[{ title: 'Kümeler', data: coopNames }]}
                  keyExtractor={item => item}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[
                        styles.modalItem,
                        item === selectedCoop && styles.modalItemActive
                      ]}
                      onPress={() => {
                        setSelectedCoop(item);
                        setCoopPickerOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.modalItemText,
                          item === selectedCoop && styles.modalItemTextActive
                        ]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  )}
                />
                <Pressable style={[styles.button, styles.ghost]} onPress={() => setCoopPickerOpen(false)}>
                  <Text style={styles.ghostText}>Kapat</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0 },
  header: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#eee'
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1B1B1B' },
  subtitle: { marginTop: 4, color: '#666' },
  actions: { paddingHorizontal: 16, gap: 10, marginTop: 12 },
  row: { flexDirection: 'row', gap: 10 },
  button: { padding: 12, borderRadius: 10, alignItems: 'center' },
  half: { flex: 1 },
  primary: { backgroundColor: '#2E7D32' },
  secondary: { backgroundColor: '#0277BD' },
  info: { backgroundColor: '#455A64' },
  accent: { backgroundColor: '#EF6C00' },
  outline: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#0277BD' },
  ghost: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' },
  buttonText: { color: '#fff', fontWeight: '600' },
  outlineText: { color: '#0277BD', fontWeight: '600' },
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
  sectionHeader: { fontSize: 14, fontWeight: '700', color: '#2E7D32', marginBottom: 8 },
  coopPicker: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  coopPickerLabel: { color: '#555', fontWeight: '600' },
  coopPickerButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff'
  },
  coopPickerText: { color: '#1B1B1B', fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%'
  },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  modalItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 8
  },
  modalItemActive: { borderColor: '#2E7D32', backgroundColor: '#E8F5E9' },
  modalItemText: { color: '#333', fontWeight: '600' },
  modalItemTextActive: { color: '#2E7D32' },
  medsSection: { marginTop: 16, gap: 10 },
  medsTitle: { fontSize: 14, fontWeight: '700', color: '#1B1B1B' },
  medsCard: { backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#eee' },
  medsCoop: { fontWeight: '700', marginBottom: 6, color: '#2E7D32' },
  medsLine: { color: '#444', marginBottom: 4 }
});
