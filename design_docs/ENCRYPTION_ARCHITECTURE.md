# Encryption Architecture

## Overview

This document describes the end-to-end encryption architecture for the P2P chat application. The system uses symmetric encryption (AES-256) with a shared room key, ensuring that only authorized room members can decrypt messages while allowing a root peer to provide offline message storage without access to message content.

## Table of Contents

1. [Key Concepts](#key-concepts)
2. [Encryption Flow](#encryption-flow)
3. [Key Derivation & Room Discovery](#key-derivation--room-discovery)
4. [Swarm Architecture](#swarm-architecture)
5. [Message Storage & Sync](#message-storage--sync)
6. [Security Properties](#security-properties)
7. [Threat Model](#threat-model)

---

## Key Concepts

### Room Key (Secret)
- **Format**: 64-character hexadecimal string (32 bytes)
- **Generation**: Random bytes generated via `crypto-js`
- **Purpose**: Symmetric encryption key shared among room members
- **Distribution**: Out-of-band (QR code, manual entry, etc.)
- **Storage**: Securely stored locally on each member's device
- **Who Has It**: Only room members (creator and invited users)

**Example:**
```
8593d71adb981de2c4f8a7b6e3d9c5f2a1e8d7c6b5a4938271605f4e3d2c1b0a
```

### Room ID / Room Topic (Public)
- **Format**: 64-character hexadecimal string (32 bytes)
- **Derivation**: `SHA256(roomKey)`
- **Purpose**: Public identifier for P2P swarm discovery
- **Distribution**: Derived independently by each member from room key
- **Storage**: Stored locally, also sent to root peer
- **Who Has It**: Room members AND root peer

**Example:**
```
ae54cb31e89788a7f6c5b4d3e2f1a0b9c8d7e6f5a4b39281706f5e4d3c2b1a09
```

### Relationship Between Keys
```
Room Key (SECRET)  ──SHA256──>  Room ID (PUBLIC)
    32 bytes                      32 bytes
    64 hex chars                  64 hex chars
```

**Important**: Given a Room ID, it is cryptographically infeasible to derive the Room Key due to the one-way nature of SHA-256.

---

## Encryption Flow

### Message Sending (User A → User B)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. React Native (User A)                                    │
│    - User types message: "Hello World"                      │
│    - Create message object: { text, sender, timestamp }     │
│    - Encrypt: AES.encrypt(message, roomKey)                 │
│    - Result: "U2FsdGVkX1+EvFQ6woy..." (base64 string)      │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Worklet (Transport Layer)                                │
│    - Receives: encrypted string + roomId                    │
│    - NO DECRYPTION - pure transport                         │
│    - Forwards to:                                           │
│      a) Direct P2P peers in swarm (roomId)                  │
│      b) Root peer for offline storage                       │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Root Peer (Storage)                                      │
│    - Receives: encrypted string + roomId                    │
│    - Stores: {                                              │
│        message: "U2FsdGVkX1+EvFQ6woy...",                   │
│        storedAt: 1234567890,                                │
│        fromPeer: "abc123...",                               │
│        senderPublicKey: "def456..."                         │
│      }                                                       │
│    - CANNOT DECRYPT (no room key)                           │
└─────────────────────────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Worklet (User B)                                         │
│    - Receives: encrypted string from peer or root peer      │
│    - NO DECRYPTION - pure transport                         │
│    - Forwards to React Native with encrypted flag           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. React Native (User B)                                    │
│    - Receives: encrypted string + roomId                    │
│    - Lookup: roomKey = storage.get(roomId)                  │
│    - Decrypt: AES.decrypt(encryptedString, roomKey)         │
│    - Result: { text: "Hello World", sender, timestamp }     │
│    - Display message to user                                │
└─────────────────────────────────────────────────────────────┘
```

### Code Implementation

**Encryption (React Native - HyperswarmManager.ts)**
```typescript
async sendMessage(roomTopic: string, message: P2PMessage) {
  const roomKey = this.roomKeys.get(roomTopic);
  if (!roomKey) throw new Error('Room key not found');
  
  // Encrypt in React Native
  const encryptedData = MessageEncryption.encrypt(roomKey, message);
  
  // Send encrypted string to worklet
  request.send(JSON.stringify({ 
    roomTopic, 
    message: encryptedData, // Base64 encrypted string
    encrypted: true 
  }));
}
```

**Transport (Worklet - hyperswarm-worklet.mjs)**
```javascript
handleSendMessage(req, { roomTopic, message, encrypted }) {
  // Forward to P2P peers (no encryption in worklet)
  const envelope = {
    roomTopic,
    message, // Already encrypted from React Native
    encrypted: encrypted || false,
    timestamp: Date.now(),
  };
  
  for (const conn of connections) {
    conn.write(JSON.stringify(envelope));
  }
  
  // Store encrypted with root peer
  storeMessageWithRootPeer(roomTopic, message);
}
```

**Storage (Root Peer - ChatRootPeer.ts)**
```typescript
async storeMessage(peerId: string, request: Message) {
  const { roomName, message } = request;
  
  // Store encrypted message with metadata
  const messageData = {
    message: message, // Encrypted string - cannot decrypt
    storedAt: Date.now(),
    fromPeer: peerId,
    senderPublicKey: peerData?.publicKey || peerId,
  };
  
  await roomCore.append(JSON.stringify(messageData));
}
```

**Decryption (React Native - HyperswarmManager.ts)**
```typescript
private handleMessageReceived(payload: any): void {
  if (payload.encrypted === true && payload.message) {
    const roomKey = this.roomKeys.get(payload.roomTopic);
    
    // Extract encrypted string
    const encryptedData = typeof payload.message === 'string' 
      ? payload.message 
      : payload.message.message; // From root peer sync
    
    // Decrypt message
    const decryptedMessage = MessageEncryption.decrypt(roomKey, encryptedData);
    
    this.emit('messageReceived', {
      ...payload,
      message: decryptedMessage,
      encrypted: false,
    });
  }
}
```

---

## Key Derivation & Room Discovery

### Room Creation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User A Creates Room                                         │
└─────────────────────────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. Generate Room Key (Secret)                               │
│    roomKey = random(32 bytes).toHex()                       │
│    → "8593d71adb981de2c4f8a7b6e3d9c5f2..."                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Derive Room ID (Public)                                  │
│    roomId = SHA256(roomKey).toHex()                         │
│    → "ae54cb31e89788a7f6c5b4d3e2f1a0b9..."                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Join Swarm                                               │
│    swarm.join(roomId, { server: true, client: true })      │
│    - Joins P2P network using roomId as discovery topic      │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Store Locally                                            │
│    storage.save({                                           │
│      roomId: roomId,        // For rejoining                │
│      roomKey: roomKey,      // For encryption               │
│      name: "Room Name"                                      │
│    })                                                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Share Room Key with User B                              │
│    - QR Code (preferred)                                    │
│    - Manual text entry                                      │
│    - Secure messaging                                       │
│    ⚠️  SHARE ROOM KEY, NOT ROOM ID                          │
└─────────────────────────────────────────────────────────────┘
```

### Room Joining Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User B Joins Room                                           │
└─────────────────────────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. Receive Room Key (Secret)                                │
│    roomKey = "8593d71adb981de2c4f8a7b6e3d9c5f2..."          │
│    - Scan QR code or manual entry                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Validate Room Key                                        │
│    if (!isValidRoomKey(roomKey)) {                          │
│      alert("Invalid room key format");                      │
│      return;                                                │
│    }                                                         │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Derive Room ID (Public)                                  │
│    roomId = SHA256(roomKey).toHex()                         │
│    → "ae54cb31e89788a7f6c5b4d3e2f1a0b9..."                  │
│    (Same as User A's derivation!)                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Join Swarm                                               │
│    swarm.join(roomId, { server: true, client: true })      │
│    - Discovers User A via DHT using roomId                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Request Sync from Root Peer                              │
│    - Retrieve offline messages                              │
│    - Decrypt using roomKey                                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Start Communicating                                      │
│    - Send encrypted messages to User A                      │
│    - Receive and decrypt messages from User A               │
└─────────────────────────────────────────────────────────────┘
```

---

## Swarm Architecture

### Three Types of Swarm Participants

#### 1. Room Members (Users A, B, C, ...)

**What they have:**
- Room Key (secret) ✅
- Room ID (derived) ✅

**What they can do:**
- Encrypt messages ✅
- Decrypt messages ✅
- Join swarm on Room ID ✅
- Send/receive P2P messages ✅

**Swarm join:**
```javascript
const roomId = SHA256(roomKey);
swarm.join(roomId, { server: true, client: true });
```

#### 2. Root Peer (Message Storage Server)

**What it has:**
- Room Key (secret) ❌ - Never receives this
- Room ID (public) ✅ - Received from worklet

**What it can do:**
- Encrypt messages ❌
- Decrypt messages ❌
- Join swarm for room ✅
- Store encrypted messages ✅
- Forward encrypted messages ✅
- Provide offline message sync ✅

**How it receives Room ID:**
```javascript
// Worklet sends room ID to root peer when storing a message
const storeMessage = {
  type: 'store-message',
  roomName: roomId,  // This is the room ID (SHA256 of room key)
  message: encryptedString
};
rootPeerConnection.write(JSON.stringify(storeMessage));
```

**Swarm join:**
```javascript
// Root peer creates a swarm discovery key from the room ID
const swarmKey = hash(`chat-room-${roomId}`);
swarm.join(swarmKey, { server: true });
```

**Important**: 
- The root peer only knows the **Room ID** (public), NOT the **Room Key** (secret)
- The swarm key is derived from Room ID for network discovery, not for encryption
- Root peer CANNOT decrypt messages because it never receives the room key

#### 3. Potential Attackers (Unauthorized Users)

**What they might have:**
- Room Key (secret) ❌
- Room ID (public) ⚠️ (might discover via DHT)

**What they can do:**
- Join swarm on Room ID ⚠️ (if they know it)
- Observe encrypted messages ⚠️
- Decrypt messages ❌ (no room key)

**Mitigation**: Room ID is practically random due to SHA-256. Discovery requires knowing the Room ID, which is only shared through the Room Key derivation.

### How Root Peer Gets Room ID

The root peer learns about rooms when users send messages:

```
User A (Has roomKey)
      │
      │ 1. Derives roomId = SHA256(roomKey)
      │ 2. Encrypts message with roomKey
      │
      ↓
Worklet (Transport)
      │
      │ 3. Sends to root peer:
      │    { roomName: roomId, message: encrypted }
      │
      ↓
Root Peer
      │
      │ 4. Receives roomId (public identifier)
      │ 5. Does NOT receive roomKey (secret)
      │ 6. Creates swarm key: hash("chat-room-" + roomId)
      │ 7. Joins swarm for that room
      │ 8. Stores encrypted message
      │
      └──> CANNOT decrypt (no roomKey)
```

### Swarm Discovery Diagram

```
                    DHT (Distributed Hash Table)
                              │
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        │                     │                     │
   Swarm Topic           Swarm Topic           Swarm Topic
hash("chat-room-      hash("chat-room-      hash("chat-room-
  ae54cb31...")         ae54cb31...")         ae54cb31...")
        │                     │                     │
        │                     │                     │
    ┌───▼────┐           ┌───▼────┐           ┌───▼────┐
    │ User A │◄──────────┤ User B │◄──────────┤Root Peer│
    │  P2P   │   Direct  │  P2P   │   Store   │ Storage │
    │        │    Conn   │        │    Msg    │         │
    └────────┘           └────────┘           └─────────┘
        │                     │                     │
        │                     │                     │
  Has roomKey          Has roomKey           Only has roomId
  Can decrypt          Can decrypt           CANNOT decrypt
        │                     │                     │
  Knows: roomKey      Knows: roomKey         Knows: roomId
  Knows: roomId       Knows: roomId          Does NOT know: roomKey
```

---

## Message Storage & Sync

### Online Communication (Direct P2P)

When both users are online:

```
User A (Online)                           User B (Online)
     │                                         │
     │  1. Encrypt message with roomKey       │
     ├────────────────────────────────────────►│
     │     "U2FsdGVkX1+EvFQ6woy..."           │
     │                                         │
     │                                         │  2. Decrypt with roomKey
     │                                         │  3. Display "Hello World"
     │                                         │
```

**No root peer involvement** - messages go directly peer-to-peer.

### Offline Message Delivery

When User B is offline:

```
User A (Online)          Root Peer             User B (Offline)
     │                       │                       │
     │  1. Encrypt message   │                       │
     ├──────────────────────►│                       │
     │  "U2FsdGVkX1..."      │                       │
     │                       │                       │
     │                       │  2. Store encrypted   │
     │                       │     (cannot decrypt)  │
     │                       │                       │
     │                       │                       │
     │                       │                       │  User B comes online
     │                       │                       │
     │                       │    3. Request sync    │
     │                       │◄──────────────────────┤
     │                       │      (roomId only)    │
     │                       │                       │
     │                       │  4. Send encrypted    │
     │                       │     messages          │
     │                       ├──────────────────────►│
     │                       │  "U2FsdGVkX1..."      │
     │                       │                       │
     │                       │                       │  5. Decrypt with roomKey
     │                       │                       │  6. Display messages
```

### Root Peer Storage Format

```json
{
  "message": "U2FsdGVkX1+EvFQ6woyGPqYvnX...",
  "storedAt": 1696723200000,
  "fromPeer": "a1b2c3d4e5f6...",
  "senderPublicKey": "04f3a8b9c2d1e5f4a7b6c9d2e1f8a5b4c7d6e9f2..."
}
```

**What root peer knows:**
- ✅ Room ID (which room the message belongs to)
- ✅ Timestamp (when message was stored)
- ✅ Sender's public key (who sent it)
- ❌ Message content (encrypted)

**What root peer CANNOT know:**
- ❌ Message text
- ❌ Sender's username (unless in public key)
- ❌ Any metadata inside the encrypted envelope

---

## Security Properties

### ✅ What is Protected

1. **Message Content Confidentiality**
   - All message text is encrypted with AES-256
   - Only room members with the room key can decrypt
   - Root peer stores encrypted blobs

2. **End-to-End Encryption**
   - Messages encrypted in sender's React Native layer
   - Decrypted only in recipient's React Native layer
   - Worklet and root peer never see plaintext

3. **Room Privacy**
   - Room ID is derived from secret room key
   - Cannot join room without knowing room key
   - Room discovery requires room ID knowledge

4. **Offline Message Delivery**
   - Messages stored encrypted by root peer
   - Delivered encrypted when recipient comes online
   - Recipient decrypts with their stored room key

### ⚠️ What is NOT Protected (Known Limitations)

1. **Metadata Leakage**
   - Room ID is visible to root peer
   - Message timing is visible
   - Message size is visible
   - Sender public key is visible

2. **No Forward Secrecy**
   - Single static room key for all messages
   - If room key is compromised, all past messages can be decrypted
   - No key rotation mechanism (future enhancement)

3. **No Authentication**
   - No verification that sender actually has the room key
   - No message authentication codes (MACs)
   - Potential for replay attacks (future enhancement)

4. **Room ID Discovery**
   - If attacker knows room ID, they can join the swarm
   - They will see encrypted messages but cannot decrypt
   - Mitigation: Room ID is 256-bit random hash (hard to guess)

5. **Root Peer Trust**
   - Root peer can potentially:
     - Track who is communicating (via room ID)
     - See message frequency and timing
     - Store encrypted messages indefinitely
   - Mitigation: Root peer cannot decrypt messages

---

## Threat Model

### Trusted Components

1. **User's Device** - Trusted to store room key securely
2. **React Native App** - Trusted to handle encryption/decryption
3. **Local Storage** - Trusted to securely store room keys

### Untrusted Components

1. **Network** - Assume all network traffic can be intercepted
2. **Root Peer** - Assume it might be malicious or compromised
3. **Other Swarm Members** - Assume attackers might join swarm

### Attack Scenarios

#### ❌ Attack 1: Network Eavesdropper
**Attacker Goal**: Read messages by intercepting network traffic

**Protection**: All messages are encrypted with AES-256. Eavesdropper only sees base64 encrypted strings.

**Result**: Attack fails ✅

---

#### ❌ Attack 2: Malicious Root Peer
**Attacker Goal**: Root peer operator tries to read stored messages

**Protection**: Root peer never receives room key. All stored messages are encrypted blobs.

**Result**: Attack fails ✅

**Metadata Leak**: Root peer can see room ID, timing, and sender public key ⚠️

---

#### ❌ Attack 3: DHT Room Discovery
**Attacker Goal**: Discover active rooms by scanning DHT

**Protection**: Room ID is 256-bit SHA-256 hash (2^256 possibilities). Brute-force search is computationally infeasible.

**Result**: Attack fails (practically) ✅

---

#### ⚠️ Attack 4: Compromised Room Key
**Attacker Goal**: Obtain room key from a room member

**Protection**: None - if room key is leaked, all messages can be decrypted.

**Result**: Attack succeeds ⚠️

**Mitigation**: 
- Secure storage of room keys
- User education about key security
- Future: Key rotation and forward secrecy

---

#### ⚠️ Attack 5: Physical Device Access
**Attacker Goal**: Access victim's device and extract room key

**Protection**: Depends on device security (PIN, biometrics, encryption)

**Result**: Attack may succeed if device is unlocked ⚠️

**Mitigation**:
- Use device secure storage (Keychain/Keystore)
- Require authentication to view messages
- Future: Biometric unlock for room access

---

## Future Enhancements

### 1. Forward Secrecy (Double Ratchet)
- Implement Signal Protocol
- Each message encrypted with ephemeral key
- Past messages safe even if current key compromised

### 2. Message Authentication
- Add HMAC to prevent tampering
- Verify sender identity
- Prevent replay attacks

### 3. Key Rotation
- Periodic room key rotation
- Backward compatibility with old keys
- Automatic key distribution

### 4. Metadata Protection
- Pad messages to constant size
- Add random delays
- Use mix networks for routing

### 5. Verification
- Key fingerprint verification
- Safety numbers for room members
- Alert on key changes

---

## Conclusion

The current encryption architecture provides **strong content confidentiality** through AES-256 encryption, ensuring that only room members with the shared room key can read messages. The root peer provides offline message delivery while remaining unable to decrypt message content.

**Key Strengths:**
- ✅ End-to-end encrypted message content
- ✅ Root peer cannot read messages
- ✅ Simple key management (single shared key)
- ✅ Offline message delivery support

**Known Limitations:**
- ⚠️ Metadata visible (timing, size, room ID)
- ⚠️ No forward secrecy
- ⚠️ No message authentication
- ⚠️ Static room keys

For most use cases, this provides adequate security. For high-security scenarios, consider implementing the suggested enhancements above.

---

## References

- **crypto-js**: AES encryption library
- **SHA-256**: Cryptographic hash function for key derivation
- **Hyperswarm**: P2P networking library
- **Signal Protocol**: Reference for forward secrecy implementation

---

*Last Updated: October 7, 2025*
