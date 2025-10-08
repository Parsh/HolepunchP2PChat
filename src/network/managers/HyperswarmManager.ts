/**
 * HyperswarmManager
 * 
 * Manages the Hyperswarm worklet and provides a clean API for React Native.
 * Handles all communication with the worklet via RPC over IPC.
 * 
 * This is a singleton - use getInstance() to access it.
 */

import { Worklet } from 'react-native-bare-kit';
import RPC from 'bare-rpc';
import b4a from 'b4a';
import bundle from '../worklet/app.bundle.mjs';
import { CommandIds, WorkletCommand, WorkletEvent } from '../constants/rpc-commands';
import { MessageEncryption } from '../../crypto/MessageEncryption';
import type {
  KeyPair,
  P2PMessage,
  WorkletReadyListener,
  PeerConnectedListener,
  PeerDisconnectedListener,
  MessageReceivedListener,
  WorkletErrorListener,
} from '../types/network.types';

// ============================================================================
// Manager Class
// ============================================================================

export class HyperswarmManager {
  private static instance: HyperswarmManager;
  
  private worklet: Worklet;
  private rpc: RPC | null = null;
  private initialized = false;
  
  // Room key storage for encryption/decryption
  // Map: roomId (public topic) -> roomKey (secret for encryption)
  private roomKeys: Map<string, string> = new Map();
  
  // Event listeners
  private listeners = {
    ready: new Set<WorkletReadyListener>(),
    peerConnected: new Set<PeerConnectedListener>(),
    peerDisconnected: new Set<PeerDisconnectedListener>(),
    messageReceived: new Set<MessageReceivedListener>(),
    error: new Set<WorkletErrorListener>(),
  };

  private constructor() {
    this.worklet = new Worklet();
  }

  // --------------------------------------------------------------------------
  // Singleton Pattern
  // --------------------------------------------------------------------------

