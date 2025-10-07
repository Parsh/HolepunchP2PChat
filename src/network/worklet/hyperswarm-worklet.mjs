/**
 * Hyperswarm Worklet
 * 
 * This worklet runs in a native Bare runtime with full Node.js compatibility.
 * It handles all P2P networking operations using Hyperswarm.
 * 
 * Communication with React Native happens via RPC over IPC.
 */

import Hyperswarm from 'hyperswarm';
import RPC from 'bare-rpc';
import b4a from 'b4a';
import { Buffer } from 'buffer';
import crypto from 'hypercore-crypto';

// Make Buffer available globally
global.Buffer = Buffer;

// ============================================================================
// Constants
// ============================================================================

const WorkletCommand = {
  GET_KEYS: 1,
  GET_CONNECTED_PEERS: 2,
  JOIN_ROOM: 3,
  LEAVE_ROOM: 4,
  SEND_MESSAGE: 5,
};

const WorkletEvent = {
  READY: 10,
  PEER_CONNECTED: 11,
  PEER_DISCONNECTED: 12,
  MESSAGE_RECEIVED: 13,
  ERROR: 14,
};

// ============================================================================
// State Management
// ============================================================================

class WorkletState {
  constructor() {
    this.swarm = null;
    this.keyPair = null;
    this.connections = new Map(); // peerKey -> connection
    this.rooms = new Map();       // roomTopic -> discovery
    this.peerRooms = new Map();   // peerKey -> Set<roomTopic>
    this.rootPeerConnection = null; // Connection to root peer
    this.rootPeerKey = null;      // Public key of root peer
    this.isConnectedToRootPeer = false;
  }

  addConnection(peerKey, connection) {
    this.connections.set(peerKey, connection);
    if (!this.peerRooms.has(peerKey)) {
      this.peerRooms.set(peerKey, new Set());
    }
  }

  removeConnection(peerKey) {
    this.connections.delete(peerKey);
    this.peerRooms.delete(peerKey);
  }

  getConnection(peerKey) {
    return this.connections.get(peerKey);
  }

  getAllConnections() {
    return Array.from(this.connections.entries());
  }

  hasRoom(roomTopic) {
    return this.rooms.has(roomTopic);
  }

  addRoom(roomTopic, discovery) {
    this.rooms.set(roomTopic, discovery);
  }

  removeRoom(roomTopic) {
    const discovery = this.rooms.get(roomTopic);
    this.rooms.delete(roomTopic);
    return discovery;
  }

  addPeerToRoom(peerKey, roomTopic) {
    const peerRoomSet = this.peerRooms.get(peerKey);
    if (peerRoomSet) {
      peerRoomSet.add(roomTopic);
    }
  }

  removePeerFromRoom(peerKey, roomTopic) {
    const peerRoomSet = this.peerRooms.get(peerKey);
    if (peerRoomSet) {
      peerRoomSet.delete(roomTopic);
    }
  }

  getPeersInRoom(roomTopic) {
    const peers = [];
    for (const [peerKey, rooms] of this.peerRooms.entries()) {
      if (rooms.has(roomTopic)) {
        peers.push(peerKey);
      }
    }
    return peers;
  }

  setRootPeer(peerKey, connection) {
    this.rootPeerConnection = connection;
    this.rootPeerKey = peerKey;
    this.isConnectedToRootPeer = true;
    console.log('[Worklet] 🏰 Connected to root peer:', peerKey.substring(0, 16));
  }

  removeRootPeer() {
    this.rootPeerConnection = null;
    this.rootPeerKey = null;
    this.isConnectedToRootPeer = false;
    console.log('[Worklet] 👋 Disconnected from root peer');
  }
}

const state = new WorkletState();

// ============================================================================
// RPC Communication Layer
// ============================================================================

class RPCManager {
  constructor(ipc) {
    this.rpc = new RPC(ipc, this.handleCommand.bind(this));
  }

