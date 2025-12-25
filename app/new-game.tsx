import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { getDB } from '../database/db';

type Team = {
  id: number;
  name: string;
};

export default function NewGameScreen() {
  const router = useRouter();

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [opponentName, setOpponentName] = useState('');
  const [teamSize, setTeamSize] = useState(7);
  const [genderRule, setGenderRule] = useState('none');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadTeams = async () => {
    try {
      const db = await getDB();
      const result = await db.getAllAsync<Team>('SELECT * FROM teams ORDER BY name');
      setTeams(result);
      if (result.length > 0) {
        setSelectedTeamId(result[0].id);
      }
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

  const createGame = async () => {
    if (!selectedTeamId) {
      Alert.alert('No Team', 'Create a team first in the Teams tab.');
      return;
    }
    if (!opponentName.trim()) {
      Alert.alert('Missing Opponent', 'Please enter the opponent name.');
      return;
    }

    try {
      const db = await getDB();
      const teamResult = await db.getFirstAsync<{ name: string }>(
        'SELECT name FROM teams WHERE id = ?',
        [selectedTeamId]
      );

      await db.runAsync(
        `INSERT INTO games (name, date, teamName, opponentName, teamSize, genderRule, teamId) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `${teamResult?.name || 'My Team'} vs ${opponentName}`,
          date.toISOString().split('T')[0],
          teamResult?.name || 'My Team',
          opponentName,
          teamSize,
          genderRule,
          selectedTeamId,
        ]
      );

      Alert.alert('Success', 'New game created!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Create game error:', error);
      Alert.alert('Error', 'Failed to create game. Check console.');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading teams...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>New Game</Text>

      <View style={styles.section}>
        <Text style={styles.label}>My Team</Text>
        {teams.length === 0 ? (
          <Text style={styles.noTeams}>
            No teams yet — go to Teams tab to create one
          </Text>
        ) : (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedTeamId}
              onValueChange={(value) => setSelectedTeamId(value as number)}
            >
              {teams.map((team) => (
                <Picker.Item key={team.id} label={team.name} value={team.id} />
              ))}
            </Picker>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Opponent</Text>
        <TextInput
          style={styles.input}
          value={opponentName}
          onChangeText={setOpponentName}
          placeholder="e.g., Riot"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Team Size</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={teamSize} onValueChange={setTeamSize}>
            <Picker.Item label="4v4" value={4} />
            <Picker.Item label="5v5" value={5} />
            <Picker.Item label="6v6" value={6} />
            <Picker.Item label="7v7" value={7} />
          </Picker>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Gender Ratio Rule</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={genderRule} onValueChange={setGenderRule}>
            <Picker.Item label="None (no tracking)" value="none" />
            <Picker.Item label="ABBA (WFDF Rule A)" value="abba" />
            <Picker.Item label="Offense Dictates" value="offense" />
            <Picker.Item label="Endzone Dictates (WFDF Rule B)" value="endzone" />
          </Picker>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Date</Text>
        <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateText}>
            {date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            onChange={(event, selected) => {
              setShowDatePicker(false);
              if (selected) setDate(selected);
            }}
          />
        )}
      </View>

      <TouchableOpacity style={styles.createButton} onPress={createGame}>
        <Text style={styles.createButtonText}>Create Game</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 30,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  noTeams: {
    fontSize: 16,
    color: '#e74c3c',
    textAlign: 'center',
    padding: 20,
  },
  dateButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
  },
  dateText: {
    fontSize: 18,
    color: '#2c3e50',
  },
  createButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  loading: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
    color: '#7f8c8d',
  },
});