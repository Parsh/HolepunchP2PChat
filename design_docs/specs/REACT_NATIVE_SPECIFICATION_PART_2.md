# P2P Encrypted Chat React Native App - Development Specification (Part 2)

## ⚠️ Version Requirements (CRITICAL)

**Before proceeding with any implementation, ensure exact version compatibility:**

- **React Native**: `0.74.1` (exact version required)
- **React**: `18.2.0` (exact version required)
- **TypeScript**: `5.0.4` (recommended for compatibility)

**Package.json Version Check:**
```json
{
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.74.1"
  },
  "devDependencies": {
    "typescript": "5.0.4",
    "@types/react": "^18.2.6"
  }
}
```

**Why These Exact Versions?**
- React Native 0.74.1 includes New Architecture support
- React 18.2.0 is the compatible React version for RN 0.74.1
- Newer versions may have breaking changes affecting P2P integration
- These versions ensure maximum compatibility with Holepunch libraries

---

## 🔗 Stage 4: Chat Client Integration

### Stage 4.1: Chat Client Core Class

**Objective**: Create the main chat client class that orchestrates all components.

**File**: `src/chat/ChatClient.js`

```javascript
import { EventEmitter } from 'events';
import { RoomManager } from '../rooms/RoomManager';
import { CryptoManager } from '../crypto/CryptoManager';
import { NetworkManager } from '../network/NetworkManager';
import { StorageManager } from '../storage/StorageManager';

export class ChatClient extends EventEmitter {
  constructor() {
    super();
    this.roomManager = new RoomManager();
    this.crypto = new CryptoManager();
    this.storageManager = null;
    this.networkManager = null;
    this.isStarted = false;
  }

  // Create new room and start client
  async createRoom(username) {
    try {
      console.log(`🚀 Creating room for ${username}...`);
      
      // Create encrypted room
      const result = await this.roomManager.createRoom(username);
      if (!result.success) {
        throw new Error(result.error);
      }

      // Initialize storage for this room
      this.storageManager = new StorageManager(result.roomId);
      await this.storageManager.init();

      // Initialize networking
      this.networkManager = new NetworkManager(this.roomManager, this.crypto);
      this.setupNetworkEvents();

      // Start networking
      await this.networkManager.start();
      
      this.isStarted = true;
      console.log(`✅ Room created: ${result.roomId}`);
      
      return {
        success: true,
        roomKey: result.roomKey,
        roomId: result.roomId
      };
      
    } catch (error) {
      console.error('❌ Failed to create room:', error);
      return { success: false, error: error.message };
    }
  }

  // Join existing room and start client
  async joinRoom(roomKey, username) {
    try {
      console.log(`🚀 Joining room with ${username}...`);
      
      // Join room with provided key
      const result = await this.roomManager.joinRoom(roomKey, username);
      if (!result.success) {
        throw new Error(result.error);
      }

      // Initialize storage for this room
      this.storageManager = new StorageManager(result.roomId);
      await this.storageManager.init();

      // Load existing messages
      const messages = await this.storageManager.getMessages();
      console.log(`📚 Loaded ${messages.length} cached messages`);

      // Initialize networking
      this.networkManager = new NetworkManager(this.roomManager, this.crypto);
      this.setupNetworkEvents();

      // Start networking
      await this.networkManager.start();
      
      this.isStarted = true;
      console.log(`✅ Joined room: ${result.roomId}`);
      
      return {
        success: true,
        roomId: result.roomId,
        cachedMessages: messages
      };
      
    } catch (error) {
      console.error('❌ Failed to join room:', error);
      return { success: false, error: error.message };
    }
  }

  // Set up network event handlers
  setupNetworkEvents() {
    // Forward network events to UI
    this.networkManager.on('peer-connected', (peerId) => {
      this.emit('peer-connected', peerId);
    });

    this.networkManager.on('peer-disconnected', (peerId) => {
      this.emit('peer-disconnected', peerId);
    });

    this.networkManager.on('root-peer-connected', (peerId) => {
      this.emit('root-peer-connected', peerId);
      
      // Register room with root peer
      this.registerRoomWithRootPeer(peerId);
    });

    this.networkManager.on('message', async (messageData) => {
      // Store message locally
      await this.storageManager.storeMessage(messageData);
      
      // Forward to UI
      this.emit('message', messageData);
    });
  }

  // Send message to peers
  async sendMessage(text) {
    if (!this.isStarted) {
      throw new Error('Chat client not started');
    }

    const room = this.roomManager.getCurrentRoom();
    const message = {
      text,
      sender: room.username,
      timestamp: Date.now(),
      messageId: this.generateMessageId()
    };

    try {
      // Store message locally first
      await this.storageManager.storeMessage(message);

      // Broadcast to network
      const result = this.networkManager.broadcastMessage(message);
      
      // Emit to UI
      this.emit('message', { ...message, fromSelf: true });
      
      return {
        success: true,
        sentToPeers: result.sentCount,
        sentToRootPeers: result.rootPeerCount
      };
      
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      return { success: false, error: error.message };
    }
  }

  // Register room with root peer
  registerRoomWithRootPeer(rootPeerId) {
    const room = this.roomManager.getCurrentRoom();
    const peerData = this.networkManager.connections.get(rootPeerId);
    
    if (peerData && room) {
      const registrationMessage = {
        type: 'register-room',
        roomId: room.roomId
      };
      
      peerData.connection.write(JSON.stringify(registrationMessage));
      console.log(`🏗️  Registered room with root peer`);
    }
  }

  // Get message history
  async getMessageHistory() {
    if (!this.storageManager) return [];
    return await this.storageManager.getMessages();
  }

  // Get connected peers
  getConnectedPeers() {
    if (!this.networkManager) return [];
    return this.networkManager.getConnectedPeers();
  }

  // Get current room info
  getCurrentRoom() {
    return this.roomManager.getCurrentRoom();
  }

  // Generate unique message ID
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Stop chat client
  async stop() {
    if (!this.isStarted) return;
    
    console.log('🛑 Stopping chat client...');
    
    if (this.networkManager) {
      await this.networkManager.stop();
    }
    
    this.isStarted = false;
    console.log('✅ Chat client stopped');
  }
}
```

