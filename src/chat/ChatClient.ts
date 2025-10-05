import { EventEmitter } from 'events';
import { RoomManager } from '../rooms/RoomManager';
import { CryptoManager } from '../crypto/CryptoManager';
import { NetworkManager } from '../network/NetworkManager';
import { StorageManager, StoredMessage } from '../storage/StorageManager';

interface CreateRoomResult {
  success: boolean;
  roomKey?: string;
  roomId?: string;
  error?: string;
}

interface JoinRoomResult {
  success: boolean;
  roomId?: string;
  cachedMessages?: StoredMessage[];
  error?: string;
}

interface SendMessageResult {
  success: boolean;
  sentToPeers?: number;
  sentToRootPeers?: number;
  error?: string;
}

interface Message {
  text: string;
  sender: string;
  timestamp: number;
  messageId: string;
}

export class ChatClient extends EventEmitter {
  private roomManager: RoomManager;
  private crypto: CryptoManager;
  private storageManager: StorageManager | null;
  private networkManager: NetworkManager | null;
  private isStarted: boolean;

  constructor() {
    super();
    this.roomManager = new RoomManager();
    this.crypto = new CryptoManager();
    this.storageManager = null;
    this.networkManager = null;
    this.isStarted = false;
  }

  // Create new room and start client
  async createRoom(username: string): Promise<CreateRoomResult> {
    try {
      console.log(`🚀 Creating room for ${username}...`);

      // Create encrypted room
      const result = await this.roomManager.createRoom(username);
      if (!result.success) {
        throw new Error(result.error);
      }

      // Initialize storage for this room
      this.storageManager = new StorageManager(result.roomId!);
      await this.storageManager.init();

      // Initialize networking
      this.networkManager = new NetworkManager(
        this.roomManager,
        (this.roomManager as any).crypto,
      );
      this.setupNetworkEvents();

      // Start networking
      await this.networkManager.start();

      this.isStarted = true;
      console.log(`✅ Room created: ${result.roomId}`);

      return {
        success: true,
        roomKey: result.roomKey,
        roomId: result.roomId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to create room:', error);
      return { success: false, error: errorMessage };
    }
  }

  // Join existing room and start client
  async joinRoom(roomKey: string, username: string): Promise<JoinRoomResult> {
    try {
      console.log(`🚀 Joining room with ${username}...`);

      // Join room with provided key
      const result = await this.roomManager.joinRoom(roomKey, username);
      if (!result.success) {
        throw new Error(result.error);
      }

      // Initialize storage for this room
      this.storageManager = new StorageManager(result.roomId!);
      await this.storageManager.init();

      // Load existing messages
      const messages = await this.storageManager.getMessages();
      console.log(`📚 Loaded ${messages.length} cached messages`);

      // Initialize networking
      this.networkManager = new NetworkManager(
        this.roomManager,
        (this.roomManager as any).crypto,
      );
      this.setupNetworkEvents();

      // Start networking
      await this.networkManager.start();

      this.isStarted = true;
      console.log(`✅ Joined room: ${result.roomId}`);

      return {
        success: true,
        roomId: result.roomId,
        cachedMessages: messages,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to join room:', error);
      return { success: false, error: errorMessage };
    }
  }

  // Set up network event handlers
  private setupNetworkEvents(): void {
    if (!this.networkManager) {
      return;
    }

    // Forward network events to UI
    this.networkManager.on('peer-connected', (peerId: string) => {
      this.emit('peer-connected', peerId);
    });

    this.networkManager.on('peer-disconnected', (peerId: string) => {
      this.emit('peer-disconnected', peerId);
    });

    this.networkManager.on('root-peer-connected', (peerId: string) => {
      this.emit('root-peer-connected', peerId);

      // Register room with root peer
      this.registerRoomWithRootPeer(peerId);
    });

    this.networkManager.on('message', async (messageData: any) => {
      // Store message locally
      if (this.storageManager) {
        await this.storageManager.storeMessage(messageData);
      }

      // Forward to UI
      this.emit('message', messageData);
    });
  }

  // Send message to peers
  async sendMessage(text: string): Promise<SendMessageResult> {
    if (!this.isStarted) {
      throw new Error('Chat client not started');
    }

    if (!this.storageManager || !this.networkManager) {
      throw new Error('Storage or network manager not initialized');
    }

    const room = this.roomManager.getCurrentRoom();
    if (!room) {
      throw new Error('No active room');
    }

    const message: Message = {
      text,
      sender: room.username,
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
    };

    try {
      // Store message locally first
      await this.storageManager.storeMessage(message);

      // Broadcast to network
      const result = await this.networkManager.broadcastMessage(message);

      // Emit to UI
      this.emit('message', { ...message, fromSelf: true });

      return {
        success: true,
        sentToPeers: result.sentCount,
        sentToRootPeers: result.rootPeerCount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to send message:', error);
      return { success: false, error: errorMessage };
    }
  }

  // Register room with root peer
  private registerRoomWithRootPeer(rootPeerId: string): void {
    if (!this.networkManager) {
      return;
    }

    const room = this.roomManager.getCurrentRoom();
    const peerData = (this.networkManager as any).connections.get(rootPeerId);

    if (peerData && room) {
      const registrationMessage = {
        type: 'register-room',
        roomId: room.roomId,
      };

      peerData.connection.write(JSON.stringify(registrationMessage));
      console.log('🏗️  Registered room with root peer');
    }
  }

  // Get message history
  async getMessageHistory(): Promise<StoredMessage[]> {
    if (!this.storageManager) {
      return [];
    }
    return await this.storageManager.getMessages();
  }

  // Get connected peers
  getConnectedPeers(): any[] {
    if (!this.networkManager) {
      return [];
    }
    return this.networkManager.getConnectedPeers();
  }

  // Get current room info
  getCurrentRoom() {
    return this.roomManager.getCurrentRoom();
  }

  // Generate unique message ID
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Stop chat client
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    console.log('🛑 Stopping chat client...');

    if (this.networkManager) {
      await this.networkManager.stop();
    }

    this.isStarted = false;
    console.log('✅ Chat client stopped');
  }
}
