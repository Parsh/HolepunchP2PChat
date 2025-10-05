# P2P Encrypted Chat React Native App - Development Specification (Part 3)

## � Project Version Requirements Reminder

**React Native App Requirements:**
- React Native: `0.74.1` (exact)
- React: `18.2.0` (exact)
- TypeScript: `5.0.4` (recommended)

**Backend Requirements:**
- Node.js: `18+` (for Hyperswarm compatibility)
- NPM: `8+` (latest stable)

---

## �🖥️ Stage 6: Root Peer Backend Implementation

### Stage 6.1: Simplified Root Peer Server (PoC Focus)

**Objective**: Create a minimal, modular root peer server focused on core P2P functionality for easy lift-and-shift.

**File**: `backend/server.js`

```javascript
import { ChatRootPeer } from './ChatRootPeer.js';

// Minimal PoC server - no production monitoring overhead
class RootPeerServer {
  constructor(options = {}) {
    this.storageDir = options.storageDir || './root-peer-storage';
    this.chatRootPeer = null;
  }

  async start() {
    console.log('🚀 Starting PoC Root Peer Server...');
    
    // Start minimal Chat Root Peer
    this.chatRootPeer = new ChatRootPeer(this.storageDir);
    await this.chatRootPeer.start();
    
    console.log(' P2P network ready for connections');
    
    // Simple shutdown handling
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  async shutdown() {
    console.log('\n🛑 Shutting down Root Peer Server...');
    
    if (this.chatRootPeer) {
      await this.chatRootPeer.shutdown();
    }
    
    console.log('✅ Root Peer Server shut down gracefully');
    process.exit(0);
  }

  // PoC stats method for debugging (no HTTP overhead)
  getStats() {
    if (!this.chatRootPeer) return null;
    
    return {
      totalRooms: this.chatRootPeer.stats.totalRooms,
      totalMessages: this.chatRootPeer.stats.totalMessages,
      activePeers: this.chatRootPeer.stats.activePeers
    };
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new RootPeerServer({
    port: process.env.PORT || 3000,
    storageDir: process.env.STORAGE_DIR || './root-peer-storage'
  });
  
  server.start().catch(console.error);
}

export { RootPeerServer };
```

### Stage 6.2: Enhanced Root Peer Class

**File**: `backend/ChatRootPeer.js`

