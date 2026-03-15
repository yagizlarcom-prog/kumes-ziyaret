import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import { getDeviceId, getDeviceLabel } from '../services/device';
import { ensureUserDoc, getUserDoc, setActiveDevice } from '../services/user';

type DeviceStatus = 'checking' | 'ok' | 'blocked' | 'error';

export const useDeviceGate = (user: User | null) => {
  const [status, setStatus] = useState<DeviceStatus>('checking');
  const [remoteLabel, setRemoteLabel] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');

  const cacheKey = user ? `active_device_id_${user.uid}` : '';

  const check = useCallback(async () => {
    if (!user) {
      setStatus('checking');
      return;
    }
    let currentId = deviceId;
    try {
      const id = await getDeviceId();
      currentId = id;
      const label = getDeviceLabel();
      setDeviceId(id);
      await ensureUserDoc(user.uid, user.email);
      const doc = await getUserDoc(user.uid);

      if (!doc?.activeDeviceId || doc.activeDeviceId === id) {
        await setActiveDevice(user.uid, id, label);
        if (cacheKey) {
          await AsyncStorage.setItem(cacheKey, id);
        }
        setStatus('ok');
        setRemoteLabel('');
        return;
      }

      setRemoteLabel(doc.activeDeviceLabel || 'Bilinmeyen cihaz');
      setStatus('blocked');
    } catch (err) {
      if (cacheKey) {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached && cached === currentId) {
          setStatus('ok');
          return;
        }
      }
      setStatus('error');
    }
  }, [cacheKey, deviceId, user]);

  useEffect(() => {
    check();
  }, [check]);

  const takeover = async () => {
    if (!user) return;
    const label = getDeviceLabel();
    await setActiveDevice(user.uid, deviceId, label);
    if (cacheKey) {
      await AsyncStorage.setItem(cacheKey, deviceId);
    }
    setStatus('ok');
    setRemoteLabel('');
  };

  return { status, remoteLabel, refresh: check, takeover };
};
