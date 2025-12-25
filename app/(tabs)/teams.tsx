import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { getDB } from '../../database/db';

type Player = {
  id: number;
  name: string;
  number: number | null;
  gender: string;
};

export default function TeamsScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [gender, setGender] = useState('male');
  const [loading, setLoading] = useState(true);

  const loadPlayers = async () => {
    try {
      const db = await getDB();
      const result = await db.getAllAsync<Player>('SELECT * FROM players ORDER BY name');
      setPlayers(result);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load players.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlayers();
  }, []);

  const addPlayer = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter a player name.');
      return;
    }

    try {
      const db = await getDB();
      await db.runAsync(
        'INSERT INTO players (name, number, gender) VALUES (?, ?, ?)',
        [name.trim(), number ? parseInt(number) : null, gender]
      );
      setName('');
      setNumber('');
      setGender('male');
      await loadPlayers();
      Alert.alert('Success', 'Player added!');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to add player.');
    }
  };

  const deletePlayer = async (id: number) => {
    Alert.alert(
      'Delete Player',
      'Are you sure? This will remove the player from all games.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDB();
              await db.runAsync('DELETE FROM players WHERE id = ?', [id]);
              await loadPlayers();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete player.');
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
      <TouchableOpacity onPress={() => deletePlayer(item.id)}>
        <FontAwesome name="trash" size={24} color="#e74c3c" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Players</Text>

      <View style={styles.addForm}>
        <TextInput
          style={styles.input}
          placeholder="Player name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Number (optional)"
          value={number}
          onChangeText={setNumber}
          keyboardType="numeric"
        />
        <View style={styles.genderRow}>
          <TouchableOpacity
            style={[styles.genderButton, gender === 'male' && styles.genderSelected]}
            onPress={() => setGender('male')}
          >
            <Text style={styles.genderText}>Male</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.genderButton, gender === 'female' && styles.genderSelected]}
            onPress={() => setGender('female')}
          >
            <Text style={styles.genderText}>Female</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.genderButton, gender === 'other' && styles.genderSelected]}
            onPress={() => setGender('other')}
          >
            <Text style={styles.genderText}>Other</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={addPlayer}>
          <Text style={styles.addButtonText}>Add Player</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading players...</Text>
      ) : players.length === 0 ? (
        <Text style={styles.emptyText}>
          No players yet.{'\n\n'}
          Add players above to use in games.
        </Text>
      ) : (
        <FlatList
          data={players}
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
    marginBottom: 20,
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
    paddingVertical: 12,
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
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#7f8c8d',
    marginTop: 50,
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