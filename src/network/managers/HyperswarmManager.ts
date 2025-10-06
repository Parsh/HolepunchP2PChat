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
        this.emit('messageReceived', payload);
        break;
      
      case CommandIds[WorkletEvent.ERROR]:
        this.emit('error', payload);
        break;
      
      default:
        console.warn('[HyperswarmManager] Unknown event type:', eventType);
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

  async joinRoom(roomTopic: string): Promise<{ success: boolean; alreadyJoined?: boolean }> {
    this.ensureInitialized();
    
    console.log('[HyperswarmManager] Joining room:', roomTopic);
    
    const request = this.rpc!.request(CommandIds[WorkletCommand.JOIN_ROOM]);
    request.send(JSON.stringify({ roomTopic }));
    
    const reply = await request.reply();
    const response = JSON.parse(b4a.toString(reply));
    
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

  async sendMessage(roomTopic: string, message: P2PMessage): Promise<{ success: boolean; sentTo: number }> {
    this.ensureInitialized();
    
    console.log('[HyperswarmManager] Sending message to room:', roomTopic);
    
    const request = this.rpc!.request(CommandIds[WorkletCommand.SEND_MESSAGE]);
    request.send(JSON.stringify({ roomTopic, message }));
    
    const reply = await request.reply();
    const response = JSON.parse(b4a.toString(reply));
    
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
