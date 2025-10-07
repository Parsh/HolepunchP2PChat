/**
 * RoomStorage
 * 
 * Simple local persistence for room information using AsyncStorage.
 * Stores list of joined rooms so users can rejoin them after app restart.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const ROOMS_KEY = '@p2p_chat:rooms';

export interface SavedRoom {
  roomId: string;
  roomKey: string;
  name?: string;
  lastActive?: number;
  createdAt: number;
  isCreator: boolean;
}

export class RoomStorage {
  /**
   * Save a room to local storage
   */
  static async saveRoom(room: SavedRoom): Promise<void> {
    try {
      const rooms = await this.getAllRooms();
      
      // Check if room already exists
      const existingIndex = rooms.findIndex(r => r.roomId === room.roomId);
      
      if (existingIndex >= 0) {
        // Update existing room
        rooms[existingIndex] = {
          ...rooms[existingIndex],
          ...room,
          lastActive: Date.now(),
        };
      } else {
        // Add new room
        rooms.push({
          ...room,
          lastActive: Date.now(),
        });
      }
      
      await AsyncStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
      console.log('[RoomStorage] Room saved:', room.roomId.substring(0, 8));
    } catch (error) {
      console.error('[RoomStorage] Failed to save room:', error);
      throw error;
    }
  }

  /**
   * Get all saved rooms
   */
  static async getAllRooms(): Promise<SavedRoom[]> {
    try {
      const data = await AsyncStorage.getItem(ROOMS_KEY);
      if (!data) {
        return [];
      }
      
      const rooms: SavedRoom[] = JSON.parse(data);
      
      // Sort by last active (most recent first)
      rooms.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
      
      return rooms;
    } catch (error) {
      console.error('[RoomStorage] Failed to get rooms:', error);
      return [];
    }
  }

  /**
   * Get a specific room by ID
   */
  static async getRoom(roomId: string): Promise<SavedRoom | null> {
    try {
      const rooms = await this.getAllRooms();
      return rooms.find(r => r.roomId === roomId) || null;
    } catch (error) {
      console.error('[RoomStorage] Failed to get room:', error);
      return null;
    }
  }

  /**
   * Update room's last active timestamp
   */
  static async updateLastActive(roomId: string): Promise<void> {
    try {
      const rooms = await this.getAllRooms();
      const room = rooms.find(r => r.roomId === roomId);
      
      if (room) {
        room.lastActive = Date.now();
        await AsyncStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
      }
    } catch (error) {
      console.error('[RoomStorage] Failed to update last active:', error);
    }
  }

  /**
   * Delete a room
   */
  static async deleteRoom(roomId: string): Promise<void> {
    try {
      const rooms = await this.getAllRooms();
      const filtered = rooms.filter(r => r.roomId !== roomId);
      await AsyncStorage.setItem(ROOMS_KEY, JSON.stringify(filtered));
      console.log('[RoomStorage] Room deleted:', roomId.substring(0, 8));
    } catch (error) {
      console.error('[RoomStorage] Failed to delete room:', error);
      throw error;
    }
  }

  /**
   * Clear all rooms (for testing/debugging)
   */
  static async clearAllRooms(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ROOMS_KEY);
      console.log('[RoomStorage] All rooms cleared');
    } catch (error) {
      console.error('[RoomStorage] Failed to clear rooms:', error);
      throw error;
    }
  }
}