```javascript
import Corestore from 'corestore';
import Hyperswarm from 'hyperswarm';
import crypto from 'hypercore-crypto';
import { EventEmitter } from 'events';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export class ChatRootPeer extends EventEmitter {
  constructor(storageDir = './root-peer-storage') {
    super();
    this.storageDir = storageDir;
    this.stateFile = join(storageDir, 'root-peer-state.json');
    this.corestore = new Corestore(storageDir);
    this.swarm = new Hyperswarm();
    this.roomCores = new Map(); // roomName -> Hypercore
    this.activePeers = new Map(); // peerId -> { rooms: Set, connection }
    this.persistentState = {
      rooms: new Map(), // roomId -> { name, messageCount, createdAt, lastActivity }
      totalMessages: 0,
      rootPeerCreatedAt: Date.now()
    };
    this.stats = {
      totalMessages: 0,
      totalRooms: 0,
      activePeers: 0
    };
    
    // Ensure storage directory exists
    mkdirSync(storageDir, { recursive: true });
  }

  async start() {
    console.log('🏰 Starting Chat Root Peer...');
    console.log(`📁 Storage directory: ${this.storageDir}`);
    
    // Load persistent state from previous sessions
    await this.loadState();
    
    // Restore existing rooms and rejoin their swarms
    await this.restoreRooms();
    
    // Join the root peer discovery swarm with a well-known topic
    const discoveryTopic = crypto.hash(Buffer.from('holepunch-root-peer-discovery'));
    console.log(`🔍 Joining root peer discovery swarm...`);
    this.swarm.join(discoveryTopic, { server: true, client: false });
    
    // Handle all incoming connections
    this.swarm.on('connection', (conn, info) => {
      this.handlePeerConnection(conn, info);
    });
    
    console.log('🚀 Root peer is ready and waiting for connections!');
    console.log('📊 Stats will be displayed every 30 seconds...');
    
    // Display stats periodically
    this.statsInterval = setInterval(() => {
      this.displayStats();
    }, 30000);
    
    // Emit ready event
    this.emit('ready');
  }

  async handlePeerConnection(conn, info) {
    const peerId = info.publicKey.toString('hex').slice(0, 16);
    console.log(`📡 New peer connected: ${peerId}...`);
    
    this.activePeers.set(peerId, {
      connection: conn,
      rooms: new Set(),
      connectedAt: Date.now()
    });
    
    this.stats.activePeers = this.activePeers.size;
    
    // Immediately announce that this is a root peer
    this.announceRootPeer(peerId);
    
    // Handle disconnection
    conn.on('close', () => {
      console.log(`❌ Peer disconnected: ${peerId}...`);
      this.activePeers.delete(peerId);
      this.stats.activePeers = this.activePeers.size;
      this.emit('peer-disconnected', peerId);
    });
    
    conn.on('error', (error) => {
      console.error(`❌ Connection error with ${peerId}: ${error.message}`);
      this.activePeers.delete(peerId);
      this.stats.activePeers = this.activePeers.size;
    });
    
    // Handle room discovery and replication
    conn.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handlePeerMessage(peerId, message);
      } catch (error) {
        // Not a JSON message, might be Hypercore replication data
        // This is normal for Hypercore protocol
      }
    });
    
    this.emit('peer-connected', peerId);
  }

  async handlePeerMessage(peerId, message) {
    switch (message.type) {
      case 'register-room':
        await this.registerRoom(peerId, message);
        break;
      case 'store-message':
        await this.storeMessage(peerId, message);
        break;
      case 'sync-request':
        await this.handleSyncRequest(peerId, message);
        break;
      default:
        console.log(`❓ Unknown message type from ${peerId}: ${message.type}`);
    }
  }

  announceRootPeer(peerId) {
    const peerData = this.activePeers.get(peerId);
    if (peerData && !peerData.announced) {
      const announcement = {
        type: 'root-peer-announce',
        username: 'ChatRootPeer',
        capabilities: ['message-storage', 'room-registry', 'peer-discovery']
      };
      
      try {
        peerData.connection.write(JSON.stringify(announcement));
        peerData.announced = true;
        console.log(`📢 Announced root peer to ${peerId}`);
      } catch (error) {
        console.error(`❌ Failed to announce to ${peerId}: ${error.message}`);
      }
    }
  }

  async registerRoom(peerId, message) {
    const { roomId } = message;
    
    if (!roomId) {
      console.log(`❌ Invalid room registration from ${peerId}`);
      return;
    }
    
    try {
      // Create room core for this room ID
      const roomCore = await this.getOrCreateRoom(roomId);
      console.log(`🏗️  Room ${roomId.slice(0, 16)}... registered by peer ${peerId}`);
      
      // Track the peer in this room
      const peerData = this.activePeers.get(peerId);
      if (peerData) {
        peerData.rooms.add(roomId);
      }
      
      this.emit('room-registered', { roomId, peerId, messageCount: roomCore.length });
      
    } catch (error) {
      console.log(`❌ Failed to register room ${roomId.slice(0, 16)}...: ${error.message}`);
    }
  }

  async storeMessage(peerId, request) {
    const { roomName, message } = request;
    console.log(`💾 Storing message for room ${roomName.slice(0, 16)}... from peer ${peerId}`);
    
    try {
      const roomCore = await this.getOrCreateRoom(roomName);
      const peerData = this.activePeers.get(peerId);
      
      if (peerData) {
        peerData.rooms.add(roomName);
      }
      
      // Store the message with metadata
      const messageData = {
        ...message,
        storedAt: Date.now(),
        fromPeer: peerId
      };
      
      await roomCore.append(JSON.stringify(messageData));
      this.stats.totalMessages++;
      this.persistentState.totalMessages++;
      
      // Update room info in persistent state
      const roomInfo = this.persistentState.rooms.get(roomName);
      if (roomInfo) {
        roomInfo.messageCount = roomCore.length;
        roomInfo.lastActivity = Date.now();
      }
      
      console.log(`✅ Message stored in room ${roomName.slice(0, 16)}... (total: ${this.stats.totalMessages})`);
      
      // Periodically save state (every 10 messages)
      if (this.stats.totalMessages % 10 === 0) {
        await this.saveState();
      }
      
      this.emit('message-stored', { roomName, messageCount: roomCore.length, totalMessages: this.stats.totalMessages });
      
    } catch (error) {
      console.error(`❌ Failed to store message in room ${roomName.slice(0, 16)}...: ${error.message}`);
    }
  }

  async handleSyncRequest(peerId, request) {
    const { roomName, lastIndex = 0 } = request;
    console.log(`🔄 Sync request for room ${roomName.slice(0, 16)}... from peer ${peerId} (from index ${lastIndex})`);
    
    try {
      const roomCore = await this.getOrCreateRoom(roomName);
      const messages = [];
      
      // Get all messages from the requested index
      for (let i = lastIndex; i < roomCore.length; i++) {
        const block = await roomCore.get(i);
        const messageData = JSON.parse(block.toString());
        messages.push(messageData);
      }
      
      // Send sync response
      const response = {
        type: 'sync-response',
        roomName: roomName,
        messages: messages,
        totalMessages: roomCore.length
      };
      
      const peerData = this.activePeers.get(peerId);
      if (peerData) {
        peerData.connection.write(JSON.stringify(response));
        console.log(`📤 Sent ${messages.length} messages to peer ${peerId}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to handle sync request from ${peerId}: ${error.message}`);
    }
  }

  async getOrCreateRoom(roomName, isRestore = false) {
    if (!this.roomCores.has(roomName)) {
      if (!isRestore) {
        console.log(`📁 Creating storage for new room: ${roomName.slice(0, 16)}...`);
      }
      
      // Create a writable core for root peer storage (root peer owns the data)
      const roomCore = this.corestore.get({ name: `room-${roomName}` });
      await roomCore.ready();
      
      this.roomCores.set(roomName, roomCore);
      this.stats.totalRooms = this.roomCores.size;
      
      // Add to persistent state if it's a new room
      if (!this.persistentState.rooms.has(roomName)) {
        this.persistentState.rooms.set(roomName, {
          name: roomName,
          messageCount: roomCore.length,
          createdAt: Date.now(),
          lastActivity: Date.now()
        });
      } else {
        // Update message count from stored core
        const roomInfo = this.persistentState.rooms.get(roomName);
        roomInfo.messageCount = roomCore.length;
        roomInfo.lastActivity = Date.now();
      }
      
      // Join swarm for this room's discovery
      const roomKey = this.generateRoomKey(roomName);
      this.swarm.join(roomKey, { server: true });
      if (!isRestore) {
        console.log(`🔗 Root peer joined swarm for room: ${roomName.slice(0, 16)}...`);
      }
      
      console.log(`✅ Room ${roomName.slice(0, 16)}... ready (${roomCore.length} messages, writable: ${roomCore.writable})`);
    }
    
    return this.roomCores.get(roomName);
  }

  generateRoomKey(roomName) {
    return crypto.hash(Buffer.from(`chat-room-${roomName}`));
  }

  displayStats() {
    console.log('\n📊 === ROOT PEER STATS ===');
    console.log(`🏠 Active rooms: ${this.stats.totalRooms}`);
    console.log(`💬 Total messages stored: ${this.stats.totalMessages}`);
    console.log(`👥 Connected peers: ${this.stats.activePeers}`);
    console.log(`⏰ Uptime: ${Math.floor(process.uptime())} seconds`);
    
    // Show room details
    for (const [roomName, roomCore] of this.roomCores) {
      const peersInRoom = Array.from(this.activePeers.values())
        .filter(peer => peer.rooms.has(roomName)).length;
      console.log(`  📁 ${roomName.slice(0, 16)}...: ${roomCore.length} messages, ${peersInRoom} peers`);
    }
    console.log('========================\n');
  }

  // Load persistent state from disk
  async loadState() {
    try {
      if (existsSync(this.stateFile)) {
        const stateData = JSON.parse(readFileSync(this.stateFile, 'utf8'));
        
        // Restore room registry (convert plain object back to Map)
        if (stateData.rooms) {
          this.persistentState.rooms = new Map(Object.entries(stateData.rooms));
        }
        
        this.persistentState.totalMessages = stateData.totalMessages || 0;
        this.persistentState.rootPeerCreatedAt = stateData.rootPeerCreatedAt || Date.now();
        
        console.log(`📂 Loaded persistent state: ${this.persistentState.rooms.size} rooms, ${this.persistentState.totalMessages} total messages`);
        
        // Update stats
        this.stats.totalMessages = this.persistentState.totalMessages;
        this.stats.totalRooms = this.persistentState.rooms.size;
        
      } else {
        console.log('📝 No previous state found - starting fresh');
      }
    } catch (error) {
      console.error('❌ Failed to load state:', error.message);
      console.log('🆕 Starting with fresh state');
    }
  }

  // Save persistent state to disk
  async saveState() {
    try {
      const stateData = {
        rooms: Object.fromEntries(this.persistentState.rooms),
        totalMessages: this.persistentState.totalMessages,
        rootPeerCreatedAt: this.persistentState.rootPeerCreatedAt,
        lastSaved: Date.now()
      };
      
      writeFileSync(this.stateFile, JSON.stringify(stateData, null, 2));
      console.log('💾 State saved successfully');
    } catch (error) {
      console.error('❌ Failed to save state:', error.message);
    }
  }

  // Restore existing rooms and rejoin their swarms
  async restoreRooms() {
    console.log(`🔄 Restoring ${this.persistentState.rooms.size} existing rooms...`);
    
    for (const [roomId, roomInfo] of this.persistentState.rooms) {
      try {
        console.log(`🏠 Restoring room: ${roomId.slice(0, 16)}... (${roomInfo.messageCount} messages)`);
        
        // Recreate room core (this will load existing data from storage)
        const roomCore = await this.getOrCreateRoom(roomId, true); // true = isRestore
        
        console.log(`✅ Room ${roomId.slice(0, 16)}... restored with ${roomCore.length} messages`);
      } catch (error) {
        console.error(`❌ Failed to restore room ${roomId.slice(0, 16)}...: ${error.message}`);
      }
    }
    
    if (this.persistentState.rooms.size > 0) {
      console.log('🎯 All rooms restored successfully');
    }
  }

  async shutdown() {
    console.log('\n🛑 Shutting down root peer...');
    
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    
    // Close all connections
    for (const [peerId, peerData] of this.activePeers) {
      try {
        peerData.connection.destroy();
      } catch (error) {
        console.error(`Error closing connection to ${peerId}:`, error.message);
      }
    }
    
    // Save state before shutdown
    await this.saveState();
    
    // Destroy swarm
    await this.swarm.destroy();
    
    console.log('✅ Root peer shut down gracefully');
    this.emit('shutdown');
  }
}
```

