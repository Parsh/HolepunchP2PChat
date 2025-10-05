# P2P Encrypted Chat React Native App - Development Specification

## 📋 Document Overview

This specification provides a complete, stage-by-stage guide for implementing a React Native version of the P2P Encrypted Chat system. The document is designed for iterative development, where each stage builds upon the previous one.

**Target Architecture:**
- **Frontend**: React Native 0.74.1 app (iOS/Android) with React 18.2.0
- **Backend**: Node.js server running the root peer
- **P2P Layer**: Hyperswarm for peer discovery and connectivity
- **Storage**: Local device storage + root peer persistence

**Critical Version Requirements:**
- **React Native**: 0.74.1 (exactly)
- **React**: 18.2.0 (exactly)
- **Node.js**: 18+ (for backend compatibility)

---

## 🎯 Stage 1: Project Foundation & Basic UI

### Stage 1.1: Project Setup

**Objective**: Create a new React Native project with required dependencies.

**Required Dependencies** (Exact Versions):
```json
{
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.74.1",
    "@react-navigation/native": "^6.1.18",
    "@react-navigation/stack": "^6.4.1",
    "react-native-screens": "^3.37.0",
    "react-native-safe-area-context": "^4.14.1",
    "react-native-vector-icons": "^10.0.0",
    "@react-native-async-storage/async-storage": "^1.24.0",
    "react-native-uuid": "^2.0.1",
    "hyperswarm": "^4.14.0",
    "hypercore-crypto": "^3.4.0",
    "libsodium-wrappers": "^0.7.15",
    "react-native-tcp-socket": "^6.0.6",
    "react-native-udp": "^4.1.5",
    "react-native-fs": "^2.20.0"
  },
  "devDependencies": {
    "@react-native/babel-preset": "0.74.83",
    "@react-native/eslint-config": "0.74.83",
    "@react-native/metro-config": "0.74.83",
    "@react-native/typescript-config": "0.74.83",
    "@types/react": "^18.2.6",
    "typescript": "5.0.4"
  }
}
```

**⚠️ Version Compatibility Notice:**
- React Native 0.74.1 requires exactly React 18.2.0
- Do not use caret (^) for React and React Native versions
- These versions ensure New Architecture compatibility

**Setup Commands**:
```bash
# Create new React Native 0.74.1 project
npx react-native@0.74.1 init P2PChat --version 0.74.1
cd P2PChat

# Verify exact versions are installed
npm list react react-native

# Install additional dependencies
npm install @react-navigation/native@^6.1.18 @react-navigation/stack@^6.4.1
npm install react-native-screens@^3.37.0 react-native-safe-area-context@^4.14.1
npm install @react-native-async-storage/async-storage@^1.24.0
npm install hyperswarm@^4.14.0 libsodium-wrappers@^0.7.15 react-native-fs@^2.20.0

# Install TypeScript support
npm install --save-dev typescript@5.0.4 @types/react@^18.2.6
```

**Version Verification**:
```bash
# Verify React Native version
npx react-native --version
# Should output: react-native-cli: 2.0.1, react-native: 0.74.1

# Verify React version in package.json
cat package.json | grep '"react"'
# Should show: "react": "18.2.0"
```

**Platform-Specific Setup**:
- iOS: Configure Info.plist for network permissions
- Android: Configure AndroidManifest.xml for network permissions

### Stage 1.2: Basic UI Structure

**Objective**: Create the main screen layouts without functionality.

**Screen Structure**:
```
App Navigator
├── SplashScreen
├── WelcomeScreen  
├── CreateRoomScreen
├── JoinRoomScreen
└── ChatScreen
```

**Key Components to Create**:

1. **App.js** - Main navigation container
2. **WelcomeScreen.js** - Choose create/join room
3. **CreateRoomScreen.js** - Generate new room
4. **JoinRoomScreen.js** - Enter room key
5. **ChatScreen.js** - Main chat interface

**Sample Screen Structures**:

```javascript
// WelcomeScreen.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const WelcomeScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔐 P2P Encrypted Chat</Text>
      <Text style={styles.subtitle}>Secure, decentralized messaging</Text>
      
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
```

