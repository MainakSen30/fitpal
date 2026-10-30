import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>FitPal</Text>
        <Text style={styles.subtitle}>Ready to train?</Text>
      </View>

      <TouchableOpacity style={styles.startButton} onPress={() => router.push('/(tabs)/workout')}>
        <Text style={styles.startButtonText}>Start Workout</Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/routines')}>
          <Text style={styles.cardTitle}>My Routines</Text>
          <Text style={styles.cardSubtitle}>Start from a saved routine</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/logbook')}>
          <Text style={styles.cardTitle}>Workout History</Text>
          <Text style={styles.cardSubtitle}>View past workouts</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
  },
  header: {
    marginTop: 20,
    marginBottom: 30,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#999',
    fontSize: 16,
    marginTop: 4,
  },
  startButton: {
    backgroundColor: '#ff6b35',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 30,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardSubtitle: {
    color: '#999',
    fontSize: 14,
  },
});