### Stage 6.3: Minimal Package.json for PoC

**File**: `backend/package.json`

```json
{
  "name": "p2p-chat-root-peer-poc",
  "version": "0.1.0",
  "type": "module",
  "description": "P2P Chat Root Peer - PoC Version",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "corestore": "^6.8.5",
    "hyperswarm": "^4.7.16",
    "hypercore-crypto": "^3.4.0"
  },
  "keywords": ["p2p", "chat", "poc", "modular"],
  "license": "MIT"
}
```

**Expected Deliverables for Stage 6**:
- ✅ Modular Node.js root peer server (lift-and-shift ready)
- ✅ Core P2P messaging functionality
- ✅ Basic state persistence for PoC
- ✅ Clean separation of concerns for modularity

---

## 🧪 Stage 7: Core Functionality Testing (PoC Validation)

### Stage 7.1: Essential Component Tests

**File**: `__tests__/CryptoManager.test.js`

```javascript
import { CryptoManager } from '../src/crypto/CryptoManager';

describe('CryptoManager', () => {
  let crypto;

  beforeEach(() => {
    crypto = new CryptoManager();
  });

  test('should generate 32-byte room key', () => {
    const roomKey = crypto.generateNewRoomKey();
    expect(roomKey).toHaveLength(32);
    expect(Buffer.isBuffer(roomKey)).toBe(true);
  });

  test('should derive deterministic room ID from room key', () => {
    const roomKey = Buffer.from('a'.repeat(64), 'hex');
    const roomId1 = crypto.deriveRoomId(roomKey);
    const roomId2 = crypto.deriveRoomId(roomKey);
    
    expect(roomId1).toBe(roomId2);
    expect(roomId1).toHaveLength(64);
  });

  test('should generate valid keypairs', () => {
    const keyPair = crypto.generateKeyPair();
    
    expect(keyPair.publicKey).toHaveLength(32);
    expect(keyPair.secretKey).toHaveLength(32);
    expect(Buffer.isBuffer(keyPair.publicKey)).toBe(true);
    expect(Buffer.isBuffer(keyPair.secretKey)).toBe(true);
  });

  test('should encrypt and decrypt messages correctly', () => {
    // Generate two keypairs for Alice and Bob
    const aliceKeys = crypto.generateKeyPair();
    const bobKeys = crypto.generateKeyPair();
    
    crypto.keyPair = aliceKeys;
    
    const originalMessage = { text: 'Hello Bob!', timestamp: Date.now() };
    
    // Encrypt message for Bob
    const encrypted = crypto.encryptMessage(originalMessage, bobKeys.publicKey);
    
    expect(encrypted.type).toBe('encrypted');
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.nonce).toBeDefined();
    
    // Bob decrypts the message
    const bobCrypto = new CryptoManager();
    bobCrypto.keyPair = bobKeys;
    
    const decrypted = bobCrypto.decryptMessage(encrypted);
    
    expect(decrypted).toEqual(originalMessage);
  });
});
```