### Stage 4.2: Local Storage Manager

**Objective**: Implement local storage for messages and app state.

**File**: `src/storage/StorageManager.js`

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

export class StorageManager {
  constructor(roomId) {
    this.roomId = roomId;
    this.messagesKey = `messages_${roomId}`;
    this.roomInfoKey = `room_info_${roomId}`;
  }

  // Initialize storage
  async init() {
    try {
      console.log(`💾 Initializing storage for room: ${this.roomId}`);
      
      // Ensure room info exists
      const roomInfo = await this.getRoomInfo();
      if (!roomInfo) {
        await this.setRoomInfo({
          roomId: this.roomId,
          createdAt: Date.now(),
          messageCount: 0
        });
      }
      
      console.log(`✅ Storage initialized`);
    } catch (error) {
      console.error('❌ Failed to initialize storage:', error);
      throw error;
    }
  }

  // Store message locally
  async storeMessage(messageData) {
    try {
      const messages = await this.getMessages();
      
      // Add new message
      const newMessage = {
        ...messageData,
        storedAt: Date.now(),
        roomId: this.roomId
      };
      
      messages.push(newMessage);
      
      // Sort by timestamp
      messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      
      // Store updated messages
      await AsyncStorage.setItem(this.messagesKey, JSON.stringify(messages));
      
      // Update room info
      await this.updateRoomInfo({ 
        messageCount: messages.length,
        lastMessage: newMessage,
        lastActivity: Date.now()
      });
      
      console.log(`💾 Message stored locally (${messages.length} total)`);
      
    } catch (error) {
      console.error('❌ Failed to store message:', error);
      throw error;
    }
  }

  // Get all messages for this room
  async getMessages() {
    try {
      const messagesJson = await AsyncStorage.getItem(this.messagesKey);
      return messagesJson ? JSON.parse(messagesJson) : [];
    } catch (error) {
      console.error('❌ Failed to get messages:', error);
      return [];
    }
  }

