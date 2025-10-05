import Corestore from 'corestore';
import Hyperswarm from 'hyperswarm';
import crypto from 'hypercore-crypto';
import {EventEmitter} from 'events';
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'fs';
import {join} from 'path';
import b4a from 'b4a';

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
      rootPeerCreatedAt: Date.now(),
    };
    this.stats = {
      totalMessages: 0,
      totalRooms: 0,
      activePeers: 0,
    };

    // Ensure storage directory exists
    mkdirSync(storageDir, {recursive: true});
  }

  async start() {
    console.log('🏰 Starting Chat Root Peer...');
    console.log(`📁 Storage directory: ${this.storageDir}`);

    // Load persistent state from previous sessions
    await this.loadState();

    // Restore existing rooms and rejoin their swarms
    await this.restoreRooms();

    // Join the root peer discovery swarm with a well-known topic
    const discoveryTopic = crypto.hash(
      b4a.from('holepunch-root-peer-discovery'),
    );
    console.log('🔍 Joining root peer discovery swarm...');
    this.swarm.join(discoveryTopic, {server: true, client: false});

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
      connectedAt: Date.now(),
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

    conn.on('error', error => {
      console.error(`❌ Connection error with ${peerId}: ${error.message}`);
      this.activePeers.delete(peerId);
      this.stats.activePeers = this.activePeers.size;
    });

    // Handle room discovery and replication
    conn.on('data', data => {
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
        capabilities: [
          'message-storage',
          'room-registry',
          'peer-discovery',
        ],
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
    const {roomId} = message;

    if (!roomId) {
      console.log(`❌ Invalid room registration from ${peerId}`);
      return;
    }

    try {
      // Create room core for this room ID
      const roomCore = await this.getOrCreateRoom(roomId);
      console.log(
        `🏗️  Room ${roomId.slice(0, 16)}... registered by peer ${peerId}`,
      );

      // Track the peer in this room
      const peerData = this.activePeers.get(peerId);
      if (peerData) {
        peerData.rooms.add(roomId);
      }

      this.emit('room-registered', {
        roomId,
        peerId,
        messageCount: roomCore.length,
      });
    } catch (error) {
      console.log(
        `❌ Failed to register room ${roomId.slice(0, 16)}...: ${error.message}`,
      );
    }
  }

  async storeMessage(peerId, request) {
    const {roomName, message} = request;
    console.log(
      `💾 Storing message for room ${roomName.slice(0, 16)}... from peer ${peerId}`,
    );

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
        fromPeer: peerId,
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

      console.log(
        `✅ Message stored in room ${roomName.slice(0, 16)}... (total: ${this.stats.totalMessages})`,
      );

      // Periodically save state (every 10 messages)
      if (this.stats.totalMessages % 10 === 0) {
        await this.saveState();
      }

      this.emit('message-stored', {
        roomName,
        messageCount: roomCore.length,
        totalMessages: this.stats.totalMessages,
      });
    } catch (error) {
      console.error(
        `❌ Failed to store message in room ${roomName.slice(0, 16)}...: ${error.message}`,
      );
    }
  }

  async handleSyncRequest(peerId, request) {
    const {roomName, lastIndex = 0} = request;
    console.log(
      `🔄 Sync request for room ${roomName.slice(0, 16)}... from peer ${peerId} (from index ${lastIndex})`,
    );

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
        totalMessages: roomCore.length,
      };

      const peerData = this.activePeers.get(peerId);
      if (peerData) {
        peerData.connection.write(JSON.stringify(response));
        console.log(`📤 Sent ${messages.length} messages to peer ${peerId}`);
      }
    } catch (error) {
      console.error(
        `❌ Failed to handle sync request from ${peerId}: ${error.message}`,
      );
    }
  }

  async getOrCreateRoom(roomName, isRestore = false) {
    if (!this.roomCores.has(roomName)) {
      if (!isRestore) {
        console.log(`📁 Creating storage for new room: ${roomName.slice(0, 16)}...`);
      }

      // Create a writable core for root peer storage (root peer owns the data)
      const roomCore = this.corestore.get({name: `room-${roomName}`});
      await roomCore.ready();

      this.roomCores.set(roomName, roomCore);
      this.stats.totalRooms = this.roomCores.size;

      // Add to persistent state if it's a new room
      if (!this.persistentState.rooms.has(roomName)) {
        this.persistentState.rooms.set(roomName, {
          name: roomName,
          messageCount: roomCore.length,
          createdAt: Date.now(),
          lastActivity: Date.now(),
        });
      } else {
        // Update message count from stored core
        const roomInfo = this.persistentState.rooms.get(roomName);
        roomInfo.messageCount = roomCore.length;
        roomInfo.lastActivity = Date.now();
      }

      // Join swarm for this room's discovery
      const roomKey = this.generateRoomKey(roomName);
      this.swarm.join(roomKey, {server: true});
      if (!isRestore) {
        console.log(
          `🔗 Root peer joined swarm for room: ${roomName.slice(0, 16)}...`,
        );
      }

      console.log(
        `✅ Room ${roomName.slice(0, 16)}... ready (${roomCore.length} messages, writable: ${roomCore.writable})`,
      );
    }

    return this.roomCores.get(roomName);
  }

  generateRoomKey(roomName) {
    return crypto.hash(b4a.from(`chat-room-${roomName}`));
  }

  displayStats() {
    console.log('\n📊 === ROOT PEER STATS ===');
    console.log(`🏠 Active rooms: ${this.stats.totalRooms}`);
    console.log(`💬 Total messages stored: ${this.stats.totalMessages}`);
    console.log(`👥 Connected peers: ${this.stats.activePeers}`);
    console.log(`⏰ Uptime: ${Math.floor(process.uptime())} seconds`);

    // Show room details
    for (const [roomName, roomCore] of this.roomCores) {
      const peersInRoom = Array.from(this.activePeers.values()).filter(peer =>
        peer.rooms.has(roomName),
      ).length;
      console.log(
        `  📁 ${roomName.slice(0, 16)}...: ${roomCore.length} messages, ${peersInRoom} peers`,
      );
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
        this.persistentState.rootPeerCreatedAt =
          stateData.rootPeerCreatedAt || Date.now();

        console.log(
          `📂 Loaded persistent state: ${this.persistentState.rooms.size} rooms, ${this.persistentState.totalMessages} total messages`,
        );

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
        lastSaved: Date.now(),
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
        console.log(
          `🏠 Restoring room: ${roomId.slice(0, 16)}... (${roomInfo.messageCount} messages)`,
        );

        // Recreate room core (this will load existing data from storage)
        const roomCore = await this.getOrCreateRoom(roomId, true); // true = isRestore

        console.log(
          `✅ Room ${roomId.slice(0, 16)}... restored with ${roomCore.length} messages`,
        );
      } catch (error) {
        console.error(
          `❌ Failed to restore room ${roomId.slice(0, 16)}...: ${error.message}`,
        );
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