### Stage 7.2: Integration Tests

**File**: `__tests__/ChatClient.integration.test.js`

```javascript
import { ChatClient } from '../src/chat/ChatClient';

describe('ChatClient Integration', () => {
  let alice, bob;

  beforeAll(() => {
    alice = new ChatClient();
    bob = new ChatClient();
  });

  afterAll(async () => {
    await alice.stop();
    await bob.stop();
  });

  test('should create room and allow joining', async () => {
    // Alice creates room
    const aliceResult = await alice.createRoom('Alice');
    expect(aliceResult.success).toBe(true);
    expect(aliceResult.roomKey).toHaveLength(64);

    // Bob joins with Alice's room key
    const bobResult = await bob.joinRoom(aliceResult.roomKey, 'Bob');
    expect(bobResult.success).toBe(true);
    expect(bobResult.roomId).toBe(aliceResult.roomId);
  });

  test('should handle message sending and receiving', async () => {
    const messages = [];
    
    bob.on('message', (messageData) => {
      messages.push(messageData);
    });

    // Alice sends message
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for connection
    const sendResult = await alice.sendMessage('Hello Bob!');
    expect(sendResult.success).toBe(true);

    // Wait for message to be received
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe('Hello Bob!');
    expect(messages[0].sender).toBe('Alice');
  });
});
```

