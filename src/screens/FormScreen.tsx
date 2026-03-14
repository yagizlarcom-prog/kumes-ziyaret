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
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { getRecentVisits, insertVisit, updateVisit } from '../db';
import { Visit } from '../models';
import {
  calcStayMinutes,
  dateToTime,
  formatDateTR,
  formatMinutes,
  timeToDate,
  toFixedOrNull,
  toISODate,
  toNumber
} from '../utils';

type Props = {
  onCancel: () => void;
  onSaved: () => void;
  initialVisit?: Visit;
};

type VisitForm = {
  coopName: string;
  producerName: string;
  fieldOfficer: string;
  visitDate: string;
  arrivalTime: string;
  departureTime: string;
  coopAreaM2: string;
  entryDate: string;
  entryCount: string;
  chickOrigin: string;
  breederAndAge: string;
  firstWeekDeathCount: string;
  visitDeathCount: string;
  chickAge: string;
  oca: string;
  stdOca: string;
  gerStd: string;
  totalLiveKg: string;
  feedUsed: string;
  ventilationCapacity: string;
  biosecurity: string;
  notes: string;
};

type Suggestions = {
  coopName: string[];
  producerName: string[];
  fieldOfficer: string[];
  chickOrigin: string[];
  breederAndAge: string[];
  ventilationCapacity: string[];
  biosecurity: string[];
  notes: string[];
};

type PickerTarget = 'visitDate' | 'entryDate' | 'arrivalTime' | 'departureTime';

const emptySuggestions: Suggestions = {
  coopName: [],
  producerName: [],
  fieldOfficer: [],
  chickOrigin: [],
  breederAndAge: [],
  ventilationCapacity: [],
  biosecurity: [],
  notes: []
};

const uniqueRecent = (
  items: Visit[],
  getter: (v: Visit) => string | null | undefined,
  limit = 3
) => {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const raw = getter(item);
    const value = raw ? raw.trim() : '';
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }

  return out;
};

const numToString = (value: number | null | undefined) =>
  value == null || Number.isNaN(value) ? '' : String(value);

