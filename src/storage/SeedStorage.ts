/**
 * SeedStorage
 * 
 * Manages persistent storage of the Hyperswarm seed.
 * The seed is used to generate a consistent keypair across app restarts,
 * ensuring the user maintains the same peer identity.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import crypto from 'hypercore-crypto';

const SEED_KEY = '@hyperswarm_seed';

export class SeedStorage {
  /**
   * Load existing seed or generate a new one
   * @returns 64-character hex seed string
   */
  static async getOrCreateSeed(): Promise<string> {
    try {
      // Try to load existing seed
      const existingSeed = await AsyncStorage.getItem(SEED_KEY);
      
      if (existingSeed) {
        console.log('[SeedStorage] ♻️  Loaded existing seed:', existingSeed.substring(0, 16) + '...');
        return existingSeed;
      }

      // Generate new 32-byte seed
      const newSeed = crypto.randomBytes(32).toString('hex');
      
      // Store it
      await AsyncStorage.setItem(SEED_KEY, newSeed);
      console.log('[SeedStorage] 🆕 Generated new seed:', newSeed.substring(0, 16) + '...');
      
      return newSeed;
    } catch (error) {
      console.error('[SeedStorage] Failed to get/create seed:', error);
      throw new Error('Failed to initialize seed');
    }
  }

  /**
   * Clear the stored seed (for testing or account reset)
   */
  static async clearSeed(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SEED_KEY);
      console.log('[SeedStorage] 🗑️  Seed cleared');
    } catch (error) {
      console.error('[SeedStorage] Failed to clear seed:', error);
      throw error;
    }
  }

  /**
   * Check if a seed exists
   */
  static async hasSeed(): Promise<boolean> {
    try {
      const seed = await AsyncStorage.getItem(SEED_KEY);
      return seed !== null;
    } catch (error) {
      console.error('[SeedStorage] Failed to check seed:', error);
      return false;
    }
  }
}
