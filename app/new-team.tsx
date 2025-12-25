import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getDB } from '../database/db';

export default function NewTeamScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const createTeam = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a team name.');
      return;
    }

    setIsSaving(true);
    try {
      const db = await getDB();
      
      // Check for duplicate name
      const existing = await db.getFirstAsync('SELECT id FROM teams WHERE name = ?', [name.trim()]);
      if (existing) {
        Alert.alert('Error', 'A team with this name already exists.');
        setIsSaving(false);
        return;
      }

      // Insert Team
      const result = await db.runAsync('INSERT INTO teams (name) VALUES (?)', [name.trim()]);
      
      // Navigate directly to the new team's roster
      if (result.lastInsertRowId) {
        // Dismiss modal first, then push to team page
        router.dismiss(); 
        router.push(`/team/${result.lastInsertRowId}`);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to create team.');
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Team Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g., Darkside"
        autoFocus
      />

      <TouchableOpacity 
        style={[styles.saveButton, isSaving && styles.disabled]} 
        onPress={createTeam}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Create Team</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
    marginTop: 20,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    marginBottom: 30,
  },
  saveButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabled: {
    backgroundColor: '#95a5a6',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});