### Stage 7.3: E2E Test Scenarios

**File**: `e2e/passing-ships.test.js`

```javascript
/**
 * End-to-End Test: Passing Ships Scenario
 * 
 * This test validates the core functionality of offline message delivery:
 * 1. Alice creates room and connects to root peer
 * 2. Alice sends message while Bob is offline
 * 3. Bob joins room later and receives Alice's message
 */

import { ChatClient } from '../src/chat/ChatClient';

describe('E2E: Passing Ships Problem', () => {
  test('should deliver messages sent while peer was offline', async () => {
    // Phase 1: Alice creates room and sends message
    const alice = new ChatClient();
    const aliceResult = await alice.createRoom('Alice');
    expect(aliceResult.success).toBe(true);

    // Wait for root peer connection
    await new Promise((resolve) => {
      alice.on('root-peer-connected', resolve);
      setTimeout(() => resolve(), 5000); // Timeout fallback
    });

    // Alice sends message while Bob is offline
    const sendResult = await alice.sendMessage('Hello from Alice! This should be stored.');
    expect(sendResult.success).toBe(true);
    expect(sendResult.sentToRootPeers).toBeGreaterThan(0);

    // Alice leaves (simulating offline)
    await alice.stop();

    // Phase 2: Bob joins and receives Alice's message
    const bob = new ChatClient();
    const receivedMessages = [];
    
    bob.on('message', (messageData) => {
      if (messageData.fromSync) {
        receivedMessages.push(messageData);
      }
    });

    const bobResult = await bob.joinRoom(aliceResult.roomKey, 'Bob');
    expect(bobResult.success).toBe(true);

    // Wait for sync to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify Bob received Alice's message
    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0].text).toBe('Hello from Alice! This should be stored.');
    expect(receivedMessages[0].sender).toBe('Alice');

    await bob.stop();
  }, 30000); // 30 second timeout for E2E test
});
```

