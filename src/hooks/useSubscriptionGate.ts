import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import {
  configurePurchases,
  getCustomerInfo,
  getEntitlementId,
  isEntitlementActive
} from '../services/subscription';
import { updateLastVerifiedAt } from '../services/user';

type SubStatus = 'checking' | 'active' | 'inactive' | 'grace' | 'offline_blocked' | 'error';

const GRACE_MS = 1000 * 60 * 60 * 48;

const getKey = (uid: string) => `last_verified_at_${uid}`;

export const useSubscriptionGate = (user: User | null, enabled: boolean) => {
  const [status, setStatus] = useState<SubStatus>('checking');
  const [lastVerifiedAt, setLastVerifiedAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !enabled) return;
    setStatus('checking');
    try {
      await configurePurchases(user.uid);
      const info = await getCustomerInfo();
      const entitlementId = getEntitlementId();
      const isActive = isEntitlementActive(info, entitlementId);

      const now = Date.now();
      await AsyncStorage.setItem(getKey(user.uid), String(now));
      setLastVerifiedAt(now);

      if (isActive) {
        try {
          await updateLastVerifiedAt(user.uid);
        } catch (err) {
          // Ağ yoksa veya izin hatası varsa uygulamayı kilitlemeyelim.
        }
        setStatus('active');
      } else {
        setStatus('inactive');
      }
    } catch (err) {
      const stored = await AsyncStorage.getItem(getKey(user.uid));
      const last = stored ? Number(stored) : null;
      if (last && Date.now() - last <= GRACE_MS) {
        setLastVerifiedAt(last);
        setStatus('grace');
      } else {
        setLastVerifiedAt(last);
        setStatus('offline_blocked');
      }
    }
  }, [enabled, user]);

  useEffect(() => {
    if (!user || !enabled) return;
    refresh();
  }, [enabled, refresh, user]);

  return { status, lastVerifiedAt, refresh };
};
