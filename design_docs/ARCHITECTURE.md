# System Architecture

**Last Updated:** October 8, 2025

## Table of Contents

1. [Overview](#overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Component Details](#component-details)
4. [Communication Flow](#communication-flow)
5. [Swarm Discovery & Connectivity](#swarm-discovery--connectivity)
6. [Message Flow Examples](#message-flow-examples)
7. [Key Design Decisions](#key-design-decisions)

---

## Overview

This P2P encrypted chat system is built on three main layers:

1. **React Native App** - User interface and encryption layer
2. **Bare.js Worklet** - Native P2P networking runtime (runs Hyperswarm)
3. **Root Peer Server** - Backend for offline message storage and relay

The architecture separates concerns cleanly:
- **Encryption happens in React Native** (crypto-js AES-256)
- **P2P networking happens in Worklet** (Hyperswarm with native Node.js APIs)
- **Message storage happens in Root Peer** (Hypercore append-only logs)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    REACT NATIVE APP                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   UI Layer   │  │   Crypto     │  │   Storage    │          │
│  │  (Screens)   │  │ (AES-256)    │  │ (AsyncStore) │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
│         └──────────────────┴──────────────────┘                   │
│                            │                                      │
│                  ┌─────────▼─────────┐                           │
│                  │ HyperswarmManager │                           │
│                  │   (Singleton)     │                           │
│                  └─────────┬─────────┘                           │
│                            │ RPC over IPC                        │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Bare Runtime  │
                    │ (Native Process)│
                    └────────┬────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                    BARE.JS WORKLET                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ RPC Manager  │  │  Hyperswarm  │  │ State Store  │          │
│  │ (Commands)   │  │  (P2P Net)   │  │ (Rooms/Peers)│          │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘          │
│         │                  │                                      │
│         │         ┌────────▼────────┐                            │
│         └─────────►  Connection     │                            │
│                   │   Handler       │                            │
│                   └────────┬────────┘                            │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                    P2P Connections
                   (DHT-based discovery)
                             │
          ┌──────────────────┴──────────────────┐
          │                                     │
          ▼                                     ▼
   ┌─────────────┐                      ┌─────────────┐
   │  Other Peers│                      │ Root Peer   │
   │  (Users)    │                      │  (Backend)  │
   └─────────────┘                      └─────────────┘
                                               │
                                        ┌──────▼──────┐
                                        │  Hypercore  │
                                        │  (Storage)  │
                                        └─────────────┘
```

---

## Component Details

### 1. React Native App

#### **HyperswarmManager** (Singleton)
- **File:** `src/network/managers/HyperswarmManager.ts`
- **Purpose:** Main interface for React Native to communicate with the P2P network
- **Responsibilities:**
  - Initialize Bare.js worklet with persistent seed
  - Manage RPC communication with worklet
  - Handle encryption/decryption of messages
  - Store room keys (never sent to worklet)
  - Emit events to UI layer
  
**Key Methods:**
```typescript
initialize(seed: string): Promise<void>
  // Start worklet, setup RPC

joinRoom(roomTopic: string, roomKey: string, lastSyncedIndex: number): Promise<{success: boolean}>
  // Store roomKey, send roomTopic to worklet, request sync

sendMessage(roomTopic: string, message: P2PMessage): Promise<{success: boolean}>
  // Encrypt message with room key, send encrypted data to worklet

requestSync(roomTopic: string, lastIndex: number): Promise<{success: boolean}>
  // Tell worklet to sync messages from specific index

// Event listeners
onReady(listener): void
onPeerConnected(listener): void
onMessageReceived(listener): void
```

**Encryption Layer:**
- Room keys stored in `Map<roomTopic, roomKey>`
- Messages encrypted with AES-256 before sending to worklet
- Received encrypted messages decrypted before passing to UI
- **Worklet never has access to room keys or plaintext messages**

#### **MessageEncryption**
- **File:** `src/crypto/MessageEncryption.ts`
- **Purpose:** AES-256 encryption/decryption
- **Key Functions:**
  ```typescript
  encrypt(roomKey: string, message: any): string
  decrypt(roomKey: string, encryptedData: string): MessageData
  generateRoomKey(): string  // 64 hex chars (32 bytes)
  deriveRoomId(roomKey: string): string  // SHA-256 hash for discovery
  ```

#### **SeedStorage**
- **File:** `src/storage/SeedStorage.ts`
- **Purpose:** Persistent peer identity across app restarts
- **Key Functions:**
  ```typescript
  getOrCreateSeed(): Promise<string>
    // Load from AsyncStorage or generate new 32-byte seed
  clearSeed(): Promise<void>
  ```

#### **UI Screens**
- **WelcomeScreen**: Initialize worklet with persistent seed
- **CreateRoomScreen**: Generate room key, derive room topic
- **JoinRoomScreen**: Accept room key, derive room topic
- **ChatScreen**: Display messages, send encrypted messages

---

### 2. Bare.js Worklet

#### **Overview**
The worklet runs in a native Bare.js runtime (not React Native's JS engine), giving it full access to Node.js APIs like `hyperswarm`, `hypercore-crypto`, and native networking.

**File:** `src/network/worklet/hyperswarm-worklet.mjs`

#### **WorkletState**
Central state management:
```javascript
{
  swarm: Hyperswarm,              // P2P swarm instance
  keyPair: { publicKey, secretKey }, // Peer's crypto identity
  connections: Map,                // peerKey -> connection object
  rooms: Map,                      // roomTopic -> discovery object
  peerRooms: Map,                  // peerKey -> Set<roomTopic>
  rootPeerConnection: Connection,  // Dedicated root peer connection
  rootPeerKey: string,             // Root peer public key
  isConnectedToRootPeer: boolean
}
```

#### **RPC Commands** (React Native → Worklet)
| Command | ID | Purpose |
|---------|-----|---------|
| `GET_KEYS` | 1 | Get peer's public/secret keys |
| `GET_CONNECTED_PEERS` | 2 | List currently connected peers |
| `JOIN_ROOM` | 3 | Join room swarm (discovery) |
| `LEAVE_ROOM` | 4 | Leave room swarm |
| `SEND_MESSAGE` | 5 | Broadcast message to room peers |
| `REQUEST_SYNC` | 6 | Request sync from root peer at specific index |

#### **RPC Events** (Worklet → React Native)
| Event | ID | Payload |
|-------|-----|---------|
| `READY` | 10 | Worklet initialized |
| `PEER_CONNECTED` | 11 | `{ peerKey, roomTopic }` |
| `PEER_DISCONNECTED` | 12 | `{ peerKey }` |
| `MESSAGE_RECEIVED` | 13 | `{ roomTopic, message, encrypted }` |
| `ERROR` | 14 | `{ error, details }` |

#### **Connection Handling**

**Root Peer Discovery:**
1. Worklet joins well-known discovery topic: `hash('holepunch-root-peer-discovery')`
2. First connection received is treated as root peer
3. Root peer announces itself with `{ type: 'root-peer-announcement' }`
4. Worklet stores root peer connection separately

**Room Peer Discovery:**
1. React Native calls `joinRoom(roomTopic, roomKey)`
2. Worklet joins swarm with `roomTopic` (SHA-256 of room key)
3. Hyperswarm DHT discovers all peers announcing same topic
4. Connections established via hole-punching
5. After joining, worklet requests sync from root peer

**Message Broadcasting:**
1. React Native sends encrypted message to worklet
2. Worklet broadcasts to all peers in room
3. Also sends to root peer for offline storage
4. Does NOT decrypt (worklet doesn't have room key)

---

### 3. Root Peer Server (Backend)

#### **ChatRootPeer Class**
- **File:** `backend/ChatRootPeer.ts`
- **Purpose:** Central server for message storage and relay
- **Storage:** Hypercore append-only logs (one per room)

#### **Responsibilities**

**1. Discovery & Announcement:**
```typescript
start(): Promise<void>
  // Join root peer discovery swarm
  // Announce as root peer to all connecting peers
```

**2. Room Management:**
```typescript
handleRegisterRoom(peerId: string, request: Message): Promise<void>
  // Create/load Hypercore for room
  // Associate peer with room
```

**3. Message Storage:**
```typescript
handleMessage(peerId: string, message: Message): Promise<void>
  // Append encrypted message to room's Hypercore
  // Forward to connected room members
  // Message format: { message: "encrypted", storedAt, fromPeer, senderPublicKey }
```

**4. Incremental Sync:**
```typescript
handleSyncRequest(peerId: string, request: Message): Promise<void>
  // Extract: { roomName, lastIndex }
  // Read messages from Hypercore starting at lastIndex
  // Send array of messages: [msg1, msg2, ...]
  // Each message includes messageIndex for tracking
```

#### **Storage Structure**
```
root-peer-storage/
├── root-peer-state.json          # Persistent metadata
├── <room-topic-1>/
│   ├── bitfield
│   ├── data
│   ├── oplog
│   └── tree
├── <room-topic-2>/
│   └── ...
```

**State File:**
```json
{
  "rooms": {
    "room-topic-hash": {
      "name": "room-topic-hash",
      "messageCount": 42,
      "createdAt": 1696723200000,
      "lastActivity": 1696809600000
    }
  },
  "totalMessages": 42,
  "rootPeerCreatedAt": 1696723200000
}
```

---

## Communication Flow

### 1. App Initialization

```
User opens app
    │
    ▼
WelcomeScreen
    │
    ├─► SeedStorage.getOrCreateSeed()
    │   └─► AsyncStorage (persistent seed)
    │
    ▼
HyperswarmManager.initialize(seed)
    │
    ├─► Create Bare.js Worklet
    ├─► Start worklet with seed
    │   └─► worklet.start('/app.bundle', bundle, [seed])
    │
    ▼
Worklet initializes
    │
    ├─► Generate keypair from seed
    ├─► Create Hyperswarm instance
    ├─► Join root peer discovery swarm
    ├─► Emit READY event
    │
    ▼
HyperswarmManager receives READY
    │
    └─► App ready for room operations
```

### 2. Creating a Room

```
User creates room
    │
    ▼
CreateRoomScreen
    │
    ├─► MessageEncryption.generateRoomKey()
    │   └─► Returns: 64-char hex (32 bytes)
    │
    ├─► MessageEncryption.deriveRoomId(roomKey)
    │   └─► Returns: SHA-256(roomKey) as hex
    │
    ▼
HyperswarmManager.joinRoom(roomTopic, roomKey, lastIndex=0)
    │
    ├─► Store roomKey in local Map (NOT sent to worklet)
    ├─► Send RPC: JOIN_ROOM { roomTopic }
    │
    ▼
Worklet receives JOIN_ROOM
    │
    ├─► swarm.join(roomTopic, { server: true, client: true })
    ├─► Listen for connections
    ├─► Reply success to React Native
    │
    ▼
Worklet connects to root peer
    │
    ├─► Root peer sends: { type: 'root-peer-announcement' }
    ├─► Worklet registers room: { type: 'register-room', roomName: roomTopic }
    │
    ▼
Root peer creates Hypercore for room
    │
    ▼
React Native receives success
    │
    └─► Automatically calls requestSync(roomTopic, 0)
        │
        └─► Worklet sends sync-request to root peer
            └─► Root peer returns [] (no messages yet)
```

### 3. Joining an Existing Room

```
User enters room key
    │
    ▼
JoinRoomScreen
    │
    ├─► MessageEncryption.deriveRoomId(roomKey)
    │   └─► Returns: roomTopic
    │
    ▼
HyperswarmManager.joinRoom(roomTopic, roomKey, lastIndex=0)
    │
    ├─► Store roomKey in local Map
    ├─► Send RPC: JOIN_ROOM { roomTopic }
    │
    ▼
Worklet joins swarm
    │
    ├─► Discovers other peers via DHT
    ├─► Establishes P2P connections
    ├─► Emits PEER_CONNECTED events
    │
    ▼
React Native receives PEER_CONNECTED events
    │
    ▼
Worklet sends sync-request to root peer
    │
    └─► Root peer returns all stored messages
        │
        ▼
    Worklet forwards encrypted messages to React Native
        │
        ▼
    HyperswarmManager decrypts messages
        │
        └─► Emits MESSAGE_RECEIVED events with plaintext
            │
            ▼
        ChatScreen displays message history
```

### 4. Sending a Message

```
User types message and sends
    │
    ▼
ChatScreen calls HyperswarmManager.sendMessage()
    │
    ├─► Message object: { text, sender, timestamp }
    │
    ▼
HyperswarmManager.sendMessage(roomTopic, message)
    │
    ├─► Get roomKey from local Map
    ├─► MessageEncryption.encrypt(roomKey, message)
    │   └─► Returns: base64 encrypted string
    │
    ├─► Send RPC: SEND_MESSAGE { roomTopic, message: encrypted, encrypted: true }
    │
    ▼
Worklet receives SEND_MESSAGE
    │
    ├─► Broadcast encrypted string to all room peers
    │   └─► For each peer: conn.write(JSON.stringify({ type: 'message', ... }))
    │
    ├─► Send to root peer for storage
    │   └─► rootPeerConn.write(JSON.stringify({ type: 'message', ... }))
    │
    └─► Reply success to React Native
        │
        ▼
    ChatScreen displays sent message immediately
```

### 5. Receiving a Message

**From Live Peer:**
```
Peer A sends message
    │
    ▼
Peer B's worklet receives on connection
    │
    ├─► Parse: { type: 'message', roomTopic, message: encrypted }
    ├─► Emit RPC event: MESSAGE_RECEIVED
    │   └─► { roomTopic, message: encrypted, encrypted: true }
    │
    ▼
HyperswarmManager receives MESSAGE_RECEIVED
    │
    ├─► Get roomKey from local Map
    ├─► MessageEncryption.decrypt(roomKey, encrypted)
    │   └─► Returns: { text, sender, timestamp }
    │
    ├─► Emit to ChatScreen listeners
    │
    ▼
ChatScreen displays new message
```

**From Root Peer (Offline Messages):**
```
Worklet requests sync
    │
    ▼
Root peer reads from Hypercore
    │
    ├─► For i = lastIndex to length:
    │   └─► messages.push({ message: encrypted, messageIndex: i, ... })
    │
    ├─► Send: { type: 'sync-response', messages: [...] }
    │
    ▼
Worklet receives sync-response
    │
    ├─► For each message:
    │   └─► Emit MESSAGE_RECEIVED { message, encrypted: true }
    │
    ▼
HyperswarmManager decrypts each message
    │
    └─► ChatScreen displays message history
```

---

## Swarm Discovery & Connectivity

### Hyperswarm DHT Overview

Hyperswarm uses a **Distributed Hash Table (DHT)** for peer discovery:

1. **Topic Hashing:** Each room has a unique topic (SHA-256 of room key)
2. **DHT Announce:** Peers announce they're interested in a topic
3. **DHT Lookup:** Peers query DHT for others interested in same topic
4. **Hole Punching:** Hyperswarm establishes direct P2P connections through NAT

### Connection Types

**1. Root Peer Connection (Server/Client Mode)**
```javascript
// Worklet joins discovery swarm
const discoveryTopic = hash('holepunch-root-peer-discovery');
swarm.join(discoveryTopic, { server: false, client: true });

// Root peer joins same swarm
swarm.join(discoveryTopic, { server: true, client: false });
```

**2. Room Peer Connections (Server/Client Mode)**
```javascript
// All room members join as both server and client
swarm.join(roomTopic, { server: true, client: true });
```

### Message Routing

**Broadcast Strategy:**
- When sending a message, worklet broadcasts to **all connected room peers**
- Also sends to **root peer** for storage
- Root peer **forwards to other connected room members** (relay)
- No central routing—fully decentralized mesh network

**Connection States:**
```
Worklet State:
  ├─ connections: Map<peerKey, Connection>
  │    └─ Regular peers (direct P2P)
  │
  ├─ rootPeerConnection: Connection
  │    └─ Special dedicated connection to root peer
  │
  └─ peerRooms: Map<peerKey, Set<roomTopic>>
       └─ Track which rooms each peer belongs to
```

---

## Message Flow Examples

### Example 1: Direct P2P Message (Both Online)

```
Alice (Peer A)                    Hyperswarm DHT                    Bob (Peer B)
     │                                  │                                │
     ├─ Join room topic ───────────────►│                               │
     │                                  │◄──── Join room topic ─────────┤
     │                                  │                                │
     │                                  ├─ Discover peers matching topic │
     │                                  │                                │
     │◄────────────── Establish P2P connection via hole-punching ───────►│
     │                                                                    │
     ├─ Send encrypted message ─────────────────────────────────────────►│
     │                                                                    │
     │                                                           [Decrypt & display]
```

### Example 2: Offline Message via Root Peer

```
Alice (Online)          Root Peer (Backend)                Bob (Offline)
     │                         │                                  │
     ├─ Send message ─────────►│                                 │
     │                         │                                  │
     │                    [Store in Hypercore]                   │
     │                         │                                  │
     │                         │        [Bob comes online] ───────┤
     │                         │◄──── Request sync (lastIndex=0) ─┤
     │                         │                                  │
     │                         ├─ Send stored messages ──────────►│
     │                         │                                  │
     │                         │                         [Decrypt & display]
```

### Example 3: Incremental Sync

```
Alice's Phone (lastIndex=5)         Root Peer
     │                                  │
     │                    [Hypercore has 10 messages]
     │                                  │
     ├─ Request sync (lastIndex=5) ────►│
     │                                  │
     │                            [Read from index 5-10]
     │                                  │
     │◄───── Send messages 5-10 ────────┤
     │                                  │
  [Decrypt & display                    │
   only new messages]                   │
```

---

## Key Design Decisions

### 1. **Why Separate Encryption from P2P Layer?**

**Decision:** Encrypt in React Native, not in worklet.

**Rationale:**
- **Security:** Room keys never leave React Native JS context
- **Flexibility:** Can change encryption without modifying worklet
- **Zero-knowledge storage:** Root peer can't decrypt messages
- **Debugging:** Easy to inspect plaintext in React Native

**Trade-off:** Slight performance overhead (RPC boundary crossing)

### 2. **Why Use Bare.js Worklet Instead of React Native JS?**

**Decision:** Run Hyperswarm in native Bare runtime.

**Rationale:**
- **Native APIs:** Hyperswarm requires Node.js built-ins (net, dgram, dns)
- **Performance:** Native networking faster than polyfills
- **Stability:** Proven Hyperswarm implementation
- **Compatibility:** Direct access to hypercore-crypto, hypercore, etc.

**Trade-off:** Additional complexity (RPC communication, bundling)

### 3. **Why Centralized Root Peer for Decentralized Chat?**

**Decision:** Hybrid architecture with optional root peer.

**Rationale:**
- **Offline messages:** P2P alone can't deliver to offline peers
- **Message history:** New joiners need to sync past messages
- **Relay:** Helps with difficult NAT scenarios
- **Still encrypted:** Root peer stores encrypted data

**Trade-off:** Single point of failure (but optional—direct P2P still works)

### 4. **Why Incremental Sync with lastIndex?**

**Decision:** Client tracks last synced message index.

**Rationale:**
- **Bandwidth:** Avoid re-downloading all messages
- **Performance:** Faster sync for returning users
- **Scalability:** Works with large message histories

**Trade-off:** Client must track sync state (future: persist lastIndex)

### 5. **Why SHA-256 Room Topic from Room Key?**

**Decision:** Public room topic = hash(secret room key)

**Rationale:**
- **Privacy:** Room topic visible in DHT, but can't reverse to get key
- **Discovery:** All room members derive same topic, find each other
- **Security:** Knowing topic ≠ ability to decrypt messages

**Trade-off:** Must share room key out-of-band (QR code, copy-paste)

### 6. **Why Persistent Seed Storage?**

**Decision:** Store peer seed in AsyncStorage across app restarts.

**Rationale:**
- **Identity:** Same peer ID across sessions
- **Message attribution:** "You" vs "Someone else"
- **Future features:** Enables persistent identities, friend lists

**Trade-off:** Seed loss = new identity (future: backup/recovery)

---

## Architecture Benefits

### ✅ **Modularity**
Each layer can be modified independently:
- Swap crypto-js for libsodium without touching worklet
- Replace Hyperswarm with different P2P protocol
- Change UI without affecting networking

### ✅ **Security**
- End-to-end encryption (only sender & recipients have room key)
- Zero-knowledge root peer (stores encrypted blobs)
- Room keys never transmitted over network
- Isolated encryption context (React Native only)

### ✅ **Scalability**
- Incremental sync reduces bandwidth
- Direct P2P reduces server load
- Hypercore append-only logs are efficient
- DHT distributes peer discovery

### ✅ **Performance**
- Native Hyperswarm performance via Bare.js
- Efficient message broadcasting (single write per peer)
- Minimal RPC overhead (binary buffers)

### ✅ **Offline Support**
- Root peer stores messages while peers offline
- Sync on reconnect with incremental updates
- Local message persistence (AsyncStorage adapter ready)

---

## Future Enhancements

### Planned Improvements

1. **Persistent Message Storage**
   - Store messages locally in AsyncStorage
   - Track `lastSyncedIndex` per room
   - Auto-sync only new messages on app restart

2. **Forward Secrecy**
   - Rotate room keys periodically
   - Implement Double Ratchet algorithm
   - Prevent decryption of old messages if key compromised

3. **Message Authentication**
   - Add HMAC to verify sender identity
   - Prevent message tampering
   - Sign with sender's private key

4. **Multiple Root Peers**
   - Support failover between root peers
   - Distribute storage load
   - Improve reliability

5. **Push Notifications**
   - Root peer sends push when offline user has messages
   - Background sync on notification tap

6. **File Sharing**
   - Encrypt and transmit files over P2P
   - Store file hashes in messages
   - Download from any room peer (torrent-like)

---

## Conclusion

This architecture provides a robust foundation for P2P encrypted messaging with:
- **Clear separation of concerns** (UI, crypto, networking, storage)
- **Strong security guarantees** (E2E encryption, zero-knowledge storage)
- **Efficient communication** (incremental sync, direct P2P)
- **Good developer experience** (TypeScript, modular components)

The hybrid approach (P2P + root peer) balances decentralization with practical offline message delivery, making it suitable for real-world chat applications.

---

*For implementation details, see:*
- [ENCRYPTION_ARCHITECTURE.md](./ENCRYPTION_ARCHITECTURE.md) - Encryption design and security
- [Backend README](../backend/README.md) - Root peer setup and API
- [Source Code](../src/) - Full implementation