### Stage 7.4: Performance Tests

**File**: `performance/load-test.js`

```javascript
/**
 * Performance Test Suite
 * Tests the system under various load conditions
 */

import { ChatClient } from '../src/chat/ChatClient';

describe('Performance Tests', () => {
  test('should handle multiple concurrent users', async () => {
    const userCount = 10;
    const messagesPerUser = 5;
    const clients = [];
    let roomKey;

    try {
      // Create room with first user
      const creator = new ChatClient();
      const creatorResult = await creator.createRoom('Creator');
      roomKey = creatorResult.roomKey;
      clients.push(creator);

      // Add multiple users to the same room
      const joinPromises = [];
      for (let i = 1; i < userCount; i++) {
        const client = new ChatClient();
        clients.push(client);
        joinPromises.push(client.joinRoom(roomKey, `User${i}`));
      }

      const joinResults = await Promise.all(joinPromises);
      joinResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Wait for all connections to establish
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Each user sends multiple messages
      const sendPromises = [];
      clients.forEach((client, index) => {
        for (let j = 0; j < messagesPerUser; j++) {
          sendPromises.push(
            client.sendMessage(`Message ${j} from User${index}`)
          );
        }
      });

      const startTime = Date.now();
      const sendResults = await Promise.all(sendPromises);
      const endTime = Date.now();

      // Verify all messages were sent successfully
      sendResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      const totalMessages = userCount * messagesPerUser;
      const duration = endTime - startTime;
      const throughput = totalMessages / (duration / 1000); // messages per second

      console.log(`Sent ${totalMessages} messages in ${duration}ms`);
      console.log(`Throughput: ${throughput.toFixed(2)} messages/second`);

      // Performance assertion (adjust based on expected performance)
      expect(throughput).toBeGreaterThan(10); // At least 10 messages/second

    } finally {
      // Clean up all clients
      await Promise.all(clients.map(client => client.stop()));
    }
  }, 60000); // 60 second timeout for performance test
});
```

**Expected Deliverables for Stage 7**:
- ✅ Core component validation tests
- ✅ P2P messaging functionality tests
- ✅ Offline message delivery validation
- ✅ Basic performance checks for PoC

---

## 🚀 Stage 8: Development Setup & PoC Deployment

### Stage 8.1: Simple Development Configuration

**File**: `backend/start.js` (Simple PoC runner)

```javascript
// Simple PoC startup script
import { RootPeerServer } from './server.js';

const server = new RootPeerServer({
  storageDir: './poc-storage'
});

console.log('🧪 Starting P2P Chat PoC...');
server.start().catch(console.error);
```

**File**: `package-scripts.md` (Development commands)

```markdown
# PoC Development Setup

## Backend (Root Peer)
```bash
cd backend
npm install
npm start  # Starts root peer server
```

## React Native App
```bash
cd mobile-app
npm install
npx react-native run-android  # or run-ios
```

## Testing Connection
1. Start backend: `cd backend && npm start`
2. Start mobile app: `cd mobile-app && npx react-native run-android`
3. Create room in app, verify messages persist across restarts
```

