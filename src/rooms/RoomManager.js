import {CryptoManager} from '../crypto/CryptoManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import b4a from 'b4a';

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
        createdAt: Date.now(),
      };

      await AsyncStorage.setItem(`room_${roomId}`, JSON.stringify(roomInfo));

      this.currentRoom = {
        ...roomInfo,
        roomKey: roomKey, // Keep as Buffer for crypto operations
      };

      console.log(`🏗️  Created room: ${roomId}`);
      return {
        roomKey: roomKey.toString('hex'),
        roomId,
        success: true,
      };
    } catch (error) {
      console.error('❌ Failed to create room:', error);
      return {success: false, error: error.message};
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
      const roomKey = b4a.from(roomKeyHex, 'hex');
      const roomId = this.crypto.deriveRoomId(roomKey);

      // Load user keys
      await this.crypto.loadOrGenerateKeys(username);

      // Store room info locally
      const roomInfo = {
        roomId,
        roomKey: roomKeyHex,
        isCreator: false,
        username,
        joinedAt: Date.now(),
      };

      await AsyncStorage.setItem(`room_${roomId}`, JSON.stringify(roomInfo));

      this.currentRoom = {
        ...roomInfo,
        roomKey: roomKey, // Keep as Buffer for crypto operations
      };

      console.log(`🚪 Joined room: ${roomId}`);
      return {
        roomId,
        success: true,
      };
    } catch (error) {
      console.error('❌ Failed to join room:', error);
      return {success: false, error: error.message};
    }
  }

  // Get current room info
  getCurrentRoom() {
    return this.currentRoom;
  }

  // Get room key for swarm joining
  getRoomSwarmKey() {
    if (!this.currentRoom) {
      return null;
    }

    // Generate swarm key from room key (same logic as Node.js version)
    return this.crypto.deriveRoomId(this.currentRoom.roomKey);
  }
}
