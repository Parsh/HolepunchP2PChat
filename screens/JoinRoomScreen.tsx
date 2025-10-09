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
import { MessageEncryption } from '../src/crypto/MessageEncryption';
import { RoomStorage } from '../src/storage/RoomStorage';
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

    const roomKeyHex = roomKey.trim();
    
    // Validate room key format
    if (!MessageEncryption.isValidRoomKey(roomKeyHex)) {
      Alert.alert(
        'Error',
        'Invalid room key format. Key should be 64 hex characters.',
      );
      return;
    }

    setLoading(true);

    try {
      const manager = HyperswarmManager.getInstance();
      
      // Derive room ID from the room key (for P2P discovery)
      const roomId = MessageEncryption.deriveRoomId(roomKeyHex);
      
      console.log('[JoinRoom] 🔑 Room Key (secret):', roomKeyHex.substring(0, 16) + '...');
      console.log('[JoinRoom] 🆔 Derived Room ID:', roomId.substring(0, 16) + '...');
      
      // Join the room with BOTH roomId (for discovery) and roomKey (for encryption)
      await manager.joinRoom(roomId, roomKeyHex);
      
      // Save room to local storage (save the KEY for future rejoins and encryption)
      await RoomStorage.saveRoom({
        roomId,
        roomKey: roomKeyHex, // Store the actual room key, not the derived ID
        name: `Joined by ${username.trim()}`,
        createdAt: Date.now(),
        isCreator: false,
      });
      
      // Navigate to chat screen
      navigation.navigate('Chat', {
        roomId,
        roomKey: roomKeyHex,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if it's a root peer connection error
      if (errorMessage.includes('Root peer is not connected') || 
          errorMessage.includes('Timeout waiting for root peer')) {
        Alert.alert(
          'Backend Server Not Connected',
          'Please ensure the backend server is running and try again.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', `Failed to join room: ${errorMessage}`);
      }
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