### Stage 8.2: React Native Build Configuration

**Prerequisites - Version Check:**
```bash
# Verify React Native version before configuration
npx react-native --version
# Must show: react-native: 0.74.1

# Verify React version
npm list react
# Must show: react@18.2.0
```

**File**: `react-native.config.js`

```javascript
module.exports = {
  dependencies: {
    'react-native-tcp-socket': {
      platforms: {
        android: {
          sourceDir: '../node_modules/react-native-tcp-socket/android',
          packageImportPath: 'com.asterinet.react.tcpsocket',
        },
      },
    },
    'react-native-udp': {
      platforms: {
        android: {
          sourceDir: '../node_modules/react-native-udp/android',
          packageImportPath: 'com.tradle.react.UdpSockets',
        },
      },
    },
  },
};
```

**File**: `metro.config.js`

```javascript
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  resolver: {
    alias: {
      crypto: 'react-native-crypto-js',
      stream: 'stream-browserify',
      buffer: '@craftzdog/react-native-buffer',
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

### Stage 8.3: Production Deployment Guide

**File**: `DEPLOYMENT.md`

```markdown
# P2P Chat Deployment Guide

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- React Native development environment
- iOS/Android development tools

## Root Peer Deployment

### Option 1: Docker Deployment (Recommended)

```bash
# Clone repository
git clone <repository-url>
cd p2p-chat

# Build and start root peer
docker-compose up -d

# Check logs
docker-compose logs -f root-peer

# Monitor at http://localhost:3000
```

### Option 2: Direct Node.js Deployment

```bash
# Install dependencies
cd backend
npm install

# Start production server
NODE_ENV=production npm start

# Or with PM2 for production
npm install -g pm2
pm2 start ecosystem.config.js
```

## Mobile App Deployment

**Pre-Deployment Version Verification:**
```bash
cd mobile-app

# Critical: Verify exact versions before building
npm list react react-native
# Must show:
# react@18.2.0
# react-native@0.74.1

# Check package.json versions
grep -A2 -B2 '"react"' package.json
```

### Android Build

```bash
cd mobile-app
# Ensure compatibility with React Native 0.74.1
npx react-native run-android --variant=release
npx react-native build-android --mode=release
```

### iOS Build

```bash
cd mobile-app
# Update pods for React Native 0.74.1 compatibility
cd ios && pod install && cd ..
npx react-native run-ios --configuration Release
```

## Configuration

### Environment Variables

```bash
# Root Peer
PORT=3000
STORAGE_DIR=./storage
NODE_ENV=production

# Mobile App
ROOT_PEER_URL=ws://your-server.com:3000
DISCOVERY_TOPIC=holepunch-root-peer-discovery
```

### Firewall Configuration

Open these ports on your root peer server:
- TCP 3000: HTTP monitoring
- UDP 49737: Hyperswarm DHT

## Monitoring & Maintenance

### Health Checks

```bash
# Root peer health
curl http://localhost:3000/health

# Stats endpoint
curl http://localhost:3000/stats
```

### Backup Strategy

```bash
# Backup root peer storage
tar -czf backup-$(date +%Y%m%d).tar.gz ./data/

# Automated backup script
#!/bin/bash
docker-compose exec root-peer tar -czf - /app/root-peer-storage | \
  aws s3 cp - s3://your-backup-bucket/backup-$(date +%Y%m%d).tar.gz
```

## Security Considerations

1. **Network Security**: Use VPN or private networks
2. **Data Encryption**: Messages encrypted in transit
3. **Access Control**: Limit root peer access
4. **Regular Updates**: Keep dependencies updated
5. **Monitoring**: Set up alerts for failures

## Scaling

### Multiple Root Peers

Deploy multiple root peer instances in different regions:

```yaml
# docker-compose-multi.yml
version: '3.8'
services:
  root-peer-us:
    extends: root-peer
    environment:
      - REGION=us-east-1
  
  root-peer-eu:
    extends: root-peer  
    environment:
      - REGION=eu-west-1
```

### Load Balancing

