import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { initDb } from './src/db';
import { Visit } from './src/models';
import ListScreen from './src/screens/ListScreen';
import FormScreen from './src/screens/FormScreen';
import KesimScreen from './src/screens/KesimScreen';

export default function App() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<'list' | 'form' | 'kesim'>('list');
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);

  useEffect(() => {
    initDb().then(() => setReady(true)).catch(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (screen === 'list') {
    return (
      <ListScreen
        onNew={() => {
          setEditingVisit(null);
          setScreen('form');
        }}
        onEdit={visit => {
          setEditingVisit(visit);
          setScreen('form');
        }}
        onOpenKesim={() => setScreen('kesim')}
      />
    );
  }

  if (screen === 'kesim') {
    return <KesimScreen onBack={() => setScreen('list')} />;
  }

  return (
    <FormScreen
      initialVisit={editingVisit || undefined}
      onCancel={() => {
        setEditingVisit(null);
        setScreen('list');
      }}
      onSaved={() => {
        setEditingVisit(null);
        setScreen('list');
      }}
    />
  );
}
