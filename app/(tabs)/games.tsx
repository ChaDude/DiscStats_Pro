import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
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

export default function GamesScreen() {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGames = async () => {
    try {
      const db = await getDB();
      const result = await db.getAllAsync<Game>('SELECT * FROM games ORDER BY date DESC');
      setGames(result);
    } catch (error) {
      console.error('Error loading games:', error);
      Alert.alert('Error', 'Failed to load games.');
    } finally {
      setLoading(false);
    }
  };

  // This is the key fix: Reloads data every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadGames();
    }, [])
  );

  const deleteGame = async (id: number) => {
    Alert.alert(
      'Delete Game',
      'Are you sure you want to delete this game? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDB();
              await db.runAsync('DELETE FROM games WHERE id = ?', id);
              loadGames(); // Refresh list immediately
            } catch (error) {
              Alert.alert('Error', 'Failed to delete game.');
            }
          },
        },
      ]
    );
  };

  const renderGame = ({ item }: { item: Game }) => {
    return (
      <TouchableOpacity
        style={styles.gameCard}
        onPress={() => router.push(`/game/${item.id}`)}
      >
        <View style={styles.gameHeader}>
          <Text style={styles.gameName}>{item.name}</Text>
          <TouchableOpacity onPress={() => deleteGame(item.id)} hitSlop={10}>
            <FontAwesome name="trash" size={24} color="#e74c3c" />
          </TouchableOpacity>
        </View>
        <Text style={styles.gameDetails}>
          {item.teamSize}v{item.teamSize} • {item.genderRule !== 'none' ? item.genderRule.toUpperCase() : 'No ratio tracking'}
        </Text>
        <Text style={styles.gameDate}>
          {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Games</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#27ae60" style={{ marginTop: 50 }} />
      ) : games.length === 0 ? (
        <View style={styles.emptyState}>
          <FontAwesome name="trophy" size={50} color="#bdc3c7" />
          <Text style={styles.emptyText}>
            No games yet.{'\n\n'}
            Tap the + button to create your first game.
          </Text>
        </View>
      ) : (
        <FlatList
          data={games}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderGame}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating + Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/new-game')}
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#7f8c8d',
    marginTop: 20,
    lineHeight: 28,
  },
  list: {
    padding: 20,
  },
  gameCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gameName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
    marginRight: 10,
  },
  gameDetails: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  gameDate: {
    fontSize: 16,
    color: '#34495e',
    fontWeight: '600',
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