**Expected Deliverables for Stage 1**:
- ✅ Clean React Native project structure
- ✅ Minimal navigation setup
- ✅ Essential PoC dependencies only
- ✅ Modular folder structure for easy component extraction

---

## 🔑 Stage 2: Core Crypto Module

### Stage 2.1: Crypto Manager Implementation

**Objective**: Implement the cryptographic operations for room management and P2P encryption.

**File**: `src/crypto/CryptoManager.js`

```javascript
import crypto from 'hypercore-crypto';
import sodium from 'sodium-universal';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class CryptoManager {
  constructor() {
    this.keyPair = null;
  }

  // Generate 32-byte encryption key for new rooms
  generateNewRoomKey() {
    return crypto.randomBytes(32);
  }

  // Create deterministic room ID from encryption key
  deriveRoomId(roomKey) {
    if (typeof roomKey === 'string') {
      roomKey = Buffer.from(roomKey, 'hex');
    }
    return crypto.hash(roomKey).toString('hex');
  }

  // Generate keypair for P2P encryption
  generateKeyPair() {
    const publicKey = Buffer.alloc(sodium.crypto_box_PUBLICKEYBYTES);
    const secretKey = Buffer.alloc(sodium.crypto_box_SECRETKEYBYTES);
    sodium.crypto_box_keypair(publicKey, secretKey);
    return { publicKey, secretKey };
  }

  // Load or generate user keys
  async loadOrGenerateKeys(username) {
    const keyPath = `user_keys_${username}`;
    
    try {
      const storedKeys = await AsyncStorage.getItem(keyPath);
      if (storedKeys) {
        const keyData = JSON.parse(storedKeys);
        this.keyPair = {
          publicKey: Buffer.from(keyData.publicKey, 'base64'),
          secretKey: Buffer.from(keyData.secretKey, 'base64')
        };
        console.log(`🔑 Loaded existing keys for ${username}`);
      } else {
        this.keyPair = this.generateKeyPair();
        
        const keyData = {
          publicKey: this.keyPair.publicKey.toString('base64'),
          secretKey: this.keyPair.secretKey.toString('base64'),
          username: username,
          created: Date.now()
        };
        
        await AsyncStorage.setItem(keyPath, JSON.stringify(keyData));
        console.log(`💾 Generated new keys for ${username}`);
      }
      
      return this.keyPair;
    } catch (error) {
      console.error('❌ Failed to load/generate keys:', error);
      throw error;
    }
  }

  // Encrypt message for P2P transmission
  encryptMessage(message, recipientPublicKey) {
    const nonce = Buffer.alloc(sodium.crypto_box_NONCEBYTES);
    sodium.randombytes_buf(nonce);
    
    const plaintext = Buffer.from(JSON.stringify(message));
    const ciphertext = Buffer.alloc(plaintext.length + sodium.crypto_box_MACBYTES);
    
    sodium.crypto_box_easy(
      ciphertext, 
      plaintext, 
      nonce, 
      recipientPublicKey, 
      this.keyPair.secretKey
    );
    
    return {
      type: 'encrypted',
      ciphertext: ciphertext.toString('base64'),
      nonce: nonce.toString('base64'),
      sender: this.keyPair.publicKey.toString('base64')
    };
  }

  // Decrypt message from P2P transmission
  decryptMessage(encryptedData) {
    try {
      const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
      const nonce = Buffer.from(encryptedData.nonce, 'base64');
      const senderPublicKey = Buffer.from(encryptedData.sender, 'base64');
      const plaintext = Buffer.alloc(ciphertext.length - sodium.crypto_box_MACBYTES);
      
      if (sodium.crypto_box_open_easy(
        plaintext, 
        ciphertext, 
        nonce, 
        senderPublicKey, 
        this.keyPair.secretKey
      )) {
        return JSON.parse(plaintext.toString());
      }
      
      throw new Error('Decryption failed');
    } catch (error) {
      console.error('❌ Decryption failed:', error.message);
      return null;
    }
  }

  // Get public key as hex string
  getPublicKeyHex() {
    return this.keyPair ? this.keyPair.publicKey.toString('hex') : null;
  }
}
```