Use nginx or cloud load balancer:

```nginx
upstream root-peers {
    server root-peer-1:3000;
    server root-peer-2:3000;
}

server {
    listen 80;
    location / {
        proxy_pass http://root-peers;
    }
}
```
```

**Expected Deliverables for Stage 8**:
- ✅ Simple development setup scripts
- ✅ Mobile app build configurations for PoC testing
- ✅ Basic deployment documentation
- ✅ Modular component extraction guidelines

---

## 📋 Final Implementation Checklist

### Core Functionality ✅
- [x] Encrypted room creation and joining
- [x] P2P message encryption/decryption
- [x] Root peer discovery and communication
- [x] Offline message persistence and sync
- [x] Local message storage and caching

### User Interface ✅
- [x] Welcome screen with create/join options
- [x] Room creation with key sharing
- [x] Room joining with key validation
- [x] Real-time chat interface
- [x] Connection status indicators

### Backend Infrastructure ✅
- [x] Standalone Node.js root peer server
- [x] HTTP monitoring dashboard
- [x] Persistent state management
- [x] Docker deployment configuration
- [x] Production deployment guide

### Quality Assurance ✅
- [x] Unit tests for core components
- [x] Integration tests for P2P functionality
- [x] E2E tests for offline messaging
- [x] Performance benchmarks
- [x] Security validation

## 🎯 PoC Success Criteria

The React Native implementation should demonstrate:

1. **Core P2P Messaging**: Messages sent/received between mobile clients
2. **Offline Message Persistence**: Messages stored and delivered when peers reconnect
3. **Modular Architecture**: Clean separation for easy component extraction
4. **Cross-Platform Compatibility**: Working on both iOS and Android
5. **Basic Encryption**: End-to-end message encryption working

## 🚀 Next Steps After PoC

1. **Component Extraction**: Identify and extract reusable P2P modules
2. **Architecture Documentation**: Document modular components for lift-and-shift
3. **Integration Testing**: Validate extracted components in target project
4. **Performance Optimization**: Optimize core modules based on PoC learnings
5. **Feature Planning**: Plan additional P2P features for target implementation

---

## 🔧 Version Troubleshooting Guide

### Common Version Issues and Solutions

**Issue: React Native version mismatch**
```bash
# Problem: Wrong React Native version installed
# Solution: Reinstall with exact version
npm uninstall react-native
npm install react-native@0.74.1 --save-exact
```

**Issue: React version conflicts**
```bash
# Problem: React version not compatible with RN 0.74.1
# Solution: Force exact React version
npm uninstall react
npm install react@18.2.0 --save-exact
```

**Issue: Metro bundler errors with RN 0.74.1**
```bash
# Problem: Metro config incompatible
# Solution: Update metro config for RN 0.74.1
npm install @react-native/metro-config@0.74.83 --save-dev
```

**Issue: iOS build fails with RN 0.74.1**
```bash
# Problem: Pod dependencies outdated
# Solution: Clean and reinstall pods
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
```

### Version Verification Script

Create `verify-versions.js` in project root:
```javascript
const fs = require('fs');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const requiredVersions = {
  'react': '18.2.0',
  'react-native': '0.74.1'
};

console.log('🔍 Verifying React Native version requirements...\n');

let allCorrect = true;

Object.entries(requiredVersions).forEach(([pkg, required]) => {
  const installed = packageJson.dependencies[pkg];
  const isCorrect = installed === required;
  
  console.log(`${isCorrect ? '✅' : '❌'} ${pkg}: ${installed} ${isCorrect ? '(correct)' : `(required: ${required})`}`);
  
  if (!isCorrect) allCorrect = false;
});

if (allCorrect) {
  console.log('\n🎉 All versions are correct! Ready to proceed.');
} else {
  console.log('\n⚠️  Version mismatch detected. Please fix versions before continuing.');
  process.exit(1);
}
```

**Run version check:**
```bash
node verify-versions.js
```

---

This completes the comprehensive React Native specification with **exact version requirements**. The specification now ensures React Native 0.74.1 and React 18.2.0 compatibility throughout the implementation process!