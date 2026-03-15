import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  remoteLabel: string;
  onTakeover: () => void;
  onSignOut: () => void;
};

export default function DeviceLimitScreen({ remoteLabel, onTakeover, onSignOut }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cihaz Limiti</Text>
      <Text style={styles.subtitle}>
        Bu hesap başka bir cihazda aktif görünüyor:
      </Text>
      <Text style={styles.device}>{remoteLabel}</Text>

      <Pressable style={[styles.button, styles.primary]} onPress={onTakeover}>
        <Text style={styles.buttonText}>Bu Cihazı Aktif Et</Text>
      </Pressable>
      <Pressable style={[styles.button, styles.outline]} onPress={onSignOut}>
        <Text style={styles.outlineText}>Farklı Hesapla Giriş</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7', padding: 24, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { textAlign: 'center', color: '#666', marginTop: 8 },
  device: { textAlign: 'center', fontWeight: '700', marginTop: 8, color: '#2E7D32' },
  button: { marginTop: 16, padding: 12, borderRadius: 10, alignItems: 'center' },
  primary: { backgroundColor: '#2E7D32' },
  outline: { borderWidth: 1, borderColor: '#2E7D32', backgroundColor: '#fff' },
  buttonText: { color: '#fff', fontWeight: '600' },
  outlineText: { color: '#2E7D32', fontWeight: '600' }
});
