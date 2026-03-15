import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  message: string;
};

export default function ConfigMissingScreen({ message }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kurulum Eksik</Text>
      <Text style={styles.subtitle}>{message}</Text>
      <Text style={styles.note}>
        app.json içindeki firebase ve revenueCat alanlarını doldurup tekrar deneyin.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7', padding: 24, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { textAlign: 'center', color: '#666', marginTop: 8 },
  note: { textAlign: 'center', color: '#999', marginTop: 8 }
});