  static getInstance(): HyperswarmManager {
    if (!HyperswarmManager.instance) {
      HyperswarmManager.instance = new HyperswarmManager();
    }
    return HyperswarmManager.instance;
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  async initialize(seed: string): Promise<void> {
    if (this.initialized) {
      console.log('[HyperswarmManager] Already initialized');
      return;
    }

    try {
      console.log('[HyperswarmManager] Starting worklet...');
      
      await this.worklet.start('/app.bundle', bundle, [seed]);
      
      this.setupRPC();
      this.initialized = true;
      
      console.log('[HyperswarmManager] Initialized successfully');
    } catch (error) {
      console.error('[HyperswarmManager] Initialization failed:', error);
      throw new Error(`Failed to initialize Hyperswarm: ${error.message}`);
    }
  }

  private setupRPC(): void {
    this.rpc = new RPC(this.worklet.IPC, async (req) => {
      try {
        const data = b4a.toString(req.data);
        const payload = JSON.parse(data);
        
        this.handleWorkletEvent(req.command, payload);
      } catch (error) {
        console.error('[HyperswarmManager] Error processing worklet event:', error);
      }
    });
  }

  private handleWorkletEvent(eventType: number, payload: any): void {
    switch (eventType) {
      case CommandIds[WorkletEvent.READY]:
        this.emit('ready', payload);
        break;
      
      case CommandIds[WorkletEvent.PEER_CONNECTED]:
        this.emit('peerConnected', payload);
        break;
      
      case CommandIds[WorkletEvent.PEER_DISCONNECTED]:
        this.emit('peerDisconnected', payload);
        break;
      
      case CommandIds[WorkletEvent.MESSAGE_RECEIVED]:
        // Decrypt message if encrypted
        this.handleMessageReceived(payload);
        break;
      
      case CommandIds[WorkletEvent.ERROR]:
        this.emit('error', payload);
        break;
      
      default:
        console.warn('[HyperswarmManager] Unknown event type:', eventType);
    }
  }

  /**
   * Handle received message - decrypt if encrypted
   */
  private handleMessageReceived(payload: any): void {
    try {
      // Check if message is encrypted (sent from worklet with encrypted flag)
      if (payload.encrypted === true && payload.message) {
        const roomTopic = payload.roomTopic || payload.message.roomTopic;
        const roomKey = this.roomKeys.get(roomTopic);
        
        if (!roomKey) {
          console.error('[HyperswarmManager] ❌ Cannot decrypt - room key not found for:', roomTopic?.substring(0, 16));
          this.emit('error', { error: 'Cannot decrypt message - room key not found' });
          return;
        }
        
        console.log('[HyperswarmManager] 🔓 Decrypting received message...');
        
        // Decrypt the message - handle different formats
        let encryptedData: string;
        
        if (typeof payload.message === 'string') {
          // Direct encrypted string (from P2P messages)
          encryptedData = payload.message;
        } else if (payload.message && typeof payload.message === 'object') {
          // Object with metadata from root peer sync
          // Backend stores as: { message: "encrypted_string", storedAt, fromPeer, senderPublicKey }
          if (payload.message.message && typeof payload.message.message === 'string') {
            encryptedData = payload.message.message;
          } else {
            throw new Error('Could not find encrypted data in message object');
          }
        } else {
          throw new Error('Invalid message format');
        }
        
        const decryptedMessage = MessageEncryption.decrypt(roomKey, encryptedData);
        
        console.log('[HyperswarmManager] ✅ Message decrypted successfully');
        
        // Emit decrypted message
        this.emit('messageReceived', {
          ...payload,
          message: decryptedMessage,
          encrypted: false, // Now decrypted
        });
      } else {
        // Unencrypted message (backwards compatibility)
        this.emit('messageReceived', payload);
      }
    } catch (error) {
      console.error('[HyperswarmManager] ❌ Decryption failed:', error);
      this.emit('error', { 
        error: 'Failed to decrypt message',
        details: error.message,
      });
    }
  }

  // --------------------------------------------------------------------------
  // Commands (React Native → Worklet)
  // --------------------------------------------------------------------------

  async getKeys(): Promise<KeyPair> {
    this.ensureInitialized();
    
    const request = this.rpc!.request(CommandIds[WorkletCommand.GET_KEYS]);
    request.send('');
    
    const reply = await request.reply();
    const response = JSON.parse(b4a.toString(reply));
    
    return response;
  }

  async getConnectedPeers(): Promise<string[]> {
    this.ensureInitialized();
    
    const request = this.rpc!.request(CommandIds[WorkletCommand.GET_CONNECTED_PEERS]);
    request.send('');
    
    const reply = await request.reply();
    const response = JSON.parse(b4a.toString(reply));
    
    return response;
  }

  /**
   * Join a room with encryption
   * @param roomTopic - Room ID (hash of room key) for P2P discovery
   * @param roomKey - 64-char hex room key for message encryption (not sent to worklet)
   * @param lastSyncedIndex - Optional: Last message index already synced (for incremental sync)
   */
  async joinRoom(roomTopic: string, roomKey: string, lastSyncedIndex: number = 0): Promise<{ success: boolean; alreadyJoined?: boolean }> {
    this.ensureInitialized();
    
    // Validate room key format
    if (!MessageEncryption.isValidRoomKey(roomKey)) {
      throw new Error('Invalid room key format - must be 64 hex characters');
    }
    
    // Store room key for encryption/decryption (NOT sent to worklet)
    this.roomKeys.set(roomTopic, roomKey);
    
    console.log('[HyperswarmManager] Joining room:', roomTopic.substring(0, 16), '(with encryption)');
    
    // Send only roomTopic to worklet (room key stays in React Native)
    const request = this.rpc!.request(CommandIds[WorkletCommand.JOIN_ROOM]);
    request.send(JSON.stringify({ roomTopic }));
    
    const reply = await request.reply();
    const response = JSON.parse(b4a.toString(reply));
    
    // After successfully joining, request sync with the provided lastIndex
    if (response.success) {
      console.log('[HyperswarmManager] 🔄 Requesting sync from index:', lastSyncedIndex);
      
      // Request sync in background (don't wait for it)
      this.requestSync(roomTopic, lastSyncedIndex).catch(error => {
        console.error('[HyperswarmManager] Failed to request sync after join:', error);
      });
    }
    
    return response;
  }

  async leaveRoom(roomTopic: string): Promise<{ success: boolean }> {
    this.ensureInitialized();
    
    console.log('[HyperswarmManager] Leaving room:', roomTopic);
    
    const request = this.rpc!.request(CommandIds[WorkletCommand.LEAVE_ROOM]);
    request.send(JSON.stringify({ roomTopic }));
    
    const reply = await request.reply();
    const response = JSON.parse(b4a.toString(reply));
    
    return response;
  }

  /**
   * Send an encrypted message to a room
   * @param roomTopic - Room ID
   * @param message - Message object to encrypt and send
   */
  async sendMessage(roomTopic: string, message: P2PMessage): Promise<{ success: boolean; sentTo: number }> {
    this.ensureInitialized();
    
    // Get room key for encryption
    const roomKey = this.roomKeys.get(roomTopic);
    if (!roomKey) {
      throw new Error('Room key not found - room not joined or key not stored');
    }
    
    console.log('[HyperswarmManager] 🔐 Encrypting and sending message to room:', roomTopic.substring(0, 16));
    
    try {
      // Encrypt message in React Native
      const encryptedData = MessageEncryption.encrypt(roomKey, message);
      
      console.log('[HyperswarmManager] ✅ Message encrypted, size:', encryptedData.length, 'bytes');
      
      // Send encrypted data to worklet (worklet doesn't decrypt, just forwards)
      const request = this.rpc!.request(CommandIds[WorkletCommand.SEND_MESSAGE]);
      request.send(JSON.stringify({ 
        roomTopic, 
        message: encryptedData, // Send encrypted string instead of plain message
        encrypted: true, // Flag to indicate this is encrypted
      }));
      
      const reply = await request.reply();
      const response = JSON.parse(b4a.toString(reply));
      
      return response;
    } catch (error) {
      console.error('[HyperswarmManager] ❌ Encryption failed:', error);
      throw new Error(`Failed to encrypt message: ${error.message}`);
    }
  }

  /**
   * Manually request sync from root peer starting at a specific message index
   * @param roomTopic - Room ID
   * @param lastIndex - Start syncing from this message index (0 = all messages)
   */
  async requestSync(roomTopic: string, lastIndex: number = 0): Promise<{ success: boolean }> {
    this.ensureInitialized();
    
    console.log('[HyperswarmManager] 🔄 Requesting sync from index:', lastIndex, 'for room:', roomTopic.substring(0, 16));
    
    const request = this.rpc!.request(CommandIds[WorkletCommand.REQUEST_SYNC]);
    request.send(JSON.stringify({ roomTopic, lastIndex }));
    
    const reply = await request.reply();
    const response = JSON.parse(b4a.toString(reply));
    
    console.log('[HyperswarmManager] ✅ Sync request sent');
    
    return response;
  }

  // --------------------------------------------------------------------------
  // Event Listeners
  // --------------------------------------------------------------------------

  onReady(listener: WorkletReadyListener): () => void {
    this.listeners.ready.add(listener);
    return () => this.listeners.ready.delete(listener);
  }

  onPeerConnected(listener: PeerConnectedListener): () => void {
    this.listeners.peerConnected.add(listener);
    return () => this.listeners.peerConnected.delete(listener);
  }

  onPeerDisconnected(listener: PeerDisconnectedListener): () => void {
    this.listeners.peerDisconnected.add(listener);
    return () => this.listeners.peerDisconnected.delete(listener);
  }

  onMessageReceived(listener: MessageReceivedListener): () => void {
    this.listeners.messageReceived.add(listener);
    return () => this.listeners.messageReceived.delete(listener);
  }

  onError(listener: WorkletErrorListener): () => void {
    this.listeners.error.add(listener);
    return () => this.listeners.error.delete(listener);
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private emit<K extends keyof typeof this.listeners>(
    event: K,
    payload: any
  ): void {
    const listeners = this.listeners[event];
    listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.error(`[HyperswarmManager] Error in ${event} listener:`, error);
      }
    });
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.rpc) {
      throw new Error('HyperswarmManager not initialized. Call initialize() first.');
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  async destroy(): Promise<void> {
    console.log('[HyperswarmManager] Shutting down...');
    
    // Clear all listeners
    Object.values(this.listeners).forEach(set => set.clear());
    
    // TODO: Add worklet.terminate() if available
    this.initialized = false;
    this.rpc = null;
    
    console.log('[HyperswarmManager] Shutdown complete');
  }
}

// Export singleton instance getter
export default HyperswarmManager.getInstance;
