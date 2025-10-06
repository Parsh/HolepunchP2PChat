import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { HyperswarmManager } from '../src/network/managers/HyperswarmManager';
import { RootStackParamList } from '../src/types';

type JoinRoomScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'JoinRoom'
>;

interface JoinRoomScreenProps {
  navigation: JoinRoomScreenNavigationProp;
}

const JoinRoomScreen: React.FC<JoinRoomScreenProps> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [roomKey, setRoomKey] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoinRoom = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    if (!roomKey.trim()) {
      Alert.alert('Error', 'Please enter a room key');
      return;
    }

    if (roomKey.trim().length !== 64) {
      Alert.alert(
        'Error',
        'Invalid room key format. Key should be 64 characters.',
      );
      return;
    }

    setLoading(true);

    try {
      const manager = HyperswarmManager.getInstance();
      const roomId = roomKey.trim();
      
      // Join the room
      await manager.joinRoom(roomId);
      
      // Navigate to chat screen
      navigation.navigate('Chat', {
        roomId,
        roomKey: roomId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to join room: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚪 Join Room</Text>
      <Text style={styles.subtitle}>Enter the room key to join an existing encrypted chat</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TextInput
        style={[styles.input, styles.keyInput]}
        placeholder="Enter room key (64 characters)"
        value={roomKey}
        onChangeText={setRoomKey}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={true}
        numberOfLines={3}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleJoinRoom}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Join Room</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.helpContainer}>
        <Text style={styles.helpText}>
          💡 The room key is a 64-character string provided by the room creator.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  keyInput: {
    height: 80,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonDisabled: {
    backgroundColor: '#A0A0A0',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  helpContainer: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#E8F4FD',
    borderRadius: 10,
  },
  helpText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#2C5282',
  },
});

export default JoinRoomScreen;
