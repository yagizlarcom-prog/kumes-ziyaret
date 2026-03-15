import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getOfferings,
  purchasePackage,
  restorePurchases
} from '../services/subscription';
import { PurchasesPackage } from 'react-native-purchases';

type Props = {
  onPurchased: () => void;
  onSignOut: () => void;
};

export default function PaywallScreen({ onPurchased, onSignOut }: Props) {
  const [loading, setLoading] = useState(false);
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const offering = await getOfferings();
      const candidate = offering?.availablePackages?.[0] ?? null;
      setPkg(candidate);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Teklif alınamadı.';
      Alert.alert('Hata', message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handlePurchase = async () => {
    if (!pkg) {
      Alert.alert('Uyarı', 'Satın alma paketi bulunamadı.');
      return;
    }
    setLoading(true);
    try {
      await purchasePackage(pkg);
      onPurchased();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Satın alma başarısız.';
      Alert.alert('Hata', message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      await restorePurchases();
      onPurchased();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Geri yükleme başarısız.';
      Alert.alert('Hata', message);
    } finally {
      setLoading(false);
    }
  };

  const priceLabel = pkg?.product?.priceString ?? '149 TL/ay';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>7 Gün Ücretsiz</Text>
      <Text style={styles.subtitle}>Sonra {priceLabel} • Aylık abonelik</Text>
      <Text style={styles.note}>
        Deneme hakkınız uygunsa 7 gün ücretsiz başlayacaktır.
      </Text>
      <Text style={styles.disclaimer}>
        Deneme bitince abonelik otomatik olarak ücretli devam eder ve istediğiniz zaman iptal edebilirsiniz.
      </Text>
      <Text style={styles.disclaimer}>
        İptal işlemini App Store veya Google Play üzerinden yapabilirsiniz.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Abonelik ile neler var?</Text>
        <Text style={styles.cardText}>• Tüm ziyaret kayıtlarına sınırsız erişim</Text>
        <Text style={styles.cardText}>• Excel şablonuna tam aktarım</Text>
        <Text style={styles.cardText}>• Kesim/Nakil belgeleri</Text>
        <Text style={styles.cardText}>• 2 gün offline kullanım</Text>
      </View>

      <Pressable style={[styles.button, styles.primary]} onPress={handlePurchase} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'İşleniyor...' : 'Ücretsiz Başlat'}</Text>
      </Pressable>

      <Pressable style={[styles.button, styles.outline]} onPress={handleRestore} disabled={loading}>
        <Text style={styles.outlineText}>Satın Almayı Geri Yükle</Text>
      </Pressable>

      <Pressable style={styles.linkButton} onPress={onSignOut}>
        <Text style={styles.linkText}>Hesap Değiştir</Text>
      </Pressable>

      {loading && <ActivityIndicator style={{ marginTop: 16 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7', padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: { textAlign: 'center', color: '#666', marginTop: 8 },
  note: { textAlign: 'center', color: '#888', marginTop: 6, marginBottom: 16 },
  disclaimer: { textAlign: 'center', color: '#777', marginTop: 6 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#eee' },
  cardTitle: { fontWeight: '700', marginBottom: 8 },
  cardText: { color: '#444', marginBottom: 6 },
  button: { marginTop: 14, padding: 12, borderRadius: 10, alignItems: 'center' },
  primary: { backgroundColor: '#2E7D32' },
  outline: { borderWidth: 1, borderColor: '#2E7D32', backgroundColor: '#fff' },
  buttonText: { color: '#fff', fontWeight: '600' },
  outlineText: { color: '#2E7D32', fontWeight: '600' },
  linkButton: { marginTop: 12, alignItems: 'center' },
  linkText: { color: '#0277BD', fontWeight: '600' }
});
