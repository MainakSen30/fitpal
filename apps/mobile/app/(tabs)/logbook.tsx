import { View, Text, StyleSheet } from 'react-native';

export default function LogbookScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Logbook</Text>
      <Text style={styles.subtitle}>Your workout history</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#999',
    marginTop: 8,
  },
});
