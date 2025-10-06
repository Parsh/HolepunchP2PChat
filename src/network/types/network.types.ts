/**
 * Network Types for Bare Kit Hyperswarm Implementation
 * 
 * These types define the structure of messages, events, and data
 * exchanged between React Native and the Bare worklet.
 */

/**
 * Keypair for Hyperswarm identity
 */
export interface KeyPair {
  publicKey: string;
  secretKey: string;
}

/**
 * Message structure for P2P communication
 */
export interface P2PMessage {
  id: string;
  roomTopic: string;
  text: string;
  sender: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Peer information
 */
export interface PeerInfo {
  publicKey: string;
  connectedAt: number;
  rooms: string[];
}

/**
 * Room information
 */
export interface RoomInfo {
  topic: string;
  joinedAt: number;
  peerCount: number;
}

/**
 * Worklet events
 */
export interface WorkletReadyEvent {
  type: 'ready';
  publicKey: string;
}

export interface PeerConnectedEvent {
  peerPublicKey: string;
  timestamp: number;
}

export interface PeerDisconnectedEvent {
  peerPublicKey: string;
  timestamp: number;
}

export interface MessageReceivedEvent {
  peerPublicKey: string;
  message: P2PMessage;
  timestamp: number;
}

export interface WorkletErrorEvent {
  error: string;
  context?: string;
  peerPublicKey?: string;
}

/**
 * Event listeners
 */
export type WorkletReadyListener = (event: WorkletReadyEvent) => void;
export type PeerConnectedListener = (event: PeerConnectedEvent) => void;
export type PeerDisconnectedListener = (event: PeerDisconnectedEvent) => void;
export type MessageReceivedListener = (event: MessageReceivedEvent) => void;
export type WorkletErrorListener = (event: WorkletErrorEvent) => void;