  handleCommand(req, error) {
    if (error) {
      console.error('[Worklet] RPC Error:', error);
      return;
    }

    try {
      const data = req.data ? b4a.toString(req.data) : '';
      
      switch (req.command) {
        case WorkletCommand.GET_KEYS:
          this.handleGetKeys(req);
          break;
        
        case WorkletCommand.GET_CONNECTED_PEERS:
          this.handleGetConnectedPeers(req);
          break;
        
        case WorkletCommand.JOIN_ROOM:
          this.handleJoinRoom(req, JSON.parse(data));
          break;
        
        case WorkletCommand.LEAVE_ROOM:
          this.handleLeaveRoom(req, JSON.parse(data));
          break;
        
        case WorkletCommand.SEND_MESSAGE:
          this.handleSendMessage(req, JSON.parse(data));
          break;
        
        default:
          console.warn('[Worklet] Unknown command:', req.command);
          req.reply(JSON.stringify({ error: 'Unknown command' }));
      }
    } catch (error) {
      console.error('[Worklet] Command processing error:', error);
      req.reply(JSON.stringify({ error: error.message }));
    }
  }

  handleGetKeys(req) {
    const keys = {
      publicKey: state.keyPair.publicKey.toString('hex'),
      secretKey: state.keyPair.secretKey.toString('hex'),
    };
    req.reply(JSON.stringify(keys));
  }

  handleGetConnectedPeers(req) {
    const peers = Array.from(state.connections.keys());
    req.reply(JSON.stringify(peers));
  }

  async handleJoinRoom(req, { roomTopic }) {
    try {
      if (state.hasRoom(roomTopic)) {
        req.reply(JSON.stringify({ success: true, alreadyJoined: true }));
        return;
      }

      const discovery = state.swarm.join(Buffer.from(roomTopic, 'hex'), {
        client: true,
        server: true,
      });

      state.addRoom(roomTopic, discovery);
      await state.swarm.flush();

      console.log('[Worklet] Joined room:', roomTopic);
      
      // Register room with root peer if connected
      if (state.isConnectedToRootPeer) {
        registerRoomWithRootPeer(roomTopic);
        
        // Request sync of offline messages
        requestSyncFromRootPeer(roomTopic);
      }

      req.reply(JSON.stringify({ success: true }));
    } catch (error) {
      console.error('[Worklet] Failed to join room:', error);
      req.reply(JSON.stringify({ success: false, error: error.message }));
    }
  }

  async handleLeaveRoom(req, { roomTopic }) {
    try {
      const discovery = state.removeRoom(roomTopic);
      
      if (discovery) {
        await discovery.destroy();
        console.log('[Worklet] Left room:', roomTopic);
      }

      req.reply(JSON.stringify({ success: true }));
    } catch (error) {
      console.error('[Worklet] Failed to leave room:', error);
      req.reply(JSON.stringify({ success: false, error: error.message }));
    }
  }

  handleSendMessage(req, { roomTopic, message, encrypted }) {
    try {
      const peersInRoom = state.getPeersInRoom(roomTopic);
      
      // Wrap message with encryption metadata for P2P transport
      const envelope = {
        roomTopic,
        message,
        encrypted: encrypted || false, // Flag to indicate if content is encrypted
        timestamp: Date.now(),
      };
      
      const messageData = JSON.stringify(envelope);
      let sentCount = 0;

      // Send to all connected peers in the room
      for (const peerKey of peersInRoom) {
        const connection = state.getConnection(peerKey);
        if (connection && peerKey !== state.rootPeerKey) { // Don't send regular messages to root peer
          connection.write(messageData);
          sentCount++;
        }
      }

      // Also store with root peer for offline delivery (message is already encrypted)
      storeMessageWithRootPeer(roomTopic, message);

      const logMsg = encrypted 
        ? `[Worklet] 🔐 Forwarded encrypted message to ${sentCount} peers`
        : `[Worklet] Sent message to ${sentCount} peers`;
      console.log(logMsg, 'in room', roomTopic.substring(0, 16));
      
      req.reply(JSON.stringify({ success: true, sentTo: sentCount, storedWithRootPeer: state.isConnectedToRootPeer }));
    } catch (error) {
      console.error('[Worklet] Failed to send message:', error);
      req.reply(JSON.stringify({ success: false, error: error.message }));
    }
  }

  sendEvent(eventType, payload) {
    const request = this.rpc.request(eventType);
    request.send(JSON.stringify(payload));
  }
}

let rpcManager;

// ============================================================================
// Root Peer Helpers
// ============================================================================

