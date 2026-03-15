import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from './firebase';

type UserDoc = {
  email?: string;
  activeDeviceId?: string;
  activeDeviceLabel?: string;
  activeDeviceUpdatedAt?: unknown;
  lastVerifiedAt?: unknown;
};

export const ensureUserDoc = async (uid: string, email?: string | null) => {
  if (!db) throw new Error('Firebase yapılandırması eksik.');
  const ref = doc(db, 'users', uid);
  await setDoc(
    ref,
    {
      email: email ?? '',
      createdAt: serverTimestamp()
    },
    { merge: true }
  );
  return ref;
};

export const getUserDoc = async (uid: string) => {
  if (!db) throw new Error('Firebase yapılandırması eksik.');
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as UserDoc) : null;
};

export const setActiveDevice = async (uid: string, deviceId: string, label: string) => {
  if (!db) throw new Error('Firebase yapılandırması eksik.');
  const ref = doc(db, 'users', uid);
  await setDoc(
    ref,
    {
      activeDeviceId: deviceId,
      activeDeviceLabel: label,
      activeDeviceUpdatedAt: serverTimestamp()
    },
    { merge: true }
  );
};

export const updateLastVerifiedAt = async (uid: string) => {
  if (!db) throw new Error('Firebase yapılandırması eksik.');
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { lastVerifiedAt: serverTimestamp() });
};
