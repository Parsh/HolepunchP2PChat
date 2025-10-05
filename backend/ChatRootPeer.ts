import Corestore from 'corestore';
import Hyperswarm from 'hyperswarm';
import crypto from 'hypercore-crypto';
import { EventEmitter } from 'events';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import b4a from 'b4a';

interface RoomInfo {
  name: string;
  messageCount: number;
  createdAt: number;
  lastActivity: number;
}

interface PeerData {
  connection: any;
  rooms: Set<string>;
  connectedAt: number;
  announced?: boolean;
}

interface PersistentState {
  rooms: Map<string, RoomInfo>;
  totalMessages: number;
  rootPeerCreatedAt: number;
}

interface Stats {
  totalMessages: number;
  totalRooms: number;
  activePeers: number;
}

interface Message {
  type: string;
  roomId?: string;
  roomName?: string;
  message?: any;
  lastIndex?: number;
  [key: string]: any;
}

interface StateData {
  rooms: Record<string, RoomInfo>;
  totalMessages: number;
  rootPeerCreatedAt: number;
  lastSaved?: number;
}

export class ChatRootPeer extends EventEmitter {
  private storageDir: string;
  private stateFile: string;
  private corestore: any;
  private swarm: any;
  private roomCores: Map<string, any>;
  private activePeers: Map<string, PeerData>;
  private persistentState: PersistentState;
  public stats: Stats;
  private statsInterval?: NodeJS.Timeout;

  constructor(storageDir: string = './root-peer-storage') {
    super();
    this.storageDir = storageDir;
    this.stateFile = join(storageDir, 'root-peer-state.json');
    this.corestore = new Corestore(storageDir);
    this.swarm = new Hyperswarm();
    this.roomCores = new Map();
    this.activePeers = new Map();
    this.persistentState = {
      rooms: new Map(),
      totalMessages: 0,
      rootPeerCreatedAt: Date.now(),
    };
    this.stats = {
      totalMessages: 0,
      totalRooms: 0,
      activePeers: 0,
    };

    // Ensure storage directory exists
    mkdirSync(storageDir, { recursive: true });
  }

  async start(): Promise<void> {
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
    this.swarm.join(discoveryTopic, { server: true, client: false });

    // Handle all incoming connections
    this.swarm.on('connection', (conn: any, info: any) => {
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

  async handlePeerConnection(conn: any, info: any): Promise<void> {
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

    conn.on('error', (error: Error) => {
      console.error(`❌ Connection error with ${peerId}: ${error.message}`);
      this.activePeers.delete(peerId);
      this.stats.activePeers = this.activePeers.size;
    });

    // Handle room discovery and replication
    conn.on('data', (data: Buffer) => {
      try {
        const message: Message = JSON.parse(data.toString());
        this.handlePeerMessage(peerId, message);
      } catch (error) {
        // Not a JSON message, might be Hypercore replication data
        // This is normal for Hypercore protocol
      }
    });

    this.emit('peer-connected', peerId);
  }

  async handlePeerMessage(peerId: string, message: Message): Promise<void> {
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

  announceRootPeer(peerId: string): void {
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Failed to announce to ${peerId}: ${errorMessage}`);
      }
    }
  }

  async registerRoom(peerId: string, message: Message): Promise<void> {
    const { roomId } = message;

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(
        `❌ Failed to register room ${roomId.slice(0, 16)}...: ${errorMessage}`,
      );
    }
  }

  async storeMessage(peerId: string, request: Message): Promise<void> {
    const { roomName, message } = request;
    if (!roomName) {
      return;
    }

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `❌ Failed to store message in room ${roomName.slice(0, 16)}...: ${errorMessage}`,
      );
    }
  }

  async handleSyncRequest(peerId: string, request: Message): Promise<void> {
    const { roomName, lastIndex = 0 } = request;
    if (!roomName) {
      return;
    }

    console.log(
      `🔄 Sync request for room ${roomName.slice(0, 16)}... from peer ${peerId} (from index ${lastIndex})`,
    );

    try {
      const roomCore = await this.getOrCreateRoom(roomName);
      const messages: any[] = [];

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `❌ Failed to handle sync request from ${peerId}: ${errorMessage}`,
      );
    }
  }

  async getOrCreateRoom(roomName: string, isRestore: boolean = false): Promise<any> {
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
          lastActivity: Date.now(),
        });
      } else {
        // Update message count from stored core
        const roomInfo = this.persistentState.rooms.get(roomName);
        if (roomInfo) {
          roomInfo.messageCount = roomCore.length;
          roomInfo.lastActivity = Date.now();
        }
      }

      // Join swarm for this room's discovery
      const roomKey = this.generateRoomKey(roomName);
      this.swarm.join(roomKey, { server: true });
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

  generateRoomKey(roomName: string): Buffer {
    return crypto.hash(b4a.from(`chat-room-${roomName}`));
  }

  displayStats(): void {
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
  async loadState(): Promise<void> {
    try {
      if (existsSync(this.stateFile)) {
        const stateData: StateData = JSON.parse(readFileSync(this.stateFile, 'utf8'));

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to load state:', errorMessage);
      console.log('🆕 Starting with fresh state');
    }
  }

  // Save persistent state to disk
  async saveState(): Promise<void> {
    try {
      const stateData: StateData = {
        rooms: Object.fromEntries(this.persistentState.rooms),
        totalMessages: this.persistentState.totalMessages,
        rootPeerCreatedAt: this.persistentState.rootPeerCreatedAt,
        lastSaved: Date.now(),
      };

      writeFileSync(this.stateFile, JSON.stringify(stateData, null, 2));
      console.log('💾 State saved successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to save state:', errorMessage);
    }
  }

  // Restore existing rooms and rejoin their swarms
  async restoreRooms(): Promise<void> {
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(
          `❌ Failed to restore room ${roomId.slice(0, 16)}...: ${errorMessage}`,
        );
      }
    }

    if (this.persistentState.rooms.size > 0) {
      console.log('🎯 All rooms restored successfully');
    }
  }

  async shutdown(): Promise<void> {
    console.log('\n🛑 Shutting down root peer...');

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    // Close all connections
    for (const [peerId, peerData] of this.activePeers) {
      try {
        peerData.connection.destroy();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error closing connection to ${peerId}:`, errorMessage);
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