export default function FormScreen({ onCancel, onSaved, initialVisit }: Props) {
  const today = toISODate(new Date());
  const isEditing = Boolean(initialVisit);
  const [form, setForm] = useState<VisitForm>(() => ({
    coopName: initialVisit?.coop_name ?? '',
    producerName: initialVisit?.producer_name ?? '',
    fieldOfficer: initialVisit?.field_officer ?? '',
    visitDate: initialVisit?.visit_date || today,
    arrivalTime: initialVisit?.arrival_time ?? '',
    departureTime: initialVisit?.departure_time ?? '',
    coopAreaM2: numToString(initialVisit?.coop_area_m2),
    entryDate: initialVisit?.entry_date ?? '',
    entryCount: numToString(initialVisit?.entry_count),
    chickOrigin: initialVisit?.chick_origin ?? '',
    breederAndAge: initialVisit?.breeder_and_age ?? '',
    firstWeekDeathCount: numToString(initialVisit?.first_week_death_count),
    visitDeathCount: numToString(initialVisit?.visit_death_count),
    chickAge: initialVisit?.chick_age ?? '',
    oca: numToString(initialVisit?.oca),
    stdOca: numToString(initialVisit?.std_oca),
    gerStd: numToString(initialVisit?.ger_std),
    totalLiveKg: numToString(initialVisit?.total_live_kg),
    feedUsed: numToString(initialVisit?.feed_used),
    ventilationCapacity: initialVisit?.ventilation_capacity ?? '',
    biosecurity: initialVisit?.biosecurity ?? '',
    notes: initialVisit?.notes ?? ''
  }));

  const [suggestions, setSuggestions] = useState<Suggestions>(emptySuggestions);

  const [picker, setPicker] = useState<{
    show: boolean;
    mode: 'date' | 'time';
    target: PickerTarget | null;
  }>({ show: false, mode: 'date', target: null });

  useEffect(() => {
    let active = true;

    const loadSuggestions = async () => {
      try {
        const recent = await getRecentVisits(50);
        if (!active) return;
        setSuggestions({
          coopName: uniqueRecent(recent, v => v.coop_name),
          producerName: uniqueRecent(recent, v => v.producer_name),
          fieldOfficer: uniqueRecent(recent, v => v.field_officer),
          chickOrigin: uniqueRecent(recent, v => v.chick_origin),
          breederAndAge: uniqueRecent(recent, v => v.breeder_and_age),
          ventilationCapacity: uniqueRecent(recent, v => v.ventilation_capacity),
          biosecurity: uniqueRecent(recent, v => v.biosecurity),
          notes: uniqueRecent(recent, v => v.notes)
        });
      } catch {
        if (active) setSuggestions(emptySuggestions);
      }
    };

    loadSuggestions();
    return () => {
      active = false;
    };
  }, []);

  const setField = (key: keyof VisitForm, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const entryCountNum = toNumber(form.entryCount);
  const coopAreaNum = toNumber(form.coopAreaM2);
  const firstWeekDeathCountNum = toNumber(form.firstWeekDeathCount);
  const visitDeathCountNum = toNumber(form.visitDeathCount);
  const totalLiveKgNum = toNumber(form.totalLiveKg);
  const feedUsedNum = toNumber(form.feedUsed);
  const ocaNum = toNumber(form.oca);
  const stdOcaNum = toNumber(form.stdOca);
  const gerStdNum = toNumber(form.gerStd);

  const stayMinutes = useMemo(
    () => calcStayMinutes(form.arrivalTime, form.departureTime),
    [form.arrivalTime, form.departureTime]
  );

  const densityPerM2 = useMemo(() => {
    if (entryCountNum == null || coopAreaNum == null || coopAreaNum === 0) return null;
    return entryCountNum / coopAreaNum;
  }, [entryCountNum, coopAreaNum]);

  const firstWeekDeathPercent = useMemo(() => {
    if (entryCountNum == null || firstWeekDeathCountNum == null || entryCountNum === 0) return null;
    return (firstWeekDeathCountNum / entryCountNum) * 100;
  }, [entryCountNum, firstWeekDeathCountNum]);

  const visitDeathPercent = useMemo(() => {
    if (entryCountNum == null || visitDeathCountNum == null || entryCountNum === 0) return null;
    return (visitDeathCountNum / entryCountNum) * 100;
  }, [entryCountNum, visitDeathCountNum]);

  const coopRemaining = useMemo(() => {
    if (entryCountNum == null || visitDeathCountNum == null) return null;
    return entryCountNum - visitDeathCountNum;
  }, [entryCountNum, visitDeathCountNum]);

  const fcr = useMemo(() => {
    if (feedUsedNum == null || totalLiveKgNum == null || totalLiveKgNum === 0) return null;
    return feedUsedNum / totalLiveKgNum;
  }, [feedUsedNum, totalLiveKgNum]);

  const randiman = useMemo(() => {
    if (feedUsedNum == null || totalLiveKgNum == null || feedUsedNum === 0) return null;
    return totalLiveKgNum / feedUsedNum;
  }, [feedUsedNum, totalLiveKgNum]);

  const openPicker = (target: PickerTarget, mode: 'date' | 'time') =>
    setPicker({ show: true, mode, target });

  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    setPicker(p => ({ ...p, show: false }));
    if (event.type !== 'set' || !date || !picker.target) return;
    if (picker.mode === 'date') {
      setField(picker.target, toISODate(date));
    } else {
      setField(picker.target, dateToTime(date));
    }
  };

  const save = async () => {
    if (!form.producerName.trim()) {
      Alert.alert('Eksik Alan', 'Üretici ismi gerekli.');
      return;
    }

    if (!form.coopName.trim()) {
      Alert.alert('Eksik Alan', 'Kümes adı gerekli.');
      return;
    }

    const visit: Visit = {
      id: initialVisit?.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      coop_name: form.coopName.trim(),
      producer_name: form.producerName.trim(),
      field_officer: form.fieldOfficer.trim(),
      visit_date: form.visitDate,
      arrival_time: form.arrivalTime,
      departure_time: form.departureTime,
      stay_minutes: stayMinutes,
      coop_area_m2: coopAreaNum,
      entry_date: form.entryDate,
      entry_count: entryCountNum,
      chick_origin: form.chickOrigin.trim(),
      breeder_and_age: form.breederAndAge.trim(),
      density_per_m2: toFixedOrNull(densityPerM2),
      first_week_death_count: firstWeekDeathCountNum,
      first_week_death_percent: toFixedOrNull(firstWeekDeathPercent),
      visit_death_count: visitDeathCountNum,
      visit_death_percent: toFixedOrNull(visitDeathPercent),
      chick_age: form.chickAge.trim(),
      oca: ocaNum,
      std_oca: stdOcaNum,
      ger_std: gerStdNum,
      coop_remaining: coopRemaining,
      total_live_kg: totalLiveKgNum,
      feed_used: feedUsedNum,
      fcr: toFixedOrNull(fcr),
      randiman: toFixedOrNull(randiman),
      ventilation_capacity: form.ventilationCapacity.trim(),
      biosecurity: form.biosecurity.trim(),
      notes: form.notes.trim(),
      created_at: initialVisit?.created_at ?? new Date().toISOString()
    };

    if (isEditing) {
      await updateVisit(visit);
    } else {
      await insertVisit(visit);
    }
    onSaved();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>{isEditing ? 'Ziyaret Düzenle' : 'Temel Bilgiler'}</Text>
        <Field
          label="KÜMES ADI"
          value={form.coopName}
          onChangeText={t => setField('coopName', t)}
          suggestions={suggestions.coopName}
        />
        <Field
          label="ÜRETİCİ İSMİ"
          value={form.producerName}
          onChangeText={t => setField('producerName', t)}
          suggestions={suggestions.producerName}
        />
        <Field
          label="SAHA SORUMLUSU"
          value={form.fieldOfficer}
          onChangeText={t => setField('fieldOfficer', t)}
          suggestions={suggestions.fieldOfficer}
        />

        <Text style={styles.sectionTitle}>Tarih ve Saat</Text>
        <PickerField
          label="ZİY.TARİHİ"
          value={form.visitDate ? formatDateTR(form.visitDate) : ''}
          onPress={() => openPicker('visitDate', 'date')}
        />
        <PickerField
          label="gidiş saati"
          value={form.arrivalTime}
          onPress={() => openPicker('arrivalTime', 'time')}
        />
        <PickerField
          label="çıkış saati"
          value={form.departureTime}
          onPress={() => openPicker('departureTime', 'time')}
        />
        <ReadOnlyField label="kalış süresi" value={formatMinutes(stayMinutes)} />

        <Text style={styles.sectionTitle}>Kümes ve Giriş</Text>
        <NumberField label="KÜM.M2" value={form.coopAreaM2} onChangeText={t => setField('coopAreaM2', t)} />
        <PickerField
          label="GİRİŞ TARİHİ"
          value={form.entryDate ? formatDateTR(form.entryDate) : ''}
          onPress={() => openPicker('entryDate', 'date')}
        />
        <NumberField label="GİRİŞ ADEDİ" value={form.entryCount} onChangeText={t => setField('entryCount', t)} />
        <Field
          label="CİVCİV ORJİNİ"
          value={form.chickOrigin}
          onChangeText={t => setField('chickOrigin', t)}
          suggestions={suggestions.chickOrigin}
        />
        <Field
          label="DAMIZLIK VE YAŞI"
          value={form.breederAndAge}
          onChangeText={t => setField('breederAndAge', t)}
          suggestions={suggestions.breederAndAge}
        />
        <ReadOnlyField label="ADET/M2" value={densityPerM2 == null ? '' : densityPerM2.toFixed(2)} />

        <Text style={styles.sectionTitle}>Ölüm Bilgileri</Text>
        <NumberField label="İLK HAFTA ÖLÜM ADET" value={form.firstWeekDeathCount} onChangeText={t => setField('firstWeekDeathCount', t)} />
        <ReadOnlyField label="İLK HAFTA ÖLÜM %" value={firstWeekDeathPercent == null ? '' : firstWeekDeathPercent.toFixed(2)} />
        <NumberField label="ZİY.TARİHİNDE ÖLÜM ADEDİ" value={form.visitDeathCount} onChangeText={t => setField('visitDeathCount', t)} />
        <ReadOnlyField label="ZİY.TARİHİNDE ÖLÜM %" value={visitDeathPercent == null ? '' : visitDeathPercent.toFixed(2)} />

        <Text style={styles.sectionTitle}>Performans</Text>
        <Field label="CİVCİV YAŞI" value={form.chickAge} onChangeText={t => setField('chickAge', t)} />
        <NumberField label="OCA" value={form.oca} onChangeText={t => setField('oca', t)} />
        <NumberField label="STD.OCA" value={form.stdOca} onChangeText={t => setField('stdOca', t)} />
        <NumberField label="GER/STD" value={form.gerStd} onChangeText={t => setField('gerStd', t)} />
        <ReadOnlyField label="KÜM.KALAN" value={coopRemaining == null ? '' : String(coopRemaining)} />
        <NumberField label="TOP.CANLI KG" value={form.totalLiveKg} onChangeText={t => setField('totalLiveKg', t)} />
        <NumberField label="YED.YEM" value={form.feedUsed} onChangeText={t => setField('feedUsed', t)} />
        <ReadOnlyField label="FCR" value={fcr == null ? '' : fcr.toFixed(3)} />
        <ReadOnlyField label="RANDIMAN" value={randiman == null ? '' : randiman.toFixed(3)} />

        <Text style={styles.sectionTitle}>Diğer</Text>
        <Field
          label="HAVALANDIRMA KAPASİTESİ"
          value={form.ventilationCapacity}
          onChangeText={t => setField('ventilationCapacity', t)}
          suggestions={suggestions.ventilationCapacity}
        />
        <Field
          label="BİYOGÜVENLİK"
          value={form.biosecurity}
          onChangeText={t => setField('biosecurity', t)}
          suggestions={suggestions.biosecurity}
        />
        <Field
          label="AÇIKLAMALAR"
          value={form.notes}
          onChangeText={t => setField('notes', t)}
          multiline
          suggestions={suggestions.notes}
        />

        <View style={styles.actions}>
          <Pressable style={[styles.button, styles.secondary]} onPress={onCancel}>
            <Text style={styles.buttonText}>Vazgeç</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.primary]} onPress={save}>
            <Text style={styles.buttonText}>{isEditing ? 'Güncelle' : 'Kaydet'}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {picker.show && (
        <DateTimePicker
          value={picker.mode === 'time' ? timeToDate(form[picker.target || 'arrivalTime']) : new Date()}
          mode={picker.mode}
          is24Hour
          onChange={onPickerChange}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  suggestions?: string[];
}) {
  const hasSuggestions = props.suggestions && props.suggestions.length > 0;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={[styles.input, props.multiline && styles.multiline]}
        value={props.value}
        onChangeText={props.onChangeText}
        multiline={props.multiline}
      />
      {hasSuggestions ? (
        <SuggestionRow items={props.suggestions || []} onPick={props.onChangeText} />
      ) : null}
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

function PickerField(props: { label: string; value: string; onPress: () => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <Pressable style={styles.picker} onPress={props.onPress}>
        <Text style={styles.pickerText}>{props.value || 'Seç'}</Text>
      </Pressable>
    </View>
  );
}

function ReadOnlyField(props: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.readonly}>
        <Text style={styles.readonlyText}>{props.value || '-'}</Text>
      </View>
    </View>
  );
}

