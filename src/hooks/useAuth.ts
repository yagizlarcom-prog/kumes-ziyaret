import { onAuthStateChanged, User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth } from '../services/firebase';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (!auth) {
      setInitializing(false);
      setUser(null);
      return;
    }
    const unsub = onAuthStateChanged(auth, current => {
      setUser(current);
      setInitializing(false);
    });
    return () => unsub();
  }, []);

  return { user, initializing };
};
