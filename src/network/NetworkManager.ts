import Hyperswarm from 'hyperswarm';
import crypto from 'hypercore-crypto';
import { EventEmitter } from 'events';
import b4a from 'b4a';
import { RoomManager } from '../rooms/RoomManager';
import { CryptoManager } from '../crypto/CryptoManager';

interface PeerData {
  connection: any;
  publicKey: Buffer;
  peerId: string;
  connectedAt: number;
  isRootPeer: boolean;
  announced: boolean;
  username?: string;
}

interface Message {
  type: string;
  sender?: string;
  text?: string;
  timestamp?: number;
  encrypted?: boolean;
  publicKey?: string;
  username?: string;
  roomName?: string;
  message?: any;
  messages?: any[];
  lastIndex?: number;
  [key: string]: any;
}

interface BroadcastResult {
  sentCount: number;
  rootPeerCount: number;
}

interface PeerInfo {
  id: string;
  username?: string;
  isRootPeer: boolean;
  connectedAt: number;
}

export class NetworkManager extends EventEmitter {
  private roomManager: RoomManager;
  private crypto: CryptoManager;
  private swarm: any;
  private connections: Map<string, PeerData>;
  private isStarted: boolean;

  constructor(roomManager: RoomManager, cryptoManager: CryptoManager) {
    super();
    this.roomManager = roomManager;
    this.crypto = cryptoManager;
    this.swarm = new Hyperswarm();
    this.connections = new Map();
    this.isStarted = false;
  }

