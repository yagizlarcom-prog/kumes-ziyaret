import Constants from 'expo-constants';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};

const extra = (Constants.expoConfig?.extra ?? Constants.manifest?.extra) as
  | { firebase?: FirebaseConfig }
  | undefined;

const firebaseConfig = extra?.firebase;

export const firebaseMissingConfig =
  !firebaseConfig?.apiKey || !firebaseConfig?.authDomain || !firebaseConfig?.projectId;

let app: FirebaseApp | null = null;

if (!firebaseMissingConfig) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig as FirebaseConfig);
}

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