  // Get room information
  async getRoomInfo() {
    try {
      const roomInfoJson = await AsyncStorage.getItem(this.roomInfoKey);
      return roomInfoJson ? JSON.parse(roomInfoJson) : null;
    } catch (error) {
      console.error('❌ Failed to get room info:', error);
      return null;
    }
  }

  // Set room information
  async setRoomInfo(roomInfo) {
    try {
      await AsyncStorage.setItem(this.roomInfoKey, JSON.stringify(roomInfo));
    } catch (error) {
      console.error('❌ Failed to set room info:', error);
      throw error;
    }
  }

  // Update room information
  async updateRoomInfo(updates) {
    try {
      const currentInfo = await this.getRoomInfo() || {};
      const updatedInfo = { ...currentInfo, ...updates };
      await this.setRoomInfo(updatedInfo);
    } catch (error) {
      console.error('❌ Failed to update room info:', error);
    }
  }

  // Clear all messages (for testing)
  async clearMessages() {
    try {
      await AsyncStorage.removeItem(this.messagesKey);
      await this.updateRoomInfo({ messageCount: 0 });
      console.log('🗑️  Cleared all messages');
    } catch (error) {
      console.error('❌ Failed to clear messages:', error);
    }
  }

  // Get storage stats
  async getStats() {
    try {
      const messages = await this.getMessages();
      const roomInfo = await this.getRoomInfo();
      
      return {
        messageCount: messages.length,
        roomInfo,
        storageKeys: [this.messagesKey, this.roomInfoKey]
      };
    } catch (error) {
      console.error('❌ Failed to get stats:', error);
      return null;
    }
  }
}
```

**Expected Deliverables for Stage 4**:
- ✅ ChatClient orchestration class
- ✅ StorageManager for local persistence
- ✅ Event-driven architecture
- ✅ Message handling and routing

---

## 📱 Stage 5: UI Integration & Screen Implementation

### Stage 5.1: Create Room Screen

**Objective**: Implement room creation with QR code sharing.

**File**: `screens/CreateRoomScreen.js`

```javascript
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
  Clipboard
} from 'react-native';
import { ChatClient } from '../src/chat/ChatClient';

