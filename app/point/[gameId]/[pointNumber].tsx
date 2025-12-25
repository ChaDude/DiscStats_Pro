import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Modal } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getDB } from '../../../database/db';

type Game = {
  id: number;
  teamName: string;
  opponentName: string;
  teamId: number | null;
};

type Player = {
  id: number;
  name: string;
  number: number | null;
};

type Event = {
  id: number;
  eventType: string;
  throwerId: number | null;
  receiverId: number | null;
  defenderId: number | null;
  timestamp: string;
};

export default function PointTrackingScreen() {
  const { gameId, pointNumber } = useLocalSearchParams<{ gameId: string; pointNumber: string }>();
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [possession, setPossession] = useState<'our' | 'opponent'>('our');
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [currentEventType, setCurrentEventType] = useState<string>('');

  const loadData = async () => {
    try {
      const db = await getDB();

      // Load game with teamId
      const gameResult = await db.getFirstAsync<Game>(
        'SELECT id, teamName, opponentName, teamId FROM games WHERE id = ?',
        [gameId]
      );
      setGame(gameResult);

      // Load players from the game's team
      if (gameResult?.teamId) {
        const playersResult = await db.getAllAsync<Player>(
          `SELECT p.id, p.name, p.number
           FROM players p
           JOIN team_players tp ON p.id = tp.playerId
           WHERE tp.teamId = ?
           ORDER BY p.name`,
          [gameResult.teamId]
        );
        setPlayers(playersResult);
      } else {
        setPlayers([]);
      }

      // Load point events
      const pointResult = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM points WHERE gameId = ? AND pointNumber = ?',
        [gameId, pointNumber]
      );

      if (pointResult) {
        const eventsResult = await db.getAllAsync<Event>(
          'SELECT * FROM events WHERE pointId = ? ORDER BY timestamp',
          [pointResult.id]
        );
        setEvents(eventsResult);
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
    const pointResult = await db.getFirstAsync('SELECT id FROM points WHERE gameId = ? AND pointNumber = ?', [gameId, pointNumber]);
    if (!pointResult) {
      await db.runAsync(
        'INSERT INTO points (gameId, pointNumber, ourScoreAfter, opponentScoreAfter, startingOLine) VALUES (?, ?, 0, 0, ?)',
        [gameId, pointNumber, possession === 'our']
      );
    }
  };

  const openPlayerModal = (eventType: string) => {
    if (players.length === 0) {
      Alert.alert('No Players', 'Add players to your team roster in the Teams tab.');
      return;
    }
    setCurrentEventType(eventType);
    setModalVisible(true);
  };

  const selectPlayer = async (playerId: number) => {
    setModalVisible(false);

    try {
      await createPointIfNeeded();
      const db = await getDB();
      const pointResult = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM points WHERE gameId = ? AND pointNumber = ?',
        [gameId, pointNumber]
      );

      if (!pointResult) return;

      let throwerId = null;
      let receiverId = null;
      let defenderId = null;

      if (currentEventType === 'goal' || currentEventType === 'turnover' || currentEventType === 'drop') {
        throwerId = playerId;
      } else if (currentEventType === 'd') {
        defenderId = playerId;
      } else if (currentEventType === 'callahan') {
        defenderId = playerId;
        receiverId = playerId;
      }

      await db.runAsync(
        'INSERT INTO events (pointId, eventType, throwerId, receiverId, defenderId, timestamp) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [pointResult.id, currentEventType, throwerId, receiverId, defenderId]
      );

      if (currentEventType === 'turnover') {
        setPossession(possession === 'our' ? 'opponent' : 'our');
      } else if (currentEventType === 'goal') {
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
        <Text style={styles.possession}>{currentPossession} has the disc</Text>
      </View>

      <View style={styles.buttonGrid}>
        <TouchableOpacity style={styles.eventButton} onPress={() => openPlayerModal('goal')}>
          <FontAwesome name="flag-checkered" size={40} color="#fff" />
          <Text style={styles.buttonText}>Goal</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.eventButton} onPress={() => openPlayerModal('turnover')}>
          <FontAwesome name="exchange" size={40} color="#fff" />
          <Text style={styles.buttonText}>Turnover</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.eventButton} onPress={() => openPlayerModal('d')}>
          <FontAwesome name="shield" size={40} color="#fff" />
          <Text style={styles.buttonText}>D</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.eventButton} onPress={() => openPlayerModal('drop')}>
          <FontAwesome name="arrow-down" size={40} color="#fff" />
          <Text style={styles.buttonText}>Drop</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.eventButton} onPress={() => openPlayerModal('callahan')}>
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
        <ScrollView>
          {events.length === 0 ? (
            <Text style={styles.emptyEvents}>No events recorded yet</Text>
          ) : (
            events.map((event, index) => (
              <Text key={event.id} style={styles.eventItem}>
                {index + 1}. {event.eventType.toUpperCase()}
                {event.throwerId ? ` (Thrower: ${players.find(p => p.id === event.throwerId)?.name || '???'})` : ''}
                {event.receiverId ? ` (Receiver: ${players.find(p => p.id === event.receiverId)?.name || '???'})` : ''}
                {event.defenderId ? ` (Defender: ${players.find(p => p.id === event.defenderId)?.name || '???'})` : ''}
              </Text>
            ))
          )}
        </ScrollView>
      </View>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Player - {currentEventType.toUpperCase()}</Text>
            <ScrollView>
              {players.map((player) => (
                <TouchableOpacity
                  key={player.id}
                  style={styles.playerOption}
                  onPress={() => selectPlayer(player.id)}
                >
                  <Text style={styles.playerName}>
                    {player.name} {player.number ? `#${player.number}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  emptyEvents: {
    fontSize: 18,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 20,
  },
  eventItem: {
    fontSize: 16,
    color: '#34495e',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  loading: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
    color: '#7f8c8d',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 20,
  },
  playerOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  playerName: {
    fontSize: 18,
    color: '#34495e',
    textAlign: 'center',
  },
  modalClose: {
    marginTop: 20,
    paddingVertical: 12,
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});