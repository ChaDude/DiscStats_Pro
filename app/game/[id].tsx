import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getDB } from '../../database/db';

type Game = {
  id: number;
  name: string;
  teamName: string;
  opponentName: string;
  teamSize: number;
  genderRule: string;
  date: string;
};

type Point = {
  id: number;
  pointNumber: number;
  ourScoreAfter: number;
  opponentScoreAfter: number;
  startingOLine: boolean;
};

export default function LiveGameScreen() {
  const params = useLocalSearchParams();
  const id = params.id as string; // Safe cast since it's a dynamic route
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGame = async () => {
    try {
      const db = await getDB();
      const gameResult = await db.getFirstAsync('SELECT * FROM games WHERE id = ?', [id]);
      const pointsResult = await db.getAllAsync(
        'SELECT * FROM points WHERE gameId = ? ORDER BY pointNumber',
        [id]
      );
      setGame(gameResult as Game);
      setPoints(pointsResult as Point[]);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load game.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGame();
  }, [id]);

  const currentPoint = points.length + 1;
  const ourScore = points.reduce((sum, p) => sum + (p.startingOLine ? 1 : 0), 0);
  const opponentScore = points.length - ourScore;

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Loading game...</Text>
      </View>
    );
  }

  if (!game) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Game not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.gameTitle}>{game.name}</Text>
        <Text style={styles.gameDate}>
          {new Date(game.date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
        <Text style={styles.gameInfo}>
          {game.teamSize}v{game.teamSize} • {game.genderRule !== 'none' ? game.genderRule.toUpperCase() : 'No ratio'}
        </Text>
      </View>

      <View style={styles.scoreboard}>
        <View style={styles.teamScore}>
          <Text style={styles.teamName}>{game.teamName}</Text>
          <Text style={styles.score}>{ourScore}</Text>
        </View>
        <Text style={styles.vs}>vs</Text>
        <View style={styles.teamScore}>
          <Text style={styles.teamName}>{game.opponentName}</Text>
          <Text style={styles.score}>{opponentScore}</Text>
        </View>
      </View>

      <View style={styles.currentPoint}>
        <Text style={styles.pointText}>Point {currentPoint}</Text>
        <Text style={styles.pointSub}>Ready to start tracking</Text>
      </View>

      <ScrollView style={styles.pointsList}>
        {points.length === 0 ? (
          <Text style={styles.emptyPoints}>No points played yet</Text>
        ) : (
          points.map((point) => (
            <View key={point.id} style={styles.pointItem}>
              <Text style={styles.pointNumber}>Point {point.pointNumber}</Text>
              <Text style={styles.pointScore}>
                {game.teamName} {point.ourScoreAfter} - {point.opponentScoreAfter} {game.opponentName}
              </Text>
              <Text style={styles.pointLine}>
                {point.startingOLine ? `${game.teamName} on O` : `${game.teamName} on D`}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.startPointButton}
        onPress={() => {
          Alert.alert('Coming Soon', 'Full point-by-point tracking screen with line management, events, and undo will be built next!');
        }}
      >
        <Text style={styles.startPointText}>Start Point {currentPoint}</Text>
      </TouchableOpacity>
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
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  gameTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  gameDate: {
    fontSize: 16,
    color: '#7f8c8d',
    marginTop: 8,
  },
  gameInfo: {
    fontSize: 16,
    color: '#34495e',
    marginTop: 4,
  },
  scoreboard: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#fff',
  },
  teamScore: {
    alignItems: 'center',
    flex: 1,
  },
  teamName: {
    fontSize: 20,
    color: '#2c3e50',
    marginBottom: 8,
  },
  score: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  vs: {
    fontSize: 24,
    color: '#7f8c8d',
    marginHorizontal: 20,
  },
  currentPoint: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    marginTop: 10,
  },
  pointText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  pointSub: {
    fontSize: 16,
    color: '#7f8c8d',
    marginTop: 8,
  },
  pointsList: {
    flex: 1,
    padding: 20,
  },
  emptyPoints: {
    fontSize: 18,
    textAlign: 'center',
    color: '#7f8c8d',
    marginTop: 50,
  },
  pointItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },
  pointNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  pointScore: {
    fontSize: 18,
    color: '#27ae60',
    marginTop: 4,
  },
  pointLine: {
    fontSize: 16,
    color: '#7f8c8d',
    marginTop: 4,
  },
  startPointButton: {
    backgroundColor: '#27ae60',
    margin: 20,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  startPointText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  text: {
    fontSize: 18,
    textAlign: 'center',
    color: '#34495e',
  },
});