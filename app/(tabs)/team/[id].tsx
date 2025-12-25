import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getDB } from '../../../database/db';

type Team = {
  id: number;
  name: string;
};

type Player = {
  id: number;
  name: string;
  number: number | null;
  gender: string;
};

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [team, setTeam] = useState<Team | null>(null);
  const [roster, setRoster] = useState<Player[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [playerNumber, setPlayerNumber] = useState('');
  const [playerGender, setPlayerGender] = useState<'male' | 'female' | 'other'>('male');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const db = await getDB();

      // Load team
      const teamResult = await db.getFirstAsync<Team>('SELECT * FROM teams WHERE id = ?', [id]);
      setTeam(teamResult);

      // Load roster (flat — no nested player object)
      const rosterResult = await db.getAllAsync<Player>(
        `SELECT p.id, p.name, p.number, p.gender
         FROM players p
         JOIN team_players tp ON p.id = tp.playerId
         WHERE tp.teamId = ?
         ORDER BY p.name`,
        [id]
      );
      setRoster(rosterResult);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const addPlayerToRoster = async () => {
    if (!playerName.trim()) {
      Alert.alert('Missing Name', 'Please enter a player name.');
      return;
    }

    try {
      const db = await getDB();

      // Create player
      const insertResult = await db.runAsync(
        'INSERT INTO players (name, number, gender) VALUES (?, ?, ?)',
        [playerName.trim(), playerNumber ? parseInt(playerNumber) : null, playerGender]
      );
      const playerId = insertResult.lastInsertRowId;

      // Add to team
      await db.runAsync('INSERT INTO team_players (teamId, playerId) VALUES (?, ?)', [id, playerId]);

      setPlayerName('');
      setPlayerNumber('');
      setPlayerGender('male');
      await loadData();
      Alert.alert('Success', 'Player added to roster!');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to add player.');
    }
  };

  const removePlayerFromRoster = async (playerId: number) => {
    Alert.alert(
      'Remove Player',
      'Remove this player from the team roster?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDB();
              await db.runAsync('DELETE FROM team_players WHERE teamId = ? AND playerId = ?', [id, playerId]);
              await loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to remove player.');
            }
          },
        },
      ]
    );
  };

  const renderPlayer = ({ item }: { item: Player }) => (
    <View style={styles.playerCard}>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>
          {item.name} {item.number ? `#${item.number}` : ''}
        </Text>
        <Text style={styles.playerGender}>{item.gender.toUpperCase()}</Text>
      </View>
      <TouchableOpacity onPress={() => removePlayerFromRoster(item.id)}>
        <FontAwesome name="times" size={26} color="#e74c3c" />
      </TouchableOpacity>
    </View>
  );

  if (loading || !team) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading roster...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{team.name} Roster</Text>
      <Text style={styles.rosterCount}>{roster.length} players</Text>

      <View style={styles.addForm}>
        <Text style={styles.sectionTitle}>Add New Player</Text>
        <TextInput
          style={styles.input}
          placeholder="Player name"
          value={playerName}
          onChangeText={setPlayerName}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          placeholder="Number (optional)"
          value={playerNumber}
          onChangeText={setPlayerNumber}
          keyboardType="numeric"
        />
        <View style={styles.genderRow}>
          <TouchableOpacity
            style={[styles.genderButton, playerGender === 'male' && styles.genderSelected]}
            onPress={() => setPlayerGender('male')}
          >
            <Text style={styles.genderText}>Male</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.genderButton, playerGender === 'female' && styles.genderSelected]}
            onPress={() => setPlayerGender('female')}
          >
            <Text style={styles.genderText}>Female</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.genderButton, playerGender === 'other' && styles.genderSelected]}
            onPress={() => setPlayerGender('other')}
          >
            <Text style={styles.genderText}>Other</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={addPlayerToRoster}>
          <Text style={styles.addButtonText}>Add to Roster</Text>
        </TouchableOpacity>
      </View>

      {roster.length === 0 ? (
        <Text style={styles.emptyText}>No players on this roster yet</Text>
      ) : (
        <FlatList
          data={roster}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPlayer}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  rosterCount: {
    fontSize: 18,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  addForm: {
    padding: 20,
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    elevation: 3,
  },
  input: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    fontSize: 18,
  },
  genderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  genderSelected: {
    backgroundColor: '#27ae60',
  },
  genderText: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loading: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
    color: '#7f8c8d',
  },
  emptyText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#7f8c8d',
    lineHeight: 28,
    paddingHorizontal: 40,
    marginTop: 50,
  },
  list: {
    paddingHorizontal: 20,
  },
  playerCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  playerGender: {
    fontSize: 16,
    color: '#7f8c8d',
    marginTop: 4,
  },
});