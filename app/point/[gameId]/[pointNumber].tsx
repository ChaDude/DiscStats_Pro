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
  genderRule: string;
  teamSize: number;
};

type Player = {
  id: number;
  name: string;
  number: number | null;
  gender: string;
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
  const [roster, setRoster] = useState<Player[]>([]);
  const [line, setLine] = useState<number[]>([]); // Player IDs on the field
  const [events, setEvents] = useState<Event[]>([]);
  const [possession, setPossession] = useState<'our' | 'opponent'>('our');
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [lineSelectionModalVisible, setLineSelectionModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const db = await getDB();

      // Load game
      const gameResult = await db.getFirstAsync<Game>(
        'SELECT id, teamName, opponentName, teamId, genderRule FROM games WHERE id = ?',
        [gameId]
      );
      setGame(gameResult);

      // Load roster
      if (gameResult?.teamId) {
        const playersResult = await db.getAllAsync<Player>(
          `SELECT p.id, p.name, p.number, p.gender
           FROM players p
           JOIN team_players tp ON p.id = tp.playerId
           WHERE tp.teamId = ?
           ORDER BY p.name`,
          [gameResult.teamId]
        );
        setRoster(playersResult);
      }

      // Load point and events
      const pointResult = await db.getFirstAsync<{ id: number; linePlayers: string | null }>(
        'SELECT id, linePlayers FROM points WHERE gameId = ? AND pointNumber = ?',
        [gameId, pointNumber]
      );

      if (pointResult) {
        const eventsResult = await db.getAllAsync<Event>(
          'SELECT * FROM events WHERE pointId = ? ORDER BY timestamp',
          [pointResult.id]
        );
        setEvents(eventsResult);

        // Load line if set
        if (pointResult.linePlayers) {
          setLine(JSON.parse(pointResult.linePlayers));
        } else {
          setLineSelectionModalVisible(true); // Open line selection if not set
        }
      } else {
        setLineSelectionModalVisible(true); // Open line selection for new point
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

  const saveLine = async (newLine: number[]) => {
    try {
      const db = await getDB();

      await createPointIfNeeded();

      await db.runAsync(
        'UPDATE points SET linePlayers = ? WHERE gameId = ? AND pointNumber = ?',
        [JSON.stringify(newLine), gameId, pointNumber]
      );

      setLine(newLine);
      setLineSelectionModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to save line.');
    }
  };

  const togglePlayerInLine = (playerId: number) => {
    if (line.includes(playerId)) {
      setLine(line.filter(id => id !== playerId));
    } else if (line.length < (game?.teamSize || 7)) {
      setLine([...line, playerId]);
    } else {
      Alert.alert('Line Full', 'Maximum players on field reached.');
    }
  };

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

  const addEvent = async (eventType: string) => {
    if (selectedPlayerId === null) {
      Alert.alert('Select Player', 'Please select a player first.');
      return;
    }

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

      if (eventType === 'throwaway' || eventType === 'drop') {
        throwerId = selectedPlayerId;
      } else if (eventType === 'goal') {
        receiverId = selectedPlayerId;
      } else if (eventType === 'd') {
        defenderId = selectedPlayerId;
      } else if (eventType === 'callahan') {
        defenderId = selectedPlayerId;
        receiverId = selectedPlayerId;
      } else {
        throwerId = selectedPlayerId; // Default for other events
      }

      await db.runAsync(
        'INSERT INTO events (pointId, eventType, throwerId, receiverId, defenderId, timestamp) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [pointResult.id, eventType, throwerId, receiverId, defenderId]
      );

      if (eventType === 'throwaway' || eventType === 'drop') {
        setPossession(possession === 'our' ? 'opponent' : 'our');
      } else if (eventType === 'goal') {
        setPossession('opponent');
      }

      setSelectedPlayerId(null); // Reset selection
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

      <View style={styles.lineSection}>
        <Text style={styles.sectionTitle}>Players on Field ({line.length}/ {game.teamSize})</Text>
        <ScrollView horizontal>
          {line.map((playerId) => {
            const player = roster.find(p => p.id === playerId);
            if (!player) return null;
            return (
              <TouchableOpacity
                key={playerId}
                style={[
                  styles.playerButton,
                  selectedPlayerId === playerId && styles.playerButtonSelected,
                ]}
                onPress={() => setSelectedPlayerId(selectedPlayerId === playerId ? null : playerId)}
              >
                <Text style={styles.playerButtonText}>{player.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity style={styles.editLineButton} onPress={() => setLineSelectionModalVisible(true)}>
          <FontAwesome name="edit" size={24} color="#27ae60" />
          <Text style={styles.editLineText}>Edit Line</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonGrid}>
        <TouchableOpacity style={styles.eventButton} onPress={() => addEvent('goal')}>
          <FontAwesome name="flag-checkered" size={40} color="#fff" />
          <Text style={styles.buttonText}>Goal</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.eventButton} onPress={() => addEvent('throwaway')}>
          <FontAwesome name="exclamation-triangle" size={40} color="#fff" />
          <Text style={styles.buttonText}>Throwaway</Text>
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
        <ScrollView>
          {events.length === 0 ? (
            <Text style={styles.emptyEvents}>No events recorded yet</Text>
          ) : (
            events.map((event, index) => (
              <Text key={event.id} style={styles.eventItem}>
                {index + 1}. {event.eventType.toUpperCase()}
                {event.throwerId ? ` (Thrower: ${roster.find(p => p.id === event.throwerId)?.name || '???'})` : ''}
                {event.receiverId ? ` (Receiver: ${roster.find(p => p.id === event.receiverId)?.name || '???'})` : ''}
                {event.defenderId ? ` (Defender: ${roster.find(p => p.id === event.defenderId)?.name || '???'})` : ''}
              </Text>
            ))
          )}
        </ScrollView>
      </View>

      {/* Line Selection Modal */}
      <Modal visible={lineSelectionModalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Select Line ({line.length}/ {game.teamSize})</Text>
          <ScrollView>
            {roster.map((player) => (
              <TouchableOpacity
                key={player.id}
                style={[
                  styles.playerOption,
                  line.includes(player.id) && styles.playerOptionSelected,
                ]}
                onPress={() => togglePlayerInLine(player.id)}
              >
                <Text style={styles.playerName}>
                  {player.name} {player.number ? `#${player.number}` : ''} ({player.gender.toUpperCase()})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.saveLineButton} onPress={() => saveLine(line)}>
            <Text style={styles.saveLineText}>Save Line</Text>
          </TouchableOpacity>
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
  lineSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  playerButton: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginRight: 10,
    elevation: 2,
  },
  playerButtonSelected: {
    backgroundColor: '#27ae60',
  },
  playerButtonText: {
    color: '#2c3e50',
    fontWeight: 'bold',
  },
  editLineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  editLineText: {
    fontSize: 16,
    color: '#27ae60',
    marginLeft: 8,
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
  },
  playerOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  playerOptionSelected: {
    backgroundColor: '#27ae60',
  },
  playerName: {
    fontSize: 18,
    color: '#2c3e50',
  },
  saveLineButton: {
    backgroundColor: '#27ae60',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveLineText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});