### Stage 2.2: Room Key Management

**Objective**: Implement room creation and joining logic with proper key handling.

**File**: `src/rooms/RoomManager.js`

```javascript
import { CryptoManager } from '../crypto/CryptoManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class RoomManager {
  constructor() {
    this.crypto = new CryptoManager();
    this.currentRoom = null;
  }

  // Create new encrypted room
  async createRoom(username) {
    try {
      // Generate room encryption key
      const roomKey = this.crypto.generateNewRoomKey();
      const roomId = this.crypto.deriveRoomId(roomKey);
      
      // Load user keys
      await this.crypto.loadOrGenerateKeys(username);
      
      // Store room info locally
      const roomInfo = {
        roomId,
        roomKey: roomKey.toString('hex'),
        isCreator: true,
        username,
        createdAt: Date.now()
      };
      
      await AsyncStorage.setItem(`room_${roomId}`, JSON.stringify(roomInfo));
      
      this.currentRoom = {
        ...roomInfo,
        roomKey: roomKey // Keep as Buffer for crypto operations
      };
      
      console.log(`🏗️  Created room: ${roomId}`);
      return {
        roomKey: roomKey.toString('hex'),
        roomId,
        success: true
      };
      
    } catch (error) {
      console.error('❌ Failed to create room:', error);
      return { success: false, error: error.message };
    }
  }

  // Join existing room with room key
  async joinRoom(roomKeyHex, username) {
    try {
      // Validate room key format
      if (!roomKeyHex || roomKeyHex.length !== 64) {
        throw new Error('Invalid room key format');
      }
      
      // Convert hex to Buffer
      const roomKey = Buffer.from(roomKeyHex, 'hex');
      const roomId = this.crypto.deriveRoomId(roomKey);
      
      // Load user keys
      await this.crypto.loadOrGenerateKeys(username);
      
      // Store room info locally
      const roomInfo = {
        roomId,
        roomKey: roomKeyHex,
        isCreator: false,
        username,
        joinedAt: Date.now()
      };
      
      await AsyncStorage.setItem(`room_${roomId}`, JSON.stringify(roomInfo));
      
      this.currentRoom = {
        ...roomInfo,
        roomKey: roomKey // Keep as Buffer for crypto operations
      };
      
      console.log(`🚪 Joined room: ${roomId}`);
      return {
        roomId,
        success: true
      };
      
    } catch (error) {
      console.error('❌ Failed to join room:', error);
      return { success: false, error: error.message };
    }
  }

  // Get current room info
  getCurrentRoom() {
    return this.currentRoom;
  }

  // Get room key for swarm joining
  getRoomSwarmKey() {
    if (!this.currentRoom) return null;
    
    // Generate swarm key from room key (same logic as Node.js version)
    return this.crypto.deriveRoomId(this.currentRoom.roomKey);
  }
}
```

**Expected Deliverables for Stage 2**:
- ✅ Modular crypto module for easy extraction
- ✅ Core message encryption/decryption
- ✅ Room key generation and management
- ✅ Cross-platform compatibility validation

---

## 🌐 Stage 3: Network Layer Implementation

### Stage 3.1: P2P Network Manager

**Objective**: Implement P2P networking using Hyperswarm with React Native compatibility.

**File**: `src/network/NetworkManager.js`

