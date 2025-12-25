import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getDB } from '../../database/db';

type Team = {
  id: number;
  name: string;
};

export default function TeamsScreen() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(true);

  const loadTeams = async () => {
    try {
      const db = await getDB();
      const result = await db.getAllAsync<Team>('SELECT * FROM teams ORDER BY name');
      setTeams(result);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load teams.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const addTeam = async () => {
    if (!teamName.trim()) {
      Alert.alert('Missing Name', 'Please enter a team name.');
      return;
    }

    try {
      const db = await getDB();
      await db.runAsync('INSERT INTO teams (name) VALUES (?)', [teamName.trim()]);
      setTeamName('');
      await loadTeams();
      Alert.alert('Success', 'Team created!');
    } catch (error: any) {
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        Alert.alert('Duplicate', 'A team with that name already exists.');
      } else {
        console.error(error);
        Alert.alert('Error', 'Failed to create team.');
      }
    }
  };

  const deleteTeam = async (id: number) => {
    Alert.alert(
      'Delete Team',
      'This will delete the team and remove all players from its roster. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDB();
              await db.runAsync('DELETE FROM teams WHERE id = ?', [id]);
              await loadTeams();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete team.');
            }
          },
        },
      ]
    );
  };

  const renderTeam = ({ item }: { item: Team }) => (
    <TouchableOpacity
      style={styles.teamCard}
      onPress={() => router.push(`/(team)/${item.id}`)}
    >
      <Text style={styles.teamName}>{item.name}</Text>
      <View style={styles.teamActions}>
        <TouchableOpacity onPress={() => deleteTeam(item.id)}>
          <FontAwesome name="trash" size={24} color="#e74c3c" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Teams</Text>

      <View style={styles.addForm}>
        <TextInput
          style={styles.input}
          placeholder="New team name (e.g., Fury)"
          value={teamName}
          onChangeText={setTeamName}
          autoCapitalize="words"
        />
        <TouchableOpacity style={styles.addButton} onPress={addTeam}>
          <Text style={styles.addButtonText}>Create Team</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading teams...</Text>
      ) : teams.length === 0 ? (
        <Text style={styles.emptyText}>
          No teams yet.{'\n\n'}
          Create a team to start building its roster.
        </Text>
      ) : (
        <FlatList
          data={teams}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderTeam}
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
    paddingVertical: 14,
    fontSize: 18,
  },
  addButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
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
  teamCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 3,
  },
  teamName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  teamActions: {
    flexDirection: 'row',
  },
});