function handleRootPeerAnnouncement(connection, peerKey, data) {
  try {
    const message = JSON.parse(data.toString());
    
    if (message.type === 'root-peer-announce' && message.username === 'ChatRootPeer') {
      console.log('[Worklet] 🏰 Root peer detected!');
      state.setRootPeer(peerKey, connection);
      
      // Register all current rooms with root peer
      for (const [roomTopic] of state.rooms.entries()) {
        registerRoomWithRootPeer(roomTopic);
      }
      
      // Notify React Native
      rpcManager.sendEvent(WorkletEvent.PEER_CONNECTED, {
        peerPublicKey: peerKey,
        timestamp: Date.now(),
        isRootPeer: true,
      });
    }
  } catch (error) {
    // Not a root peer announcement, handle as regular message
  }
}

function registerRoomWithRootPeer(roomTopic) {
  if (!state.isConnectedToRootPeer || !state.rootPeerConnection) {
    console.log('[Worklet] ⚠️ Cannot register room - not connected to root peer');
    return;
  }

  const registrationMessage = {
    type: 'register-room',
    roomId: roomTopic,
  };

  try {
    state.rootPeerConnection.write(JSON.stringify(registrationMessage));
    console.log('[Worklet] 📝 Registered room with root peer:', roomTopic.substring(0, 16));
  } catch (error) {
    console.error('[Worklet] ❌ Failed to register room:', error);
  }
}

function storeMessageWithRootPeer(roomTopic, message) {
  if (!state.isConnectedToRootPeer || !state.rootPeerConnection) {
    return; // No root peer, skip storage
  }

  const storeMessage = {
    type: 'store-message',
    roomName: roomTopic,
    message: message,
  };

  try {
    state.rootPeerConnection.write(JSON.stringify(storeMessage));
    console.log('[Worklet] 💾 Stored message with root peer for room:', roomTopic.substring(0, 16));
  } catch (error) {
    console.error('[Worklet] ❌ Failed to store message with root peer:', error);
  }
}

function requestSyncFromRootPeer(roomTopic) {
  if (!state.isConnectedToRootPeer || !state.rootPeerConnection) {
    return; // No root peer, skip sync
  }

  const syncRequest = {
    type: 'sync-request',
    roomName: roomTopic,
    lastIndex: 0, // Request all messages for now (TODO: track last index)
  };

  try {
    state.rootPeerConnection.write(JSON.stringify(syncRequest));
    console.log('[Worklet] 🔄 Requested sync from root peer for room:', roomTopic.substring(0, 16));
  } catch (error) {
    console.error('[Worklet] ❌ Failed to request sync:', error);
  }
}

// ============================================================================
// Hyperswarm Connection Handlers
// ============================================================================

function setupConnectionHandlers(connection, peerKey) {
  console.log('[Worklet] New connection from:', peerKey);

  // Notify React Native of new connection
  rpcManager.sendEvent(WorkletEvent.PEER_CONNECTED, {
    peerPublicKey: peerKey,
    timestamp: Date.now(),
  });

  // Handle incoming data
  connection.on('data', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('[Worklet] 📨 Received message:', message.type, 'from peer:', peerKey.substring(0, 8));
      
      // Check if this is a root peer announcement
      if (message.type === 'root-peer-announce' && message.username === 'ChatRootPeer') {
        handleRootPeerAnnouncement(connection, peerKey, data);
        return;
      }
      
      // Check if this is a sync response from root peer
      if (message.type === 'sync-response') {
        console.log('[Worklet] 📥 Received sync response:', message.messages?.length || 0, 'messages');
        // Forward each message to React Native
        if (message.messages && message.messages.length > 0) {
          message.messages.forEach((msg) => {
            // Use the original sender's public key from the message, not the root peer's key
            rpcManager.sendEvent(WorkletEvent.MESSAGE_RECEIVED, {
              peerPublicKey: msg.senderPublicKey || state.rootPeerKey || peerKey,
              message: msg,
              timestamp: msg.timestamp || Date.now(),
              fromRootPeer: true,
              encrypted: true, // Messages from root peer are always encrypted
              roomTopic: message.roomName,
            });
          });
        }
        return;
      }
      
      // Regular P2P message - preserve encryption flag
      rpcManager.sendEvent(WorkletEvent.MESSAGE_RECEIVED, {
        peerPublicKey: peerKey,
        message: message.message || message, // Support both envelope and direct format
        timestamp: message.timestamp || Date.now(),
        encrypted: message.encrypted || false,
        roomTopic: message.roomTopic,
      });
    } catch (error) {
      console.error('[Worklet] Failed to parse message:', error);
      rpcManager.sendEvent(WorkletEvent.ERROR, {
        error: 'Failed to parse message',
        context: 'data handler',
        peerPublicKey: peerKey,
      });
    }
  });

  // Handle connection close
  connection.on('close', () => {
    console.log('[Worklet] Connection closed:', peerKey);
    
    // Check if this was the root peer
    if (peerKey === state.rootPeerKey) {
      state.removeRootPeer();
    }
    
    state.removeConnection(peerKey);

    rpcManager.sendEvent(WorkletEvent.PEER_DISCONNECTED, {
      peerPublicKey: peerKey,
      timestamp: Date.now(),
      wasRootPeer: peerKey === state.rootPeerKey,
    });
  });

  // Handle connection errors
  connection.on('error', (error) => {
    console.error('[Worklet] Connection error:', peerKey, error);
    
    rpcManager.sendEvent(WorkletEvent.ERROR, {
      error: error.message,
      context: 'connection error',
      peerPublicKey: peerKey,
    });
  });
}

