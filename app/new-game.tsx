import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { getDB } from '../database/db';

export default function NewGameScreen() {
  const router = useRouter();

  const [teamSize, setTeamSize] = useState(7);
  const [genderRule, setGenderRule] = useState('none');
  const [teamName, setTeamName] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const createGame = async () => {
    if (!teamName.trim() || !opponentName.trim()) {
      Alert.alert('Missing Info', 'Please enter both team and opponent names.');
      return;
    }

    try {
      const db = await getDB();

      await db.runAsync(
        `INSERT INTO games (name, date, teamName, opponentName, teamSize, genderRule) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          `${teamName} vs ${opponentName}`,
          date.toISOString().split('T')[0], // YYYY-MM-DD
          teamName,
          opponentName,
          teamSize,
          genderRule,
        ]
      );

      Alert.alert('Success', 'New game created!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to create game. Please try again.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>New Game</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Team Name</Text>
        <TextInput
          style={styles.input}
          value={teamName}
          onChangeText={setTeamName}
          placeholder="e.g., Fury"
          autoCorrect={false}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Opponent Name</Text>
        <TextInput
          style={styles.input}
          value={opponentName}
          onChangeText={setOpponentName}
          placeholder="e.g., Riot"
          autoCorrect={false}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Team Size</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={teamSize}
            onValueChange={(itemValue) => setTeamSize(itemValue)}
            style={styles.picker}
          >
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
          <Picker
            selectedValue={genderRule}
            onValueChange={(itemValue) => setGenderRule(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="None (no tracking)" value="none" />
            <Picker.Item label="ABBA (WFDF Rule A)" value="abba" />
            <Picker.Item label="Offense Dictates" value="offense" />
            <Picker.Item label="Endzone Dictates (WFDF Rule B)" value="endzone" />
          </Picker>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Date</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateText}>
            {date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="spinner"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setDate(selectedDate);
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  picker: {
    height: 200,
  },
  dateButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
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
});