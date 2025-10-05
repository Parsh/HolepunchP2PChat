import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MessageData {
  sender?: string;
  text?: string;
  timestamp?: number;
  [key: string]: any;
}

export interface StoredMessage extends MessageData {
  storedAt: number;
  roomId: string;
}

interface RoomInfo {
  roomId: string;
  createdAt: number;
  messageCount: number;
  lastMessage?: StoredMessage;
  lastActivity?: number;
}

interface StorageStats {
  messageCount: number;
  roomInfo: RoomInfo | null;
  storageKeys: string[];
}

export class StorageManager {
  private roomId: string;
  private messagesKey: string;
  private roomInfoKey: string;

  constructor(roomId: string) {
    this.roomId = roomId;
    this.messagesKey = `messages_${roomId}`;
    this.roomInfoKey = `room_info_${roomId}`;
  }

  // Initialize storage
  async init(): Promise<void> {
    try {
      console.log(`💾 Initializing storage for room: ${this.roomId}`);

      // Ensure room info exists
      const roomInfo = await this.getRoomInfo();
      if (!roomInfo) {
        await this.setRoomInfo({
          roomId: this.roomId,
          createdAt: Date.now(),
          messageCount: 0,
        });
      }

      console.log('✅ Storage initialized');
    } catch (error) {
      console.error('❌ Failed to initialize storage:', error);
      throw error;
    }
  }

  // Store message locally
  async storeMessage(messageData: MessageData): Promise<void> {
    try {
      const messages = await this.getMessages();

      // Add new message
      const newMessage: StoredMessage = {
        ...messageData,
        storedAt: Date.now(),
        roomId: this.roomId,
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
        lastActivity: Date.now(),
      });

      console.log(`💾 Message stored locally (${messages.length} total)`);
    } catch (error) {
      console.error('❌ Failed to store message:', error);
      throw error;
    }
  }

  // Get all messages for this room
  async getMessages(): Promise<StoredMessage[]> {
    try {
      const messagesJson = await AsyncStorage.getItem(this.messagesKey);
      return messagesJson ? JSON.parse(messagesJson) : [];
    } catch (error) {
      console.error('❌ Failed to get messages:', error);
      return [];
    }
  }

  // Get room information
  async getRoomInfo(): Promise<RoomInfo | null> {
    try {
      const roomInfoJson = await AsyncStorage.getItem(this.roomInfoKey);
      return roomInfoJson ? JSON.parse(roomInfoJson) : null;
    } catch (error) {
      console.error('❌ Failed to get room info:', error);
      return null;
    }
  }

  // Set room information
  async setRoomInfo(roomInfo: RoomInfo): Promise<void> {
    try {
      await AsyncStorage.setItem(this.roomInfoKey, JSON.stringify(roomInfo));
    } catch (error) {
      console.error('❌ Failed to set room info:', error);
      throw error;
    }
  }

  // Update room information
  async updateRoomInfo(updates: Partial<RoomInfo>): Promise<void> {
    try {
      const currentInfo = (await this.getRoomInfo()) || {} as RoomInfo;
      const updatedInfo = { ...currentInfo, ...updates };
      await this.setRoomInfo(updatedInfo);
    } catch (error) {
      console.error('❌ Failed to update room info:', error);
    }
  }

  // Clear all messages (for testing)
  async clearMessages(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.messagesKey);
      await this.updateRoomInfo({ messageCount: 0 });
      console.log('🗑️  Cleared all messages');
    } catch (error) {
      console.error('❌ Failed to clear messages:', error);
    }
  }

  // Get storage stats
  async getStats(): Promise<StorageStats | null> {
    try {
      const messages = await this.getMessages();
      const roomInfo = await this.getRoomInfo();

      return {
        messageCount: messages.length,
        roomInfo,
        storageKeys: [this.messagesKey, this.roomInfoKey],
      };
    } catch (error) {
      console.error('❌ Failed to get stats:', error);
      return null;
    }
  }
}
