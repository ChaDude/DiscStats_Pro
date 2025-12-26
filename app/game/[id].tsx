import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { getDB } from '../../database/db';

type Game = {
  id: number;
  name: string;
  date: string;
  teamName: string;
  opponentName: string;
  teamSize: number;
  genderRule: string;
};

type Point = {
  id: number;
  pointNumber: number;
  ourScoreAfter: number;
  opponentScoreAfter: number;
  genderRatio: string;
  linePlayers: string; // JSON string
};

export default function GameDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const [game, setGame] = useState<Game | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  const safeId = Array.isArray(id) ? id[0] : id;

  const loadData = async () => {
    try {
      const db = await getDB();
      const gameResult = await db.getFirstAsync<Game>('SELECT * FROM games WHERE id = ?', [safeId]);
      setGame(gameResult);

      if (gameResult) {
        const pointsResult = await db.getAllAsync<Point>(
          'SELECT * FROM points WHERE gameId = ? ORDER BY pointNumber DESC',
          [safeId]
        );
        setPoints(pointsResult);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load game details.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [safeId])
  );

  const handleStartPoint = () => {
    if (!game) return;
    const nextPointNum = points.length > 0 ? points[0].pointNumber + 1 : 1;
    router.push(`/point/${game.id}/${nextPointNum}`);
  };

  // Helper to detect if Actual Line != Target Ratio
  const getRatioMismatch = (point: Point) => {
      if (game?.genderRule === 'none') return null;
      if (!point.linePlayers || !point.genderRatio) return null;

      // 1. Parse Target from string (e.g., "4m3f")
      const mMatch = point.genderRatio.match(/(\d+)m/);
      const fMatch = point.genderRatio.match(/(\d+)f/);
      const targetM = mMatch ? parseInt(mMatch[1]) : 0;
      const targetF = fMatch ? parseInt(fMatch[1]) : 0;

      // 2. Parse Actual from Line JSON
      try {
          const line = JSON.parse(point.linePlayers);
          let actualM = 0;
          let actualF = 0;
          // Calculate counts based on the role saved in the line
          // @ts-ignore
          line.forEach(p => p.role === 'male' ? actualM++ : actualF++);

          // 3. Compare
          if (actualM !== targetM || actualF !== targetF) {
              return `Ratio Mismatch: Played ${actualM}M/${actualF}F`;
          }
      } catch (e) {
          return null; 
      }
      return null;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#27ae60" />
      </View>
    );
  }

  if (!game) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Game not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: game.name }} />
      
      <View style={styles.headerCard}>
        <Text style={styles.scoreTitle}>
          {game.teamName} vs {game.opponentName}
        </Text>
        <Text style={styles.scoreMain}>
          {points.length > 0 ? points[0].ourScoreAfter : 0} - {points.length > 0 ? points[0].opponentScoreAfter : 0}
        </Text>
        <TouchableOpacity style={styles.startBtn} onPress={handleStartPoint}>
          <FontAwesome name="play" size={20} color="#fff" style={{ marginRight: 10 }} />
          <Text style={styles.startBtnText}>Start Point {points.length + 1}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.pointsList}>
        <Text style={styles.historyTitle}>Point History</Text>
        {points.map((point) => {
            const mismatch = getRatioMismatch(point);
            return (
              <TouchableOpacity
                key={point.id}
                style={styles.pointCard}
                onPress={() => router.push(`/point/${game.id}/${point.pointNumber}`)}
              >
                <View style={styles.pointRow}>
                  <View style={styles.pointInfo}>
                    <Text style={styles.pointNum}>Point {point.pointNumber}</Text>
                    <Text style={styles.pointRatio}>Target Ratio: {point.genderRatio}</Text>
                    
                    {/* Render Warning if Mismatch Detected */}
                    {mismatch && (
                        <View style={styles.warningTag}>
                            <FontAwesome name="exclamation-triangle" size={12} color="#d35400" />
                            <Text style={styles.warningText}>{mismatch}</Text>
                        </View>
                    )}
                  </View>
                  <View style={styles.pointScore}>
                    <Text style={styles.scoreText}>
                      {point.ourScoreAfter} - {point.opponentScoreAfter}
                    </Text>
                  </View>
                  <FontAwesome name="chevron-right" size={16} color="#bdc3c7" />
                </View>
              </TouchableOpacity>
            );
        })}
        {points.length === 0 && (
            <Text style={styles.noPoints}>No points recorded yet.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 18, color: '#e74c3c', marginBottom: 20 },
  backBtn: { padding: 10, backgroundColor: '#34495e', borderRadius: 8 },
  backBtnText: { color: '#fff', fontWeight: 'bold' },
  headerCard: { backgroundColor: '#fff', padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee', elevation: 4 },
  scoreTitle: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50' },
  scoreMain: { fontSize: 48, fontWeight: 'bold', color: '#27ae60', marginVertical: 10 },
  startBtn: { flexDirection: 'row', backgroundColor: '#27ae60', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 30, alignItems: 'center', marginTop: 10, elevation: 4 },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  pointsList: { flex: 1, padding: 15 },
  historyTitle: { fontSize: 18, fontWeight: 'bold', color: '#7f8c8d', marginBottom: 10, marginLeft: 5 },
  pointCard: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 10, elevation: 2 },
  pointRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pointInfo: { flex: 1 },
  pointNum: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50' },
  pointRatio: { fontSize: 14, color: '#7f8c8d', marginTop: 2 },
  pointScore: { paddingHorizontal: 15 },
  scoreText: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50' },
  noPoints: { textAlign: 'center', marginTop: 30, color: '#bdc3c7', fontSize: 16 },
  
  // NEW STYLES
  warningTag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fdebd0', // Light Orange bg
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      marginTop: 6,
      gap: 6
  },
  warningText: {
      color: '#d35400',
      fontSize: 12,
      fontWeight: 'bold'
  }
});