function SuggestionRow(props: { items: string[]; onPick: (value: string) => void }) {
  return (
    <View style={styles.suggestionWrap}>
      <Text style={styles.suggestionLabel}>Son 3:</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.suggestionChips}
      >
        {props.items.map(item => (
          <Pressable key={item} style={styles.suggestionChip} onPress={() => props.onPick(item)}>
            <Text style={styles.suggestionText} numberOfLines={1} ellipsizeMode="tail">
              {item}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  scroll: { padding: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  field: { marginBottom: 12 },
  label: { marginBottom: 6, color: '#333' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  picker: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 },
  pickerText: { color: '#222' },
  readonly: { backgroundColor: '#eee', borderRadius: 8, padding: 10 },
  readonlyText: { color: '#555' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  button: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  primary: { backgroundColor: '#2E7D32' },
  secondary: { backgroundColor: '#607D8B' },
  buttonText: { color: '#fff', fontWeight: '600' },
  suggestionWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  suggestionLabel: { fontSize: 12, color: '#666', marginRight: 8 },
  suggestionChips: { gap: 8, paddingRight: 6 },
  suggestionChip: {
    backgroundColor: '#E3F2FD',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#BBDEFB',
    maxWidth: 180
  },
  suggestionText: { fontSize: 12, color: '#0D47A1' }
});
