import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import { signOut } from 'firebase/auth';
import { initDb } from './src/db';
import { Visit } from './src/models';
import ListScreen from './src/screens/ListScreen';
import FormScreen from './src/screens/FormScreen';
import KesimScreen from './src/screens/KesimScreen';
import MedsScreen from './src/screens/MedsScreen';
import BreederAgeScreen from './src/screens/BreederAgeScreen';
import AuthScreen from './src/screens/AuthScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import DeviceLimitScreen from './src/screens/DeviceLimitScreen';
import OfflineLockScreen from './src/screens/OfflineLockScreen';
import ConfigMissingScreen from './src/screens/ConfigMissingScreen';
import { useAuth } from './src/hooks/useAuth';
import { useDeviceGate } from './src/hooks/useDeviceGate';
import { useSubscriptionGate } from './src/hooks/useSubscriptionGate';
import { auth, firebaseMissingConfig } from './src/services/firebase';
import { logOutPurchases, revenueCatMissingConfig } from './src/services/subscription';
import { authEnabled, subscriptionsEnabled } from './src/services/flags';

export default function App() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<'list' | 'form' | 'kesim' | 'meds' | 'breeder'>('list');
  const [medsCoopName, setMedsCoopName] = useState<string | undefined>(undefined);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const { user, initializing } = useAuth();
  const { status: deviceStatus, remoteLabel, takeover } = useDeviceGate(user);
  const { status: subStatus, lastVerifiedAt, refresh: refreshSub } = useSubscriptionGate(
    user,
    deviceStatus === 'ok'
  );

  useEffect(() => {
    initDb().then(() => setReady(true)).catch(() => setReady(true));
  }, []);
  useEffect(() => {
    const onBack = () => {
      if (screen !== 'list') {
        setEditingVisit(null);
        setMedsCoopName(undefined);
        setScreen('list');
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [screen]);

  if (authEnabled && firebaseMissingConfig) {
    return <ConfigMissingScreen message="Firebase ayarları girilmedi." />;
  }

  if (subscriptionsEnabled && revenueCatMissingConfig) {
    return <ConfigMissingScreen message="RevenueCat anahtarları girilmedi." />;
  }

  if (!ready || (authEnabled && initializing)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (authEnabled && !user) {
    return <AuthScreen />;
  }

  const handleSignOut = () => {
    logOutPurchases().catch(() => undefined);
    if (auth) signOut(auth);
  };

  if (authEnabled && deviceStatus === 'checking') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (authEnabled && deviceStatus === 'blocked') {
    return (
      <DeviceLimitScreen
        remoteLabel={remoteLabel}
        onTakeover={async () => {
          await takeover();
          await refreshSub();
        }}
        onSignOut={handleSignOut}
      />
    );
  }

  if (authEnabled && deviceStatus === 'error') {
    return <ConfigMissingScreen message="Cihaz doğrulaması yapılamadı. İnternet bağlantısını kontrol edin." />;
  }

  if (subscriptionsEnabled && subStatus === 'checking') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (subscriptionsEnabled && subStatus === 'offline_blocked') {
    return <OfflineLockScreen lastVerifiedAt={lastVerifiedAt} onRetry={refreshSub} />;
  }

  if (subscriptionsEnabled && subStatus === 'inactive') {
    return <PaywallScreen onPurchased={refreshSub} onSignOut={handleSignOut} />;
  }

  if (screen === 'list') {
    return (
      <ListScreen
        refreshKey={listRefreshKey}
        onNewForm={() => {
          setEditingVisit(null);
          setScreen('form');
        }}
        onNewMeds={(coopName) => { setMedsCoopName(coopName); setScreen('meds'); }}
        onEdit={visit => {
          setEditingVisit(visit);
          setScreen('form');
        }}
        onOpenKesim={() => setScreen('kesim')}
        onOpenBreeder={() => setScreen('breeder')}
      />
    );
  }

  if (screen === 'kesim') {
    return <KesimScreen onBack={() => setScreen('list')} />;
  }

  if (screen === 'meds') {
    return (
      <MedsScreen
        initialCoopName={medsCoopName}
        onBack={() => {
          setMedsCoopName(undefined);
          setListRefreshKey(key => key + 1);
          setScreen('list');
        }}
        onSaved={() => setListRefreshKey(key => key + 1)}
      />
    );
  }

  if (screen === 'breeder') {
    return (
      <BreederAgeScreen
        onBack={() => setScreen('list')}
        onSaved={() => setListRefreshKey(key => key + 1)}
      />
    );
  }

  return (
    <FormScreen
      initialVisit={editingVisit || undefined}
      onCancel={() => {
        setEditingVisit(null);
        setListRefreshKey(key => key + 1);
        setScreen('list');
      }}
      onSaved={() => {
        setEditingVisit(null);
        setListRefreshKey(key => key + 1);
        setScreen('list');
      }}
    />
  );
}





