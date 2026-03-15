import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const FALLBACK_KEY = 'device_fallback_id';

const generateFallbackId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const getDeviceId = async () => {
  let id: string | null = null;
  if (Platform.OS === 'ios') {
    id = await Application.getIosIdForVendorAsync();
  } else if (Platform.OS === 'android') {
    id = Application.androidId ?? null;
  }

  if (!id) {
    const stored = await SecureStore.getItemAsync(FALLBACK_KEY);
    if (stored) return stored;
    const fallback = generateFallbackId();
    await SecureStore.setItemAsync(FALLBACK_KEY, fallback);
    return fallback;
  }

  return id;
};

export const getDeviceLabel = () => {
  const parts = [Device.manufacturer, Device.modelName].filter(Boolean);
  const label = parts.join(' ');
  return label || `${Platform.OS.toUpperCase()} cihaz`;
};
