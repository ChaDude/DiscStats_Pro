import { View, Text, StyleSheet } from 'react-native';

export default function GamesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Games</Text>
      <Text style={styles.text}>
        Your saved games will appear here.
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
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  text: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 40,
    color: '#34495e',
  },
});