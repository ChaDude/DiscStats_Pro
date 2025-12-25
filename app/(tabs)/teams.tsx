import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { getDB } from '../../database/db';

type TeamSummary = {
  id: number;
  name: string;
  playerCount: number;
};

export default function TeamsScreen() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTeams = async () => {
    try {
      const db = await getDB();
      // We join with team_players to count the roster size for each team
      const result = await db.getAllAsync<TeamSummary>(`
        SELECT t.id, t.name, COUNT(tp.playerId) as playerCount
        FROM teams t
        LEFT JOIN team_players tp ON t.id = tp.teamId
        GROUP BY t.id
        ORDER BY t.name ASC
      `);
      setTeams(result);
    } catch (error) {
      console.error('Error loading teams:', error);
      Alert.alert('Error', 'Failed to load teams.');
    } finally {
      setLoading(false);
    }
  };

  // Reload list whenever the screen comes into focus (in case we added/deleted teams)
  useFocusEffect(
    useCallback(() => {
      loadTeams();
    }, [])
  );

  const deleteTeam = async (id: number, name: string) => {
    Alert.alert(
      'Delete Team',
      `Are you sure you want to delete "${name}"? This will also remove their roster data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDB();
              await db.runAsync('DELETE FROM teams WHERE id = ?', [id]);
              loadTeams(); // Refresh list
            } catch (error) {
              Alert.alert('Error', 'Failed to delete team.');
            }
          },
        },
      ]
    );
  };

  const renderTeam = ({ item }: { item: TeamSummary }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => router.push(`/team/${item.id}`)} 
    >
      <View style={styles.cardContent}>
        <View style={styles.cardIcon}>
          <FontAwesome name="users" size={24} color="#27ae60" />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.teamName}>{item.name}</Text>
          <Text style={styles.playerCount}>{item.playerCount} Players</Text>
        </View>
        <TouchableOpacity 
          style={styles.deleteBtn}
          onPress={() => deleteTeam(item.id, item.name)}
        >
          <FontAwesome name="trash" size={20} color="#bdc3c7" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Teams</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#27ae60" style={{ marginTop: 50 }} />
      ) : teams.length === 0 ? (
        <View style={styles.emptyState}>
          <FontAwesome name="users" size={50} color="#bdc3c7" />
          <Text style={styles.emptyText}>No teams found.</Text>
          <Text style={styles.emptySubtext}>Create one or check database seeding.</Text>
        </View>
      ) : (
        <FlatList
          data={teams}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderTeam}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/new-team')} 
      >
        <FontAwesome name="plus" size={30} color="#fff" />
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
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  list: {
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  cardIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eafaf1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardText: {
    flex: 1,
  },
  teamName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  playerCount: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },
  deleteBtn: {
    padding: 10,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7f8c8d',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#95a5a6',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#27ae60',
    justifyContent: 'center',
    alignItems: 'center',
    bottom: 30,
    right: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});