// ============================================================================
// Initialization
// ============================================================================

async function initializeWorklet() {
  try {
    // Get seed from React Native (passed as argument)
    const seed = Buffer.from(Bare.argv[0], 'hex');

    // Initialize Hyperswarm
    state.swarm = new Hyperswarm({ seed });
    state.keyPair = state.swarm.keyPair;

    console.log('[Worklet] Initialized with public key:', state.keyPair.publicKey.toString('hex'));

    // Set up RPC communication
    const { IPC } = BareKit;
    rpcManager = new RPCManager(IPC);

    // Set up connection handler
    state.swarm.on('connection', (connection, info) => {
      const peerKey = info.publicKey.toString('hex');
      console.log('[Worklet] Connection from peer:', peerKey);
      console.log('[Worklet] Connection info.topics:', info.topics ? info.topics.map(t => t.toString('hex')) : 'none');
      
      state.addConnection(peerKey, connection);
      
      // Associate peer with the rooms they're connecting through
      if (info.topics && info.topics.length > 0) {
        for (const topic of info.topics) {
          const roomTopic = topic.toString('hex');
          console.log('[Worklet] Associating peer', peerKey, 'with room topic:', roomTopic);
          
          // Check if this topic is one of our joined rooms (not our own public key)
          const isRoomTopic = state.hasRoom(roomTopic);
          if (isRoomTopic) {
            state.addPeerToRoom(peerKey, roomTopic);
            console.log('[Worklet] ✅ Peer added to room:', roomTopic);
          } else {
            console.log('[Worklet] ⚠️ Topic is not a joined room:', roomTopic);
          }
        }
      } else {
        console.log('[Worklet] ⚠️ No topics in connection info, checking all rooms...');
        // Fallback: associate with all active rooms
        for (const [roomTopic] of state.rooms.entries()) {
          state.addPeerToRoom(peerKey, roomTopic);
          console.log('[Worklet] 🔄 Added peer to room (fallback):', roomTopic);
        }
      }
      
      setupConnectionHandlers(connection, peerKey);
    });

    // Start listening on own public key
    state.swarm.join(state.keyPair.publicKey, { 
      server: true, 
      client: false 
    });
    
    // Join root peer discovery swarm
    const discoveryTopic = crypto.hash(Buffer.from('holepunch-root-peer-discovery'));
    console.log('[Worklet] 🔍 Joining root peer discovery swarm...');
    state.swarm.join(discoveryTopic, {
      client: true,  // We are a client looking for root peer
      server: false  // We are not a root peer
    });
    
    await state.swarm.flush();

    console.log('[Worklet] Ready and listening');

    // Notify React Native that worklet is ready
    rpcManager.sendEvent(WorkletEvent.READY, {
      type: 'ready',
      publicKey: state.keyPair.publicKey.toString('hex'),
    });

  } catch (error) {
    console.error('[Worklet] Initialization failed:', error);
    throw error;
  }
}

// Start the worklet
initializeWorklet().catch((error) => {
  console.error('[Worklet] Fatal error:', error);
  process.exit(1);
});
