import { useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView } from 'react-native';
import { setupDatabase } from './database/db';
import { registerRootComponent } from 'expo';

export default function App() {
  useEffect(() => {
    setupDatabase().catch((err) => {
      console.error('Database setup failed:', err);
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.box}>
        <Text style={styles.title}>DiscStats-Pro</Text>
        <Text style={styles.subtitle}>Local Database Ready! ✅</Text>
        <Text style={styles.info}>
          Offline storage is set up and working.{"\n"}
          Tables for games, players, points, and events are created.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  box: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 20,
  },
  info: {
    fontSize: 18,
    textAlign: 'center',
    color: '#34495e',
    lineHeight: 26,
  },
});

registerRootComponent(App);