  // Start P2P networking
  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

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
      this.swarm.on('connection', (conn: any, info: any) => {
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
  async joinRoomSwarm(roomKey: Buffer | string): Promise<void> {
    console.log('📡 Joining room swarm...');

    // Use room key as swarm topic (same as Node.js implementation)
    const swarmKey = b4a.isBuffer(roomKey)
      ? roomKey
      : b4a.from(roomKey, 'hex');
    this.swarm.join(swarmKey, { client: true, server: true });
  }

  // Join root peer discovery swarm
  async joinDiscoverySwarm(): Promise<void> {
    console.log('🔍 Joining root peer discovery swarm...');

    // Use well-known discovery topic (same as Node.js implementation)
    const discoveryTopic = crypto.hash(
      b4a.from('holepunch-root-peer-discovery'),
    );
    this.swarm.join(discoveryTopic, { client: true, server: false });
  }

  // Handle new P2P connection
  private handleConnection(connection: any, info: any): void {
    const peerId = info.publicKey.toString('hex');
    console.log(`🤝 Peer connected: ${peerId.slice(0, 16)}...`);

    const peerData: PeerData = {
      connection,
      publicKey: info.publicKey,
      peerId,
      connectedAt: Date.now(),
      isRootPeer: false,
      announced: false,
    };

    this.connections.set(peerId, peerData);

    // Handle incoming messages
    connection.on('data', (data: Buffer) => {
      this.handlePeerMessage(peerId, data);
    });

    // Handle disconnection
    connection.on('close', () => {
      console.log(`👋 Peer disconnected: ${peerId.slice(0, 16)}...`);
      this.connections.delete(peerId);
      this.emit('peer-disconnected', peerId);
    });

    connection.on('error', (error: Error) => {
      console.error(
        `❌ Connection error with ${peerId.slice(0, 16)}: ${error.message}`,
      );
      this.connections.delete(peerId);
    });

    this.emit('peer-connected', peerId);
  }

  // Handle incoming peer messages
  private handlePeerMessage(peerId: string, data: Buffer): void {
    try {
      const message: Message = JSON.parse(data.toString());
      const peerData = this.connections.get(peerId);

      if (!peerData) {
        return;
      }

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
  private handleRootPeerAnnounce(peerId: string, _message: Message): void {
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
  private handlePublicKeyExchange(peerId: string, message: Message): void {
    const peerData = this.connections.get(peerId);
    if (peerData && message.publicKey) {
      peerData.publicKey = b4a.from(message.publicKey, 'base64');
      peerData.username = message.username;
      console.log(`🔑 Exchanged keys with ${message.username}`);
    }
  }

  // Handle incoming chat message
  private async handleChatMessage(peerId: string, message: Message): Promise<void> {
    const peerData = this.connections.get(peerId);
    if (!peerData) {
      return;
    }

    let decryptedMessage: any;

    if (message.encrypted) {
      // Decrypt P2P message
      decryptedMessage = await this.crypto.decryptMessage(message as any);
      if (!decryptedMessage) {
        return;
      }
    } else {
      decryptedMessage = message;
    }

    console.log(`💬 [${decryptedMessage.sender}]: ${decryptedMessage.text}`);
    this.emit('message', {
      ...decryptedMessage,
      peerId,
      timestamp: message.timestamp || Date.now(),
    });
  }

  // Handle sync response from root peer
  private handleSyncResponse(peerId: string, message: Message): void {
    const { messages } = message;
    if (!messages) {
      return;
    }

    console.log(`✅ Synced ${messages.length} messages from root peer`);

    messages.forEach((msg: any) => {
      this.emit('message', {
        ...msg,
        fromSync: true,
        peerId,
      });
    });
  }

  // Send message to all connected peers
  async broadcastMessage(message: any): Promise<BroadcastResult> {
    const room = this.roomManager.getCurrentRoom();
    if (!room) {
      return { sentCount: 0, rootPeerCount: 0 };
    }

    let sentToPeers = 0;
    let sentToRootPeers = 0;

    for (const [peerId, peerData] of this.connections) {
      try {
        if (peerData.isRootPeer) {
          // Send unencrypted to root peer for storage
          const rootPeerMessage = {
            type: 'store-message',
            roomName: room.roomId,
            message: message,
          };
          peerData.connection.write(JSON.stringify(rootPeerMessage));
          sentToRootPeers++;
        } else if (peerData.publicKey) {
          // Send encrypted message to regular peers
          const encryptedMessage = await this.crypto.encryptMessage(
            message,
            peerData.publicKey,
          );
          const messagePayload = {
            type: 'chat-message',
            ...encryptedMessage,
            encrypted: true,
          };
          peerData.connection.write(JSON.stringify(messagePayload));
          sentToPeers++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(
          `Failed to send message to ${peerId.slice(0, 16)}: ${errorMessage}`,
        );
      }
    }

    console.log(
      `📤 Message sent to ${sentToPeers} peers, ${sentToRootPeers} root peers`,
    );
    return { sentCount: sentToPeers, rootPeerCount: sentToRootPeers };
  }

  // Request sync from root peer
  syncWithRootPeer(peerId: string): void {
    const peerData = this.connections.get(peerId);
    const room = this.roomManager.getCurrentRoom();

    if (peerData && room) {
      const syncRequest = {
        type: 'sync-request',
        roomName: room.roomId,
        lastIndex: 0, // For simplicity, sync from beginning
      };

      peerData.connection.write(JSON.stringify(syncRequest));
      console.log(`🔄 Requested sync from root peer: ${peerId.slice(0, 16)}...`);
    }
  }

  // Send public key to peer for encryption setup
  sendPublicKey(peerId: string): void {
    const peerData = this.connections.get(peerId);
    const room = this.roomManager.getCurrentRoom();
    const keyPair = (this.crypto as any).keyPair; // Access private property

    if (peerData && keyPair && room) {
      const keyMessage = {
        type: 'public-key',
        publicKey: keyPair.publicKey.toString('base64'),
        username: room.username,
      };

      peerData.connection.write(JSON.stringify(keyMessage));
    }
  }

  // Get connected peers info
  getConnectedPeers(): PeerInfo[] {
    return Array.from(this.connections.entries()).map(([id, data]) => ({
      id,
      username: data.username,
      isRootPeer: data.isRootPeer,
      connectedAt: data.connectedAt,
    }));
  }

  // Stop networking
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    console.log('🛑 Stopping P2P network...');
    await this.swarm.destroy();
    this.connections.clear();
    this.isStarted = false;
    console.log('✅ P2P network stopped');
  }
}
