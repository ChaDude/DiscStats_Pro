import { View, Text, StyleSheet } from 'react-native';

export default function NewGameScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>New Game</Text>
      <Text style={styles.text}>
        Setup options coming soon:{'\n\n'}
        • Team size (4v4 to 7v7){'\n'}
        • Gender ratio rules{'\n'}
        • Team & opponent names{'\n'}
        • Date
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 30,
  },
  text: {
    fontSize: 18,
    textAlign: 'center',
    color: '#34495e',
    lineHeight: 28,
  },
});