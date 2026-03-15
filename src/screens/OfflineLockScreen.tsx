import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDateTimeTR } from '../utils';

type Props = {
  lastVerifiedAt: number | null;
  onRetry: () => void;
};

export default function OfflineLockScreen({ lastVerifiedAt, onRetry }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>İnternet Gerekli</Text>
      <Text style={styles.subtitle}>
        Abonelik doğrulaması için internet bağlantısı lazım.
      </Text>
      {lastVerifiedAt ? (
        <Text style={styles.note}>
          Son doğrulama: {formatDateTimeTR(new Date(lastVerifiedAt))}
        </Text>
      ) : (
        <Text style={styles.note}>Son doğrulama bulunamadı.</Text>
      )}
      <Pressable style={[styles.button, styles.primary]} onPress={onRetry}>
        <Text style={styles.buttonText}>Tekrar Dene</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7', padding: 24, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { textAlign: 'center', color: '#666', marginTop: 8 },
  note: { textAlign: 'center', color: '#999', marginTop: 8 },
  button: { marginTop: 16, padding: 12, borderRadius: 10, alignItems: 'center' },
  primary: { backgroundColor: '#2E7D32' },
  buttonText: { color: '#fff', fontWeight: '600' }
});