const CreateRoomScreen = ({ navigation }) => {
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
      
      if (result.success) {
        setRoomKey(result.roomKey);
        setRoomCreated(true);
        
        // Navigate to chat screen with client instance
        navigation.navigate('Chat', {
          chatClient,
          roomInfo: {
            roomId: result.roomId,
            roomKey: result.roomKey,
            username: username.trim(),
            isCreator: true
          }
        });
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const shareRoomKey = async () => {
    try {
      await Share.share({
        message: `Join my encrypted chat room!\n\nRoom Key: ${roomKey}\n\nDownload the P2P Chat app and use this key to join.`,
        title: 'P2P Chat Room Key'
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
        <Text style={styles.subtitle}>Share this key with others to let them join:</Text>
        
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
          ⚠️  Keep this key secure! Anyone with this key can join your room.
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
```

### Stage 5.2: Join Room Screen

**File**: `screens/JoinRoomScreen.js`

```javascript
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { ChatClient } from '../src/chat/ChatClient';

const JoinRoomScreen = ({ navigation }) => {
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
      Alert.alert('Error', 'Invalid room key format. Key should be 64 characters.');
      return;
    }

    setLoading(true);

    try {
      const chatClient = new ChatClient();
      const result = await chatClient.joinRoom(roomKey.trim(), username.trim());

      if (result.success) {
        // Navigate to chat screen with client instance
        navigation.navigate('Chat', {
          chatClient,
          roomInfo: {
            roomId: result.roomId,
            roomKey: roomKey.trim(),
            username: username.trim(),
            isCreator: false
          },
          cachedMessages: result.cachedMessages || []
        });
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
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
```

### Stage 5.3: Chat Screen Implementation

**File**: `screens/ChatScreen.js`

```javascript
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar
} from 'react-native';

const ChatScreen = ({ route, navigation }) => {
  const { chatClient, roomInfo, cachedMessages = [] } = route.params;
  const [messages, setMessages] = useState(cachedMessages);
  const [inputText, setInputText] = useState('');
  const [connectedPeers, setConnectedPeers] = useState([]);
  const [isConnectedToRoot, setIsConnectedToRoot] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    // Set up event listeners
    const setupEventListeners = () => {
      chatClient.on('message', (messageData) => {
        setMessages(prev => {
          // Avoid duplicates by checking message ID
          const exists = prev.find(m => m.messageId === messageData.messageId);
          if (exists) return prev;
          
          const newMessages = [...prev, messageData];
          // Sort by timestamp
          return newMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        });
      });

      chatClient.on('peer-connected', (peerId) => {
        console.log(`🤝 Peer connected: ${peerId}`);
        updateConnectedPeers();
      });

      chatClient.on('peer-disconnected', (peerId) => {
        console.log(`👋 Peer disconnected: ${peerId}`);
        updateConnectedPeers();
      });

      chatClient.on('root-peer-connected', (peerId) => {
        console.log(`🏰 Root peer connected: ${peerId}`);
        setIsConnectedToRoot(true);
      });
    };

    const updateConnectedPeers = () => {
      const peers = chatClient.getConnectedPeers();
      setConnectedPeers(peers);
    };

    setupEventListeners();
    updateConnectedPeers();

    // Cleanup on unmount
    return () => {
      chatClient.removeAllListeners();
    };
  }, [chatClient]);

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text) return;

    setInputText('');

    try {
      const result = await chatClient.sendMessage(text);
      if (!result.success) {
        Alert.alert('Error', `Failed to send message: ${result.error}`);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to send message: ${error.message}`);
    }
  };

  const handleLeaveRoom = () => {
    Alert.alert(
      'Leave Room',
      'Are you sure you want to leave this room?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Leave', 
          style: 'destructive',
          onPress: async () => {
            await chatClient.stop();
            navigation.popToTop();
          }
        }
      ]
    );
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }) => {
    const isOwnMessage = item.sender === roomInfo.username || item.fromSelf;
    
    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownBubble : styles.otherBubble
        ]}>
          {!isOwnMessage && (
            <Text style={styles.senderName}>{item.sender}</Text>
          )}
          <Text style={styles.messageText}>{item.text}</Text>
          <Text style={styles.timestamp}>
            {formatTimestamp(item.timestamp)}
            {item.fromSync && ' 📥'}
          </Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={handleLeaveRoom}>
        <Text style={styles.leaveButton}>← Leave</Text>
      </TouchableOpacity>
      
      <View style={styles.headerCenter}>
        <Text style={styles.roomTitle}>🔐 Encrypted Room</Text>
        <Text style={styles.roomSubtitle}>
          {connectedPeers.length} peers connected
          {isConnectedToRoot && ' • Root peer ✅'}
        </Text>
      </View>
      
      <View style={styles.headerRight} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {renderHeader()}
      
      <View style={styles.chatContainer}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item, index) => item.messageId || `msg_${index}`}
          style={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          showsVerticalScrollIndicator={false}
        />
        
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              multiline={true}
              maxLength={1000}
            />
            <TouchableOpacity 
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!inputText.trim()}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  leaveButton: {
    color: '#007AFF',
    fontSize: 16,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  roomTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  roomSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  headerRight: {
    width: 50, // Balance the header
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 15,
  },
  messageContainer: {
    marginVertical: 5,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
  },
  ownBubble: {
    backgroundColor: '#007AFF',
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  senderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  timestamp: {
    fontSize: 10,
    color: '#FFFFFF',
    opacity: 0.7,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#A0A0A0',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

// Update message text color for other messages
styles.messageText = {
  ...styles.messageText,
  color: '#333', // Default color for other messages
};

// Override color for own messages
const ownMessageTextStyle = {
  color: '#FFFFFF',
};

export default ChatScreen;
```

**Expected Deliverables for Stage 5**:
- ✅ Complete UI screens with proper navigation
- ✅ Real-time message display and input
- ✅ Room creation with key sharing
- ✅ Room joining with validation
- ✅ Connection status indicators

---

*This completes Part 2 of the specification. The remaining stages (6-8) covering Root Peer Backend, Testing, and Deployment will be in Part 3. Would you like me to continue with the final part?*