```javascript
import Hyperswarm from 'hyperswarm';
import crypto from 'hypercore-crypto';
import { EventEmitter } from 'events';

export class NetworkManager extends EventEmitter {
  constructor(roomManager, cryptoManager) {
    super();
    this.roomManager = roomManager;
    this.crypto = cryptoManager;
    this.swarm = new Hyperswarm();
    this.connections = new Map(); // peerId -> peerData
    this.isStarted = false;
  }

  // Start P2P networking
  async start() {
    if (this.isStarted) return;
    
    console.log('🌐 Starting P2P network...');
    
    try {
      const room = this.roomManager.getCurrentRoom();
      if (!room) {
        throw new Error('No room available for networking');
      }

      // Join room swarm for peer discovery
      await this.joinRoomSwarm(room.roomKey);
      
      // Join discovery swarm for root peer finding
      await this.joinDiscoverySwarm();
      
      // Handle incoming connections
      this.swarm.on('connection', (conn, info) => {
        this.handleConnection(conn, info);
      });

      this.isStarted = true;
      console.log('✅ P2P network started');
      
    } catch (error) {
      console.error('❌ Failed to start P2P network:', error);
      throw error;
    }
  }

  // Join room-specific swarm
  async joinRoomSwarm(roomKey) {
    console.log('📡 Joining room swarm...');
    
    // Use room key as swarm topic (same as Node.js implementation)
    const swarmKey = Buffer.isBuffer(roomKey) ? roomKey : Buffer.from(roomKey, 'hex');
    this.swarm.join(swarmKey, { client: true, server: true });
  }

  // Join root peer discovery swarm
  async joinDiscoverySwarm() {
    console.log('🔍 Joining root peer discovery swarm...');
    
    // Use well-known discovery topic (same as Node.js implementation)
    const discoveryTopic = crypto.hash(Buffer.from('holepunch-root-peer-discovery'));
    this.swarm.join(discoveryTopic, { client: true, server: false });
  }

  // Handle new P2P connection
  handleConnection(connection, info) {
    const peerId = info.publicKey.toString('hex');
    console.log(`🤝 Peer connected: ${peerId.slice(0, 16)}...`);

    const peerData = {
      connection,
      publicKey: info.publicKey,
      peerId,
      connectedAt: Date.now(),
      isRootPeer: false,
      announced: false
    };

    this.connections.set(peerId, peerData);

    // Handle incoming messages
    connection.on('data', (data) => {
      this.handlePeerMessage(peerId, data);
    });

    // Handle disconnection
    connection.on('close', () => {
      console.log(`👋 Peer disconnected: ${peerId.slice(0, 16)}...`);
      this.connections.delete(peerId);
      this.emit('peer-disconnected', peerId);
    });

    connection.on('error', (error) => {
      console.error(`❌ Connection error with ${peerId.slice(0, 16)}: ${error.message}`);
      this.connections.delete(peerId);
    });

    this.emit('peer-connected', peerId);
  }

  // Handle incoming peer messages
  handlePeerMessage(peerId, data) {
    try {
      const message = JSON.parse(data.toString());
      const peerData = this.connections.get(peerId);

      if (!peerData) return;

      switch (message.type) {
        case 'root-peer-announce':
          this.handleRootPeerAnnounce(peerId, message);
          break;
          
        case 'public-key':
          this.handlePublicKeyExchange(peerId, message);
          break;
          
        case 'chat-message':
          this.handleChatMessage(peerId, message);
          break;
          
        case 'sync-response':
          this.handleSyncResponse(peerId, message);
          break;
          
        default:
          console.log(`❓ Unknown message type: ${message.type}`);
      }
      
    } catch (error) {
      // Not a JSON message, might be Hypercore replication data
      // This is normal for the protocol
    }
  }

  // Handle root peer announcement
  handleRootPeerAnnounce(peerId, message) {
    const peerData = this.connections.get(peerId);
    if (peerData) {
      peerData.isRootPeer = true;
      console.log(`🏰 Connected to root peer: ${peerId.slice(0, 16)}...`);
      
      // Request sync from root peer
      this.syncWithRootPeer(peerId);
      this.emit('root-peer-connected', peerId);
    }
  }

  // Handle public key exchange for P2P encryption
  handlePublicKeyExchange(peerId, message) {
    const peerData = this.connections.get(peerId);
    if (peerData) {
      peerData.publicKey = Buffer.from(message.publicKey, 'base64');
      peerData.username = message.username;
      console.log(`🔑 Exchanged keys with ${message.username}`);
    }
  }

  // Handle incoming chat message
  handleChatMessage(peerId, message) {
    const peerData = this.connections.get(peerId);
    if (!peerData) return;

    let decryptedMessage;
    
    if (message.encrypted) {
      // Decrypt P2P message
      decryptedMessage = this.crypto.decryptMessage(message);
      if (!decryptedMessage) return;
    } else {
      decryptedMessage = message;
    }

    console.log(`💬 [${decryptedMessage.sender}]: ${decryptedMessage.text}`);
    this.emit('message', {
      ...decryptedMessage,
      peerId,
      timestamp: message.timestamp || Date.now()
    });
  }

  // Handle sync response from root peer
  handleSyncResponse(peerId, message) {
    const { messages } = message;
    console.log(`✅ Synced ${messages.length} messages from root peer`);
    
    messages.forEach(msg => {
      this.emit('message', {
        ...msg,
        fromSync: true,
        peerId
      });
    });
  }

  // Send message to all connected peers
  broadcastMessage(message) {
    const room = this.roomManager.getCurrentRoom();
    if (!room) return { sentCount: 0, rootPeerCount: 0 };

    let sentToPeers = 0;
    let sentToRootPeers = 0;

    for (const [peerId, peerData] of this.connections) {
      try {
        if (peerData.isRootPeer) {
          // Send unencrypted to root peer for storage
          const rootPeerMessage = {
            type: 'store-message',
            roomName: room.roomId,
            message: message
          };
          peerData.connection.write(JSON.stringify(rootPeerMessage));
          sentToRootPeers++;
          
        } else if (peerData.publicKey) {
          // Send encrypted message to regular peers
          const encryptedMessage = this.crypto.encryptMessage(message, peerData.publicKey);
          const messagePayload = {
            type: 'chat-message',
            ...encryptedMessage,
            encrypted: true
          };
          peerData.connection.write(JSON.stringify(messagePayload));
          sentToPeers++;
        }
        
      } catch (error) {
        console.error(`Failed to send message to ${peerId.slice(0, 16)}: ${error.message}`);
      }
    }

    console.log(`📤 Message sent to ${sentToPeers} peers, ${sentToRootPeers} root peers`);
    return { sentCount: sentToPeers, rootPeerCount: sentToRootPeers };
  }

  // Request sync from root peer
  syncWithRootPeer(peerId) {
    const peerData = this.connections.get(peerId);
    const room = this.roomManager.getCurrentRoom();
    
    if (peerData && room) {
      const syncRequest = {
        type: 'sync-request',
        roomName: room.roomId,
        lastIndex: 0 // For simplicity, sync from beginning
      };
      
      peerData.connection.write(JSON.stringify(syncRequest));
      console.log(`🔄 Requested sync from root peer: ${peerId.slice(0, 16)}...`);
    }
  }

  // Send public key to peer for encryption setup
  sendPublicKey(peerId) {
    const peerData = this.connections.get(peerId);
    const room = this.roomManager.getCurrentRoom();
    
    if (peerData && this.crypto.keyPair) {
      const keyMessage = {
        type: 'public-key',
        publicKey: this.crypto.keyPair.publicKey.toString('base64'),
        username: room.username
      };
      
      peerData.connection.write(JSON.stringify(keyMessage));
    }
  }

  // Get connected peers info
  getConnectedPeers() {
    return Array.from(this.connections.entries()).map(([id, data]) => ({
      id,
      username: data.username,
      isRootPeer: data.isRootPeer,
      connectedAt: data.connectedAt
    }));
  }

  // Stop networking
  async stop() {
    if (!this.isStarted) return;
    
    console.log('🛑 Stopping P2P network...');
    await this.swarm.destroy();
    this.connections.clear();
    this.isStarted = false;
    console.log('✅ P2P network stopped');
  }
}
```

**Expected Deliverables for Stage 3**:
- ✅ NetworkManager with full P2P functionality
- ✅ Room swarm and discovery swarm joining
- ✅ Root peer discovery and communication
- ✅ P2P message encryption/decryption
- ✅ Message broadcasting and sync handling

---

*This specification continues with Stage 4 (Chat Client Integration), Stage 5 (UI Integration), Stage 6 (Local Storage), Stage 7 (Root Peer Backend), and Stage 8 (Testing & Deployment). Would you like me to continue with the next stages?*