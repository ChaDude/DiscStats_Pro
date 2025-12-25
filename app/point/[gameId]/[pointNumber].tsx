import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Modal } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import { getDB } from '../../../database/db';

type Game = {
  id: number;
  teamName: string;
  opponentName: string;
  teamId: number | null;
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
  const [line, setLine] = useState<number[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [ourScore, setOurScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [possession, setPossession] = useState<'our' | 'opponent'>('our');
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [lineModalVisible, setLineModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef<ScrollView>(null);

  const loadData = async () => {
    try {
      const db = await getDB();

      const gameResult = await db.getFirstAsync<Game>(
        'SELECT id, teamName, opponentName, teamId, teamSize FROM games WHERE id = ?',
        [gameId]
      );
      setGame(gameResult);

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

        let our = 0;
        eventsResult.forEach((e) => {
          if (e.eventType === 'goal') our++;
        });
        setOurScore(our);

        if (pointResult.linePlayers) {
          setLine(JSON.parse(pointResult.linePlayers));
        } else {
          setLineModalVisible(true);
        }
      } else {
        setLineModalVisible(true);
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

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [events]);

  const createPointIfNeeded = async () => {
    const db = await getDB();
    const pointResult = await db.getFirstAsync('SELECT id FROM points WHERE gameId = ? AND pointNumber = ?', [gameId, pointNumber]);
    if (!pointResult) {
      await db.runAsync(
        'INSERT INTO points (gameId, pointNumber, ourScoreAfter, opponentScoreAfter, startingOLine, linePlayers) VALUES (?, ?, 0, 0, ?, ?)',
        [gameId, pointNumber, possession === 'our', JSON.stringify(line)]
      );
    }
  };

  const saveLine = async (newLine: number[]) => {
    try {
      await createPointIfNeeded();
      const db = await getDB();
      await db.runAsync(
        'UPDATE points SET linePlayers = ? WHERE gameId = ? AND pointNumber = ?',
        [JSON.stringify(newLine), gameId, pointNumber]
      );
      setLine(newLine);
      setLineModalVisible(false);
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
      Alert.alert('Line Full', `Maximum ${game?.teamSize || 7} players allowed.`);
    }
  };

  const recordEvent = async (eventType: string) => {
    if (!selectedPlayerId) {
      Alert.alert('Select Player', 'Tap a player button first.');
      return;
    }

    if (!line.includes(selectedPlayerId)) {
      Alert.alert('Not on Field', 'Selected player is not in the current line.');
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

      switch (eventType) {
        case 'goal':
          receiverId = selectedPlayerId;
          setOurScore(ourScore + 1);
          setPossession('opponent');
          break;
        case 'throwaway':
        case 'drop':
          throwerId = selectedPlayerId;
          setPossession(possession === 'our' ? 'opponent' : 'our');
          break;
        case 'd':
          defenderId = selectedPlayerId;
          setPossession(possession === 'our' ? 'opponent' : 'our');
          break;
        case 'callahan':
          defenderId = selectedPlayerId;
          receiverId = selectedPlayerId;
          setOurScore(ourScore + 1);
          setPossession('opponent');
          break;
      }

      await db.runAsync(
        'INSERT INTO events (pointId, eventType, throwerId, receiverId, defenderId, timestamp) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [pointResult.id, eventType, throwerId, receiverId, defenderId]
      );

      setSelectedPlayerId(null);
      await loadData();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to record event.');
    }
  };

  const undoLastEvent = async () => {
    if (events.length === 0) return;

    Alert.alert(
      'Undo',
      'Remove the last event?',
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
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  const currentPossession = possession === 'our' ? game.teamName : game.opponentName;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pointTitle}>Point {pointNumber}</Text>
        <Text style={styles.scoreText}>
          {game.teamName} {ourScore} - {opponentScore} {game.opponentName}
        </Text>
        <Text style={styles.possessionText}>{currentPossession} has the disc</Text>
      </View>

      {/* Player Grid */}
      <View style={styles.lineGridSection}>
        <View style={styles.lineHeader}>
          <Text style={styles.lineTitle}>Line ({line.length}/{game.teamSize})</Text>
          <TouchableOpacity onPress={() => setLineModalVisible(true)}>
            <FontAwesome name="edit" size={20} color="#27ae60" />
          </TouchableOpacity>
        </View>
        <View style={styles.lineGrid}>
          {Array.from({ length: 8 }).map((_, index) => {
            const playerId = line[index];
            if (!playerId) {
              return <View key={`empty-${index}`} style={styles.linePlayerEmpty} />;
            }
            const player = roster.find(p => p.id === playerId);
            if (!player) return <View key={`empty-${index}`} style={styles.linePlayerEmpty} />;
            return (
              <TouchableOpacity
                key={playerId}
                style={[
                  styles.linePlayerButton,
                  selectedPlayerId === playerId && styles.linePlayerSelected,
                ]}
                onPress={() => setSelectedPlayerId(selectedPlayerId === playerId ? null : playerId)}
              >
                <Text style={styles.linePlayerName} numberOfLines={1} adjustsFontSizeToFit>
                  {player.name}
                </Text>
                {player.number && (
                  <Text style={styles.linePlayerNumber}>#{player.number}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Event Buttons */}
      <View style={styles.eventGridSection}>
        <View style={styles.eventGrid}>
          <TouchableOpacity style={styles.eventBtn} onPress={() => recordEvent('goal')}>
            <FontAwesome name="flag-checkered" size={36} color="#fff" />
            <Text style={styles.eventText}>Goal</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.eventBtn} onPress={() => recordEvent('throwaway')}>
            <FontAwesome name="exclamation-triangle" size={36} color="#fff" />
            <Text style={styles.eventText}>Throwaway</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.eventBtn} onPress={() => recordEvent('drop')}>
            <FontAwesome name="arrow-down" size={36} color="#fff" />
            <Text style={styles.eventText}>Drop</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.eventBtn} onPress={() => recordEvent('d')}>
            <FontAwesome name="shield" size={36} color="#fff" />
            <Text style={styles.eventText}>D</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.eventBtn} onPress={() => recordEvent('callahan')}>
            <FontAwesome name="star" size={36} color="#fff" />
            <Text style={styles.eventText}>Callahan</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.eventBtn, styles.undoBtn]} onPress={undoLastEvent}>
            <FontAwesome name="undo" size={36} color="#fff" />
            <Text style={styles.eventText}>Undo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Events Log */}
      <View style={styles.eventsSection}>
        <Text style={styles.eventsTitle}>Events ({events.length})</Text>
        <ScrollView
          ref={scrollRef}
          style={styles.eventsScroll}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {events.length === 0 ? (
            <Text style={styles.emptyEvents}>No events yet</Text>
          ) : (
            events.map((event, index) => {
              const thrower = roster.find(p => p.id === event.throwerId);
              const receiver = roster.find(p => p.id === event.receiverId);
              const defender = roster.find(p => p.id === event.defenderId);

              return (
                <Text key={event.id} style={styles.eventItem}>
                  {index + 1}. {event.eventType.toUpperCase()}
                  {thrower ? ` — ${thrower.name}` : ''}
                  {receiver ? ` → ${receiver.name}` : ''}
                  {defender ? ` (D by ${defender.name})` : ''}
                </Text>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Line Selection Modal */}
      <Modal visible={lineModalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Select Line ({line.length}/{game.teamSize})</Text>
          <ScrollView contentContainerStyle={styles.rosterGrid}>
            {roster.map((player) => (
              <TouchableOpacity
                key={player.id}
                style={[
                  styles.rosterPlayer,
                  line.includes(player.id) && styles.rosterPlayerSelected,
                ]}
                onPress={() => togglePlayerInLine(player.id)}
              >
                <Text style={styles.rosterPlayerName}>
                  {player.name} {player.number ? `#${player.number}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[
              styles.saveLineBtn,
              line.length !== game.teamSize && styles.saveLineBtnDisabled,
            ]}
            onPress={() => saveLine(line)}
            disabled={line.length !== game.teamSize}
          >
            <Text style={styles.saveLineText}>
              Save Line ({line.length}/{game.teamSize})
            </Text>
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
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  pointTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  scoreText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#27ae60',
    marginVertical: 6,
  },
  possessionText: {
    fontSize: 16,
    color: '#27ae60',
    fontWeight: '600',
  },
  lineGridSection: {
    flex: 0.38,
    padding: 15,
    backgroundColor: '#fff',
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  lineTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  lineGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linePlayerButton: {
    backgroundColor: '#f0f0f0',
    width: '23%',
    aspectRatio: 1,
    margin: '1%',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  linePlayerSelected: {
    backgroundColor: '#27ae60',
  },
  linePlayerName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
  },
  linePlayerNumber: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
  },
  linePlayerEmpty: {
    width: '23%',
    aspectRatio: 1,
    margin: '1%',
  },
  eventGridSection: {
    flex: 0.37,
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
  },
  eventGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  eventBtn: {
    backgroundColor: '#27ae60',
    width: 100,
    height: 100,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
    elevation: 5,
  },
  undoBtn: {
    backgroundColor: '#e74c3c',
  },
  eventText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 6,
    textAlign: 'center',
  },
  eventsSection: {
    flex: 0.25,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: '#fff',
  },
  eventsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  eventsScroll: {
    flex: 1,
  },
  emptyEvents: {
    fontSize: 16,
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
    textAlign: 'center',
    marginVertical: 20,
  },
  rosterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  rosterPlayer: {
    backgroundColor: '#fff',
    width: '45%',
    padding: 16,
    margin: 8,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
  },
  rosterPlayerSelected: {
    backgroundColor: '#27ae60',
  },
  rosterPlayerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
  },
  saveLineBtn: {
    backgroundColor: '#27ae60',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveLineBtnDisabled: {
    backgroundColor: '#95a5a6',
  },
  saveLineText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});