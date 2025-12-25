import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useFocusEffect } from 'expo-router';
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
  const [startingPuller, setStartingPuller] = useState<'our' | 'opponent'>('our');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadTeams = async () => {
    try {
      const db = await getDB();
      const result = await db.getAllAsync<Team>('SELECT * FROM teams ORDER BY name');
      setTeams(result);
      
      // Auto-select the first team if none selected
      if (result.length > 0 && !selectedTeamId) {
        setSelectedTeamId(result[0].id);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load teams.');
    } finally {
      setLoading(false);
    }
  };

  // Reload teams every time screen opens (in case you just added one)
  useFocusEffect(
    useCallback(() => {
      loadTeams();
    }, [])
  );

  const createGame = async () => {
    if (!selectedTeamId) {
      Alert.alert('No Team', 'You need to create a team in the Teams tab first.');
      return;
    }
    if (!opponentName.trim()) {
      Alert.alert('Missing Opponent', 'Please enter the opponent name.');
      return;
    }

    setIsSaving(true);
    try {
      const db = await getDB();
      
      // Get the team name for the title
      const teamResult = await db.getFirstAsync<{ name: string }>(
        'SELECT name FROM teams WHERE id = ?',
        [selectedTeamId]
      );
      const myTeamName = teamResult?.name || 'My Team';

      await db.runAsync(
        `INSERT INTO games (name, date, teamName, opponentName, teamSize, genderRule, teamId, startingPuller) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `${myTeamName} vs ${opponentName}`,
          date.toISOString().split('T')[0],
          myTeamName,
          opponentName,
          teamSize,
          genderRule,
          selectedTeamId,
          startingPuller,
        ]
      );

      // Success! Go back to games list
      router.back();
      
    } catch (error) {
      console.error('Create game error:', error);
      Alert.alert('Error', 'Failed to create game.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#27ae60" />
        <Text style={styles.loadingText}>Loading teams...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      {/* Team Selection */}
      <View style={styles.section}>
        <Text style={styles.label}>My Team</Text>
        {teams.length === 0 ? (
          <TouchableOpacity 
            style={styles.noTeamsBtn}
            onPress={() => router.push('/new-team')}
          >
            <Text style={styles.noTeamsText}>No teams found. Tap to create one.</Text>
          </TouchableOpacity>
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

      {/* Opponent */}
      <View style={styles.section}>
        <Text style={styles.label}>Opponent Name</Text>
        <TextInput
          style={styles.input}
          value={opponentName}
          onChangeText={setOpponentName}
          placeholder="e.g. Riot"
        />
      </View>

      {/* Starting Pull */}
      <View style={styles.section}>
        <Text style={styles.label}>Who pulls first?</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={startingPuller} onValueChange={setStartingPuller}>
            <Picker.Item label="Our team pulls" value="our" />
            <Picker.Item label="Opponent pulls" value="opponent" />
          </Picker>
        </View>
      </View>

      {/* Team Size */}
      <View style={styles.section}>
        <Text style={styles.label}>Format</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={teamSize} onValueChange={setTeamSize}>
            <Picker.Item label="7v7" value={7} />
            <Picker.Item label="6v6" value={6} />
            <Picker.Item label="5v5" value={5} />
            <Picker.Item label="4v4" value={4} />
          </Picker>
        </View>
      </View>

      {/* Gender Rule */}
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

      {/* Date */}
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

      {/* Create Button */}
      <TouchableOpacity 
        style={[styles.createButton, isSaving && styles.disabled]} 
        onPress={createGame}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.createButtonText}>Start Game</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingBottom: 50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#7f8c8d',
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
  },
  pickerContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  noTeamsBtn: {
    padding: 16,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeeba',
  },
  noTeamsText: {
    color: '#856404',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  dateButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateText: {
    fontSize: 18,
    color: '#2c3e50',
  },
  createButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  disabled: {
    backgroundColor: '#95a5a6',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});