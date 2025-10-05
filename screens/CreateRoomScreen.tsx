import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Share,
  Clipboard,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ChatClient } from '../src/chat/ChatClient';
import { RootStackParamList } from '../src/types';

type CreateRoomScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'CreateRoom'
>;

interface CreateRoomScreenProps {
  navigation: CreateRoomScreenNavigationProp;
}

const CreateRoomScreen: React.FC<CreateRoomScreenProps> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [roomCreated, setRoomCreated] = useState(false);
  const [roomKey, setRoomKey] = useState('');

  const handleCreateRoom = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    setLoading(true);

    try {
      const chatClient = new ChatClient();
      const result = await chatClient.createRoom(username.trim());

      if (result.success && result.roomKey && result.roomId) {
        setRoomKey(result.roomKey);
        setRoomCreated(true);

        // Navigate to chat screen with client instance
        navigation.navigate('Chat', {
          chatClient: chatClient as any,
          roomInfo: {
            roomId: result.roomId,
            roomKey: result.roomKey,
            username: username.trim(),
            isCreator: true,
          },
        } as any);
      } else {
        Alert.alert('Error', result.error || 'Failed to create room');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const shareRoomKey = async () => {
    try {
      await Share.share({
        message: `Join my encrypted chat room!\n\nRoom Key: ${roomKey}\n\nDownload the P2P Chat app and use this key to join.`,
        title: 'P2P Chat Room Key',
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  const copyRoomKey = () => {
    Clipboard.setString(roomKey);
    Alert.alert('Copied', 'Room key copied to clipboard!');
  };

  if (roomCreated) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🎉 Room Created!</Text>
        <Text style={styles.subtitle}>
          Share this key with others to let them join:
        </Text>

        <View style={styles.keyContainer}>
          <Text style={styles.roomKey}>{roomKey}</Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={copyRoomKey}>
          <Text style={styles.buttonText}>📋 Copy Room Key</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={shareRoomKey}>
          <Text style={styles.buttonText}>📤 Share Room Key</Text>
        </TouchableOpacity>

        <Text style={styles.warningText}>
          ⚠️ Keep this key secure! Anyone with this key can join your room.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏗️  Create New Room</Text>
      <Text style={styles.subtitle}>Enter your username to create an encrypted chat room</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleCreateRoom}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Create Room</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
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
  keyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  roomKey: {
    fontFamily: 'monospace',
    fontSize: 14,
    textAlign: 'center',
    color: '#333',
  },
  warningText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#FF6B35',
    fontStyle: 'italic',
    marginTop: 20,
  },
});

export default CreateRoomScreen;
