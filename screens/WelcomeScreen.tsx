import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Alert } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { HyperswarmManager } from '../src/network/managers/HyperswarmManager';
import { MessageEncryption } from '../src/crypto/MessageEncryption';
import { RoomStorage, SavedRoom } from '../src/storage/RoomStorage';

type RootStackParamList = {
  Welcome: undefined;
  CreateRoom: undefined;
  JoinRoom: undefined;
  Chat: { roomId: string; roomKey?: string };
};

type WelcomeScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Welcome'
>;

interface WelcomeScreenProps {
  navigation: WelcomeScreenNavigationProp;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedRooms, setSavedRooms] = useState<SavedRoom[]>([]);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  useEffect(() => {
    const initializeNetwork = async () => {
      try {
        const manager = HyperswarmManager.getInstance();
        
        // Set up event listener for when worklet is ready
        const unsubscribe = manager.onReady(() => {
          console.log('[WelcomeScreen] ✅ Hyperswarm worklet is ready!');
          setIsReady(true);
          setIsInitializing(false);
        });

        // Set up error listener
        const unsubscribeError = manager.onError((event) => {
          console.error('[WelcomeScreen] ❌ Hyperswarm error:', event.error);
          setError(event.error);
          setIsInitializing(false);
        });

        // Initialize the worklet with a persistent seed
        const { SeedStorage } = await import('../src/storage/SeedStorage');
        const seed = await SeedStorage.getOrCreateSeed();
        
        console.log('[WelcomeScreen] 🚀 Starting initialization with seed...');
        await manager.initialize(seed);
        console.log('[WelcomeScreen] ⏳ Initialization complete, waiting for READY event from worklet...');

        // Cleanup on unmount
        return () => {
          unsubscribe();
          unsubscribeError();
        };
      } catch (err) {
        console.error('[WelcomeScreen] ❌ Failed to initialize:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize');
        setIsInitializing(false);
      }
    };

    initializeNetwork();
  }, []);

  useEffect(() => {
    // Load saved rooms when screen comes into focus
    const loadRooms = async () => {
      const rooms = await RoomStorage.getAllRooms();
      setSavedRooms(rooms);
    };

    loadRooms();

    // Set up a listener for when we navigate back to this screen
    const unsubscribe = navigation.addListener('focus', loadRooms);
    return unsubscribe;
  }, [navigation]);

  const handleRoomPress = async (room: SavedRoom) => {
    // Prevent double-tap: if already joining this or any room, ignore
    if (joiningRoomId) {
      console.log('[WelcomeScreen] Already joining a room, ignoring tap');
      return;
    }

    try {
      // Check if we have the room key
      if (!room.roomKey) {
        Alert.alert('Error', 'Room key not found. This room cannot be rejoined.');
        return;
      }

      // Validate room key format
      if (!MessageEncryption.isValidRoomKey(room.roomKey)) {
        Alert.alert('Error', 'Invalid room key format. This room cannot be rejoined.');
        return;
      }

      // Derive room ID from the stored room key
      const roomId = MessageEncryption.deriveRoomId(room.roomKey);

      // Set joining state to prevent double-tap
      setJoiningRoomId(roomId);

      console.log('[WelcomeScreen] 🔑 Rejoining room with key:', room.roomKey.substring(0, 16) + '...');
      console.log('[WelcomeScreen] 🆔 Derived Room ID:', roomId.substring(0, 16) + '...');

      // Rejoin the room with both roomId and roomKey
      const manager = HyperswarmManager.getInstance();
      await manager.joinRoom(roomId, room.roomKey);

      // Navigate to chat screen
      navigation.navigate('Chat', {
        roomId: roomId,
        roomKey: room.roomKey,
      });
      
      // Clear joining state after navigation
      setJoiningRoomId(null);
    } catch (error) {
      console.error('[WelcomeScreen] Error rejoining room:', error);
      
      // Clear joining state on error
      setJoiningRoomId(null);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if it's a root peer connection error
      if (errorMessage.includes('Root peer is not connected') || 
          errorMessage.includes('Timeout waiting for root peer')) {
        Alert.alert(
          'Backend Server Not Connected',
          'Please ensure the backend server is running and try again.',
          [{ text: 'OK' }]
        );
      }
      // For other errors, just log them (don't show alert to avoid noise)
    }
  };

  const handleDeleteRoom = (room: SavedRoom) => {
    Alert.alert(
      'Delete Room',
      `Are you sure you want to delete "${room.name || 'this room'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await RoomStorage.deleteRoom(room.roomId);
            const rooms = await RoomStorage.getAllRooms();
            setSavedRooms(rooms);
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔐 P2P Encrypted Chat</Text>
      <Text style={styles.subtitle}>Secure, decentralized messaging</Text>
      
      {isInitializing && (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.statusText}>Initializing P2P network...</Text>
        </View>
      )}

      {error && (
        <View style={[styles.statusContainer, styles.errorContainer]}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {isReady && (
        <View style={[styles.statusContainer, styles.readyContainer]}>
          <Text style={styles.readyText}>✓ Network Ready</Text>
        </View>
      )}
      
      {/* Saved Rooms List */}
      {savedRooms.length > 0 && (
        <View style={styles.roomsContainer}>
          <Text style={styles.roomsTitle}>Your Rooms</Text>
          <FlatList
            data={savedRooms}
            keyExtractor={(item) => item.roomId}
            renderItem={({ item }) => {
              const roomId = MessageEncryption.deriveRoomId(item.roomKey);
              const isJoining = joiningRoomId === roomId;
              
              return (
                <TouchableOpacity
                  style={[styles.roomItem, isJoining && styles.roomItemJoining]}
                  onPress={() => handleRoomPress(item)}
                  onLongPress={() => handleDeleteRoom(item)}
                  disabled={isJoining || !!joiningRoomId}
                >
                  <View style={styles.roomInfo}>
                    <Text style={styles.roomName}>{item.name || 'Unnamed Room'}</Text>
                    <Text style={styles.roomMeta}>
                      {item.isCreator ? '👑 Creator' : '👤 Member'} • {formatDate(item.lastActive || item.createdAt)}
                    </Text>
                  </View>
                  {isJoining ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : (
                    <Text style={styles.roomArrow}>›</Text>
                  )}
                </TouchableOpacity>
              );
            }}
            style={styles.roomsList}
          />
        </View>
      )}
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={() => navigation.navigate('CreateRoom')}
      >
        <Text style={styles.buttonText}>Create New Room</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.button, styles.secondaryButton]} 
        onPress={() => navigation.navigate('JoinRoom')}
      >
        <Text style={styles.buttonText}>Join Existing Room</Text>
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
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 50,
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 15,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    marginBottom: 15,
  },
  secondaryButton: {
    backgroundColor: '#5856D6',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusContainer: {
    marginBottom: 20,
    padding: 15,
    borderRadius: 10,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    borderWidth: 1,
    borderColor: '#FF0000',
  },
  errorText: {
    fontSize: 16,
    color: '#CC0000',
    textAlign: 'center',
  },
  readyContainer: {
    backgroundColor: '#E5FFE5',
    borderWidth: 1,
    borderColor: '#00AA00',
  },
  readyText: {
    fontSize: 16,
    color: '#008800',
    fontWeight: 'bold',
  },
  roomsContainer: {
    width: '100%',
    maxWidth: 300,
    marginBottom: 20,
    maxHeight: 200,
  },
  roomsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  roomsList: {
    width: '100%',
  },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  roomItemJoining: {
    opacity: 0.6,
    backgroundColor: '#F0F8FF',
    borderColor: '#007AFF',
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  roomMeta: {
    fontSize: 12,
    color: '#666',
  },
  roomArrow: {
    fontSize: 24,
    color: '#007AFF',
    marginLeft: 10,
  },
});

export default WelcomeScreen;
