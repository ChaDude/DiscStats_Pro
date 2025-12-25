import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { getDB } from '../database/db';

export default function NewPlayerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const teamId = params.teamId as string;

  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [gender, setGender] = useState('male');
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Ref to auto-focus the name field after "Add Another"
  const nameInputRef = useRef<TextInput>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  };

  const savePlayer = async (addAnother: boolean = false) => {
    if (!name.trim()) {
      Alert.alert('Required', 'Player Name is required.');
      return;
    }

    setLoading(true);
    try {
      const db = await getDB();
      
      // 1. Create Player
      const playerResult = await db.runAsync(
        'INSERT INTO players (name, number, gender) VALUES (?, ?, ?)',
        [name.trim(), number ? parseInt(number) : null, gender]
      );
      
      const playerId = playerResult.lastInsertRowId;

      // 2. Link to Team
      await db.runAsync(
        'INSERT INTO team_players (teamId, playerId) VALUES (?, ?)',
        [teamId, playerId]
      );

      if (addAnother) {
        // Show non-blocking feedback
        showToast(`✅ ${name} added!`);
        
        // Reset form for next player
        setName('');
        setNumber('');
        setGender('male');
        setLoading(false);
        
        // Keep focus on the name field for rapid entry
        setTimeout(() => nameInputRef.current?.focus(), 100);
      } else {
        // Just go back, the list update is confirmation enough
        router.back();
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to add player.');
      setLoading(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.formGroup}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            ref={nameInputRef}
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. John Doe"
            autoFocus
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.formGroup, { flex: 0.4 }]}>
            <Text style={styles.label}>Number</Text>
            <TextInput
              style={styles.input}
              value={number}
              onChangeText={setNumber}
              placeholder="#"
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>

          <View style={[styles.formGroup, { flex: 0.6, paddingLeft: 10 }]}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={gender}
                onValueChange={setGender}
              >
                <Picker.Item label="Male" value="male" />
                <Picker.Item label="Female" value="female" />
                <Picker.Item label="Other" value="other" />
              </Picker>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.saveBtn} 
          onPress={() => savePlayer(false)}
          disabled={loading}
        >
          <Text style={styles.btnText}>Save & Close</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.saveBtn, styles.secondaryBtn]} 
          onPress={() => savePlayer(true)}
          disabled={loading}
        >
          <Text style={[styles.btnText, styles.secondaryBtnText]}>Save & Add Another</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Custom Toast Notification */}
      {toastMessage && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
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
    padding: 12,
    fontSize: 18,
  },
  pickerContainer: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    justifyContent: 'center',
  },
  saveBtn: {
    backgroundColor: '#27ae60',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryBtn: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#27ae60',
  },
  secondaryBtnText: {
    color: '#27ae60',
  },
  toast: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: '#2c3e50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  toastText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});