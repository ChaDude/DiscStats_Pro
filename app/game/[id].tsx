import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { getDB } from '../../database/db';

type Game = {
  id: number;
  name: string;
  teamName: string;
  opponentName: string;
  teamSize: number;
  genderRule: string; // 'none', 'abba', 'offense', 'endzone'
};

type Point = {
  id: number;
  pointNumber: number;
  ourScoreAfter: number;
  opponentScoreAfter: number;
  startingOLine: boolean; // Did we start on O?
  genderRatio: string | null;
  eventsCount: number;
};

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [p1Ratio, setP1Ratio] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const db = await getDB();
      const gameResult = await db.getFirstAsync<Game>('SELECT * FROM games WHERE id = ?', [id]);
      setGame(gameResult);

      const pointsResult = await db.getAllAsync<Point>(
        `SELECT p.*, (SELECT COUNT(*) FROM events WHERE pointId = p.id) as eventsCount 
         FROM points p 
         WHERE gameId = ? 
         ORDER BY pointNumber DESC`,
        [id]
      );
      setPoints(pointsResult);

      // Get Point 1 ratio for ABBA check
      const p1 = pointsResult.find(p => p.pointNumber === 1);
      setP1Ratio(p1?.genderRatio || null);

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load game.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const getAbbaStatus = (point: Point) => {
      if (!game || game.genderRule !== 'abba' || !p1Ratio || !point.genderRatio) return null;
      
      const p1M = parseInt(p1Ratio.match(/(\d+)m/)?.[1] || '4');
      const teamSize = game.teamSize || 7;
      const isP1MaleHeavy = p1M > (teamSize/2);

      const cycle = Math.floor((point.pointNumber - 2) / 2) % 2; 
      const isSwap = cycle === 0; // 2,3,6,7 are swaps

      const expectedMaleHeavy = isSwap ? !isP1MaleHeavy : isP1MaleHeavy;

      // Current Point Status
      const currentM = parseInt(point.genderRatio.match(/(\d+)m/)?.[1] || '0');
      const currentMaleHeavy = currentM > (teamSize/2);

      if (currentMaleHeavy !== expectedMaleHeavy) {
          return { mismatch: true, expected: expectedMaleHeavy ? 'Male Heavy' : 'Female Heavy' };
      }
      return { mismatch: false };
  };

  const renderPoint = ({ item }: { item: Point }) => {
    const abbaStatus = getAbbaStatus(item);
    
    return (
      <TouchableOpacity 
        style={styles.pointCard}
        onPress={() => router.push(`/point/${game!.id}/${item.pointNumber}`)}
      >
        <View style={styles.pointHeader}>
          <Text style={styles.pointTitle}>Point {item.pointNumber}</Text>
          <View style={[styles.scoreBadge, item.ourScoreAfter > item.opponentScoreAfter ? styles.winning : styles.losing]}>
            <Text style={styles.scoreText}>
              {item.ourScoreAfter} - {item.opponentScoreAfter}
            </Text>
          </View>
        </View>

        <View style={styles.pointDetails}>
          <Text style={styles.detailText}>
            Start on {item.startingOLine ? 'Offense' : 'Defense'}
          </Text>
          <Text style={styles.detailText}>• {item.eventsCount} Events</Text>
          
          {/* Gender Ratio Badge */}
          {item.genderRatio && (
              <View style={[styles.ratioBadge, abbaStatus?.mismatch && styles.ratioMismatch]}>
                  <Text style={[styles.ratioText, abbaStatus?.mismatch && styles.ratioMismatchText]}>
                      {item.genderRatio}
                      {abbaStatus?.mismatch && " ⚠️"}
                  </Text>
              </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <ActivityIndicator size="large" color="#27ae60" style={{marginTop: 50}} />;
  if (!game) return <Text>Game not found.</Text>;

  return (
    <View style={styles.container}>
        <View style={styles.header}>
            <Text style={styles.gameTitle}>{game.name}</Text>
            <Text style={styles.subtitle}>
                {game.teamName} vs {game.opponentName}
            </Text>
        </View>

        <FlatList
            data={points}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderPoint}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
                <TouchableOpacity 
                    style={styles.nextPointBtn}
                    onPress={() => {
                        const nextPoint = points.length > 0 ? points[0].pointNumber + 1 : 1;
                        router.push(`/point/${game.id}/${nextPoint}`);
                    }}
                >
                    <Text style={styles.nextPointText}>Start Point {points.length > 0 ? points[0].pointNumber + 1 : 1}</Text>
                    <FontAwesome name="arrow-right" size={20} color="#fff" />
                </TouchableOpacity>
            }
        />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ddd' },
  gameTitle: { fontSize: 24, fontWeight: 'bold', color: '#2c3e50' },
  subtitle: { fontSize: 18, color: '#7f8c8d', marginTop: 4 },
  list: { padding: 20 },
  nextPointBtn: { backgroundColor: '#27ae60', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 4 },
  nextPointText: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginRight: 10 },
  pointCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 2 },
  pointHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pointTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50' },
  scoreBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: '#95a5a6' },
  winning: { backgroundColor: '#27ae60' },
  losing: { backgroundColor: '#e74c3c' },
  scoreText: { color: '#fff', fontWeight: 'bold' },
  pointDetails: { flexDirection: 'row', alignItems: 'center' },
  detailText: { color: '#7f8c8d', marginRight: 10 },
  ratioBadge: { backgroundColor: '#ecf0f1', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 'auto' },
  ratioText: { fontSize: 12, fontWeight: 'bold', color: '#7f8c8d' },
  ratioMismatch: { backgroundColor: '#f1c40f' },
  ratioMismatchText: { color: '#fff' }
});