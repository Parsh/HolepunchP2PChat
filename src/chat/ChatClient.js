import {EventEmitter} from 'events';
import {RoomManager} from '../rooms/RoomManager';
import {CryptoManager} from '../crypto/CryptoManager';
import {NetworkManager} from '../network/NetworkManager';
import {StorageManager} from '../storage/StorageManager';

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
      this.networkManager = new NetworkManager(
        this.roomManager,
        this.roomManager.crypto,
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
      console.error('❌ Failed to create room:', error);
      return {success: false, error: error.message};
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
      this.networkManager = new NetworkManager(
        this.roomManager,
        this.roomManager.crypto,
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
      console.error('❌ Failed to join room:', error);
      return {success: false, error: error.message};
    }
  }

  // Set up network event handlers
  setupNetworkEvents() {
    // Forward network events to UI
    this.networkManager.on('peer-connected', peerId => {
      this.emit('peer-connected', peerId);
    });

    this.networkManager.on('peer-disconnected', peerId => {
      this.emit('peer-disconnected', peerId);
    });

    this.networkManager.on('root-peer-connected', peerId => {
      this.emit('root-peer-connected', peerId);

      // Register room with root peer
      this.registerRoomWithRootPeer(peerId);
    });

    this.networkManager.on('message', async messageData => {
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
      messageId: this.generateMessageId(),
    };

    try {
      // Store message locally first
      await this.storageManager.storeMessage(message);

      // Broadcast to network
      const result = await this.networkManager.broadcastMessage(message);

      // Emit to UI
      this.emit('message', {...message, fromSelf: true});

      return {
        success: true,
        sentToPeers: result.sentCount,
        sentToRootPeers: result.rootPeerCount,
      };
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      return {success: false, error: error.message};
    }
  }

  // Register room with root peer
  registerRoomWithRootPeer(rootPeerId) {
    const room = this.roomManager.getCurrentRoom();
    const peerData = this.networkManager.connections.get(rootPeerId);

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
  async getMessageHistory() {
    if (!this.storageManager) {
      return [];
    }
    return await this.storageManager.getMessages();
  }

  // Get connected peers
  getConnectedPeers() {
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
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Stop chat client
  async stop() {
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
