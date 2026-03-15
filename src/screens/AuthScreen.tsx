import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { auth } from '../services/firebase';

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!auth) {
      Alert.alert('Hata', 'Firebase ayarları eksik.');
      return;
    }
    if (!email || !password) {
      Alert.alert('Uyarı', 'E-posta ve şifre gerekli.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Giriş yapılamadı.';
      Alert.alert('Hata', message);
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!auth) return;
    if (!email) {
      Alert.alert('Uyarı', 'Şifre sıfırlama için e-posta girin.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert('Başarılı', 'Şifre sıfırlama e-postası gönderildi.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'İşlem yapılamadı.';
      Alert.alert('Hata', message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ÜSTAD YAĞIZIN HAYRATI</Text>
      <Text style={styles.subtitle}>
        {mode === 'login' ? 'Giriş yap' : 'Yeni hesap oluştur'}
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>E-posta</Text>
        <TextInput
          style={styles.input}
          placeholder="ornek@mail.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Text style={styles.label}>Şifre</Text>
        <TextInput
          style={styles.input}
          placeholder="Şifre"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable style={[styles.button, styles.primary]} onPress={handleSubmit} disabled={busy}>
          <Text style={styles.buttonText}>
            {busy ? 'Bekleyin...' : mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
          </Text>
        </Pressable>

        <Pressable style={styles.linkButton} onPress={handleReset}>
          <Text style={styles.linkText}>Şifremi Unuttum</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.outline]}
          onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          <Text style={styles.outlineText}>
            {mode === 'login' ? 'Yeni hesap aç' : 'Zaten hesabım var'}
          </Text>
        </Pressable>
      </View>

      {busy && <ActivityIndicator style={{ marginTop: 16 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7', padding: 24, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', color: '#1B1B1B' },
  subtitle: { textAlign: 'center', color: '#666', marginTop: 8, marginBottom: 16 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#eee' },
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
  outline: { borderWidth: 1, borderColor: '#2E7D32', backgroundColor: '#fff' },
  buttonText: { color: '#fff', fontWeight: '600' },
  outlineText: { color: '#2E7D32', fontWeight: '600' },
  linkButton: { marginTop: 12, alignItems: 'center' },
  linkText: { color: '#0277BD', fontWeight: '600' }
});
