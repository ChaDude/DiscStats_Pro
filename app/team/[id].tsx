import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { getDB } from '../../database/db';

type Team = {
  id: number;
  name: string;
};

type Player = {
  id: number;
  name: string;
  number: number;
  gender: string;
};

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const db = await getDB();
      
      // 1. Get Team Info
      const teamResult = await db.getFirstAsync<Team>(
        'SELECT * FROM teams WHERE id = ?', 
        [id]
      );
      setTeam(teamResult);

      // 2. Get Roster
      const rosterResult = await db.getAllAsync<Player>(
        `SELECT p.id, p.name, p.number, p.gender
         FROM players p
         JOIN team_players tp ON p.id = tp.playerId
         WHERE tp.teamId = ?
         ORDER BY p.name ASC`,
        [id]
      );
      setPlayers(rosterResult);

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load team data.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const renderPlayer = ({ item }: { item: Player }) => (
    <View style={styles.playerCard}>
      <View style={styles.playerInfo}>
        <Text style={styles.playerNumber}>#{item.number}</Text>
        <Text style={styles.playerName}>{item.name}</Text>
      </View>
      <View style={styles.genderBadge}>
        {item.gender === 'male' && <FontAwesome name="male" size={20} color="#3498db" />}
        {item.gender === 'female' && <FontAwesome name="female" size={20} color="#e91e63" />}
        {item.gender === 'other' && <FontAwesome name="user" size={20} color="#95a5a6" />}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#27ae60" style={{ marginTop: 50 }} />
      </View>
    );
  }

  if (!team) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Team not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={players}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPlayer}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <FontAwesome name="users" size={40} color="#27ae60" />
            </View>
            <Text style={styles.teamName}>{team.name}</Text>
            <Text style={styles.subtitle}>{players.length} Players</Text>
          </View>
        }
      />
      
      {/* Floating Edit Button (Placeholder for future) */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => Alert.alert('Edit', 'Edit Team/Roster feature coming soon!')}
      >
        <FontAwesome name="pencil" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  list: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    elevation: 2,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eafaf1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginTop: 4,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 1,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#95a5a6',
    width: 40,
  },
  playerName: {
    fontSize: 18,
    color: '#2c3e50',
    fontWeight: '500',
  },
  genderBadge: {
    width: 30,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#e74c3c',
    textAlign: 'center',
    marginTop: 50,
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#34495e',
    justifyContent: 'center',
    alignItems: 'center',
    bottom: 30,
    right: 30,
    elevation: 8,
  },
});