import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getDB } from '../../../database/db';

type Game = {
  id: number;
  teamName: string;
  opponentName: string;
  teamSize: number;
  genderRule: string;
};

type Point = {
  id: number;
};

type Event = {
  id: number;
  eventType: string;
  timestamp: string;
};

export default function PointTrackingScreen() {
  const { gameId, pointNumber } = useLocalSearchParams<{ gameId: string; pointNumber: string }>();
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [possession, setPossession] = useState<'our' | 'opponent'>('our');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const db = await getDB();

      const gameResult = await db.getFirstAsync<Game>('SELECT * FROM games WHERE id = ?', [gameId]);
      setGame(gameResult);

      const pointResult = await db.getFirstAsync<Point>(
        'SELECT id FROM points WHERE gameId = ? AND pointNumber = ?',
        [gameId, pointNumber]
      );

      if (pointResult) {
        const eventsResult = await db.getAllAsync<Event>(
          'SELECT * FROM events WHERE pointId = ? ORDER BY timestamp',
          [pointResult.id]
        );
        setEvents(eventsResult);

        if (eventsResult.length > 0) {
          const lastEvent = eventsResult[eventsResult.length - 1];
          if (lastEvent.eventType === 'turnover') {
            setPossession(possession === 'our' ? 'opponent' : 'our');
          } else if (lastEvent.eventType === 'goal') {
            setPossession('opponent');
          }
        }
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load point.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [gameId, pointNumber]);

  const createPointIfNeeded = async () => {
    const db = await getDB();
    const pointResult = await db.getFirstAsync<Point>(
      'SELECT id FROM points WHERE gameId = ? AND pointNumber = ?',
      [gameId, pointNumber]
    );
    if (!pointResult) {
      await db.runAsync(
        'INSERT INTO points (gameId, pointNumber, ourScoreAfter, opponentScoreAfter, startingOLine) VALUES (?, ?, 0, 0, ?)',
        [gameId, pointNumber, possession === 'our']
      );
    }
  };

  const addEvent = async (eventType: string) => {
    try {
      await createPointIfNeeded();
      const db = await getDB();
      const pointResult = await db.getFirstAsync<Point>(
        'SELECT id FROM points WHERE gameId = ? AND pointNumber = ?',
        [gameId, pointNumber]
      );

      if (!pointResult) return;

      await db.runAsync(
        'INSERT INTO events (pointId, eventType, timestamp) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [pointResult.id, eventType]
      );

      if (eventType === 'turnover') {
        setPossession(possession === 'our' ? 'opponent' : 'our');
      } else if (eventType === 'goal') {
        setPossession('opponent');
      }

      await loadData();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to record event.');
    }
  };

  const undoLastEvent = async () => {
    if (events.length === 0) {
      Alert.alert('Nothing to undo', 'No events recorded yet.');
      return;
    }

    Alert.alert(
      'Undo Last Event',
      'Remove the last recorded event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDB();
              const lastEvent = events[events.length - 1];
              await db.runAsync('DELETE FROM events WHERE id = ?', [lastEvent.id]);
              await loadData();
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Failed to undo.');
            }
          },
        },
      ]
    );
  };

  if (loading || !game) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading point...</Text>
      </View>
    );
  }

  const currentPossession = possession === 'our' ? game.teamName : game.opponentName;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Point {pointNumber}</Text>
        <Text style={styles.possession}>
          {currentPossession} has the disc
        </Text>
      </View>

      <View style={styles.buttonGrid}>
        <TouchableOpacity style={styles.eventButton} onPress={() => addEvent('goal')}>
          <FontAwesome name="flag-checkered" size={40} color="#fff" />
          <Text style={styles.buttonText}>Goal</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.eventButton} onPress={() => addEvent('turnover')}>
          <FontAwesome name="exchange" size={40} color="#fff" />
          <Text style={styles.buttonText}>Turnover</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.eventButton} onPress={() => addEvent('d')}>
          <FontAwesome name="shield" size={40} color="#fff" />
          <Text style={styles.buttonText}>D</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.eventButton} onPress={() => addEvent('drop')}>
          <FontAwesome name="arrow-down" size={40} color="#fff" />
          <Text style={styles.buttonText}>Drop</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.eventButton} onPress={() => addEvent('callahan')}>
          <FontAwesome name="star" size={40} color="#fff" />
          <Text style={styles.buttonText}>Callahan</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.undoButton} onPress={undoLastEvent}>
          <FontAwesome name="undo" size={30} color="#fff" />
          <Text style={styles.buttonText}>Undo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.eventsList}>
        <Text style={styles.eventsTitle}>Events This Point</Text>
        <ScrollView style={styles.eventsScroll}>
          {events.length === 0 ? (
            <Text style={styles.emptyEvents}>No events recorded yet</Text>
          ) : (
            events.map((event, index) => (
              <View key={event.id} style={styles.eventItem}>
                <Text style={styles.eventNumber}>{index + 1}</Text>
                <Text style={styles.eventType}>{event.eventType.toUpperCase()}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  possession: {
    fontSize: 20,
    color: '#27ae60',
    marginTop: 10,
    fontWeight: '600',
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 20,
  },
  eventButton: {
    backgroundColor: '#27ae60',
    width: 100,
    height: 100,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 10,
    elevation: 5,
  },
  undoButton: {
    backgroundColor: '#e74c3c',
    width: 100,
    height: 100,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 10,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  eventsList: {
    flex: 1,
    padding: 20,
  },
  eventsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  eventsScroll: {
    flex: 1,
  },
  emptyEvents: {
    fontSize: 18,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 20,
  },
  eventItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 2,
  },
  eventNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27ae60',
    marginRight: 10,
  },
  eventType: {
    fontSize: 16,
    color: '#2c3e50',
    flex: 1,
  },
  loading: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
    color: '#7f8c8d',
  },
});