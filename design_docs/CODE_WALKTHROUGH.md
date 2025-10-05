# Complete Code Walkthrough - P2P Encrypted Chat

> **Purpose**: This document provides a comprehensive, detailed explanation of how this P2P Encrypted Chat application works. Perfect for understanding the codebase architecture, data flows, and implementation details.

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Entry Points & Navigation](#2-entry-points--navigation)
3. [Core Module: CryptoManager](#3-core-module-cryptomanager)
4. [Core Module: RoomManager](#4-core-module-roommanager)
5. [Core Module: NetworkManager](#5-core-module-networkmanager)
6. [Core Module: StorageManager](#6-core-module-storagemanager)
7. [Core Module: ChatClient](#7-core-module-chatchlient)
8. [UI Screens Explained](#8-ui-screens-explained)
9. [Backend Server Explained](#9-backend-server-explained)
10. [Complete Data Flow Examples](#10-complete-data-flow-examples)
11. [Key Concepts & Patterns](#11-key-concepts--patterns)

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌───────────────────────────────────────────────────────────┐
│                     React Native App                       │
├───────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  Welcome    │→│ Create/Join │→│ Chat Screen │       │
│  │  Screen     │  │   Screen    │  │             │       │
│  └─────────────┘  └─────────────┘  └──────┬──────┘       │
│                                             │               │
│                                             ↓               │
│                                    ┌────────────────┐      │
│                                    │  ChatClient    │      │
│                                    │  (Orchestrator)│      │
│                                    └────────┬───────┘      │
│                                             │               │
│                    ┌────────────────────────┼────────────┐ │
│                    │                        │            │ │
│         ┌──────────▼──────┐    ┌───────────▼─────┐     │ │
│         │  RoomManager    │    │ NetworkManager  │     │ │
│         │  (Room Logic)   │    │ (P2P Networking)│     │ │
│         └────────┬────────┘    └────────┬────────┘     │ │
│                  │                      │              │ │
│         ┌────────▼────────┐    ┌────────▼────────┐   │ │
│         │ CryptoManager   │    │ StorageManager  │   │ │
│         │  (Encryption)   │    │ (AsyncStorage)  │   │ │
│         └─────────────────┘    └─────────────────┘   │ │
│                                                        │ │
└────────────────────────────────────────────────────────┘ │
                                 │                          │
                    ┌────────────▼─────────────┐           │
                    │      Hyperswarm          │           │
                    │   (P2P Networking)       │           │
                    └────────────┬─────────────┘           │
                                 │                          │
                    ┌────────────▼─────────────┐           │
                    │   Root Peer Server       │           │
                    │  (Message Persistence)   │           │
                    └──────────────────────────┘           │
```

### 1.2 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **UI Framework** | React Native 0.74.1 | Cross-platform mobile app |
| **Navigation** | React Navigation 6.x | Screen routing |
| **P2P Networking** | Hyperswarm 4.x | Peer discovery & connections |
| **Encryption** | libsodium-wrappers 0.7.x | End-to-end encryption |
| **Storage** | AsyncStorage | Local message persistence |
| **Buffer Handling** | b4a 1.7.x | Cross-platform Buffer operations |
| **Crypto Primitives** | hypercore-crypto | Hash functions, key derivation |

### 1.3 Key Design Patterns

1. **Event-Driven Architecture**: Modules communicate via events
2. **Dependency Injection**: Managers passed to dependent modules
3. **Separation of Concerns**: Each module has single responsibility
4. **Optimistic UI**: Messages shown before network confirmation
5. **Progressive Enhancement**: Works offline, syncs when online

### 1.4 Module Responsibilities

| Module | Responsibility | Key Functions |
|--------|---------------|---------------|
| **CryptoManager** | Encryption, key management | `encryptMessage()`, `decryptMessage()`, `generateKeyPair()` |
| **RoomManager** | Room lifecycle | `createRoom()`, `joinRoom()`, `getCurrentRoom()` |
| **NetworkManager** | P2P networking | `start()`, `broadcastMessage()`, `handleConnection()` |
| **StorageManager** | Local persistence | `storeMessage()`, `getMessages()` |
| **ChatClient** | Orchestration | `createRoom()`, `joinRoom()`, `sendMessage()` |

---

## 2. Entry Points & Navigation

### 2.1 Application Bootstrap: `index.js`

**File**: `/index.js`

```javascript
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
```

**What happens**:
1. React Native calls this file first
2. Registers the main `App` component
3. `appName` comes from `app.json` → `"P2PChatTemp"`
4. React Native now knows which component to render

**Note**: We removed the `import './polyfills';` line after migrating to b4a.

---

### 2.2 Navigation Setup: `App.tsx`

**File**: `/App.tsx`

```typescript
import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';

import WelcomeScreen from './screens/WelcomeScreen';
import CreateRoomScreen from './screens/CreateRoomScreen';
import JoinRoomScreen from './screens/JoinRoomScreen';
import ChatScreen from './screens/ChatScreen';

const Stack = createStackNavigator();

function App(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerStyle: {backgroundColor: '#007AFF'},
          headerTintColor: '#fff',
          headerTitleStyle: {fontWeight: 'bold'},
        }}>
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="CreateRoom"
          component={CreateRoomScreen}
          options={{title: 'Create Room'}}
        />
        <Stack.Screen
          name="JoinRoom"
          component={JoinRoomScreen}
          options={{title: 'Join Room'}}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={{headerShown: false}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

**Navigation Flow**:
```
┌─────────────┐
│   Welcome   │  (No header)
│   Screen    │
└──────┬──────┘
       │
       ├──────► Create Room → Chat
       │
       └──────► Join Room → Chat
```

**Key Configuration**:
- **initialRouteName**: `"Welcome"` (first screen shown)
- **headerStyle**: Blue header (`#007AFF`)
- **Welcome & Chat**: No default header (custom headers)
- **Create/Join**: Standard headers with "Create Room" / "Join Room" titles

**Navigation Props**: Each screen receives:
```javascript
{
  navigation: {
    navigate: (screenName, params) => {},
    goBack: () => {},
    // ... more methods
  },
  route: {
    params: {}, // Parameters passed from previous screen
    name: 'ScreenName'
  }
}
```

---

## 3. Core Module: CryptoManager

**File**: `/src/crypto/CryptoManager.js`

This module handles **ALL cryptographic operations**: key generation, encryption, decryption, and key management.

### 3.1 Constructor & Initialization

```javascript
import sodium from 'libsodium-wrappers';
import crypto from 'hypercore-crypto';
import b4a from 'b4a';
import AsyncStorage from '@react-native-async-storage/async-storage';

class CryptoManager {
  constructor() {
    this.keyPair = null;  // Will store {publicKey, secretKey}
  }
}
```

**State**:
- `this.keyPair`: User's encryption keys (initially `null`)

**Dependencies**:
- **libsodium-wrappers**: High-level encryption (crypto_box)
- **hypercore-crypto**: Hash functions, random bytes
- **b4a**: Cross-platform Buffer operations
- **AsyncStorage**: Persistent key storage

---

### 3.2 Room Key Generation

```javascript
generateNewRoomKey() {
  return crypto.randomBytes(32);
}
```

**Purpose**: Create a unique identifier for a new chat room

**How it works**:
1. Generates 32 cryptographically random bytes
2. This becomes the room's **secret key**
3. Only users with this key can join the room

**Example Output**:
```javascript
// Binary Buffer (32 bytes):
<Buffer a3 f2 9c 4d 7e 8b 1a 5c 3f d9 e6 2b ... 20 more bytes>

// As hex string (64 characters):
"a3f29c4d7e8b1a5c3fd9e62b..." // 64 chars
```

**Security**: Uses cryptographically secure random number generator (CSPRNG)

---

### 3.3 Room ID Derivation

```javascript
deriveRoomId(roomKey) {
  if (typeof roomKey === 'string') {
    roomKey = b4a.from(roomKey, 'hex');
  }
  return crypto.hash(roomKey).toString('hex');
}
```

**Purpose**: Create a deterministic room ID from room key

**How it works**:
1. Takes room key (Buffer or hex string)
2. Hashes it with SHA-256
3. Returns hash as hex string

**Why separate Room ID from Room Key?**
- **Room Key**: Secret, shared with trusted users
- **Room ID**: Derived, used for swarm discovery
- Same key → always same ID (deterministic)
- Can't reverse: ID → Key (one-way hash)

**Example**:
```javascript
const roomKey = "a3f29c4d7e8b1a5c...";
const roomId = deriveRoomId(roomKey);
// roomId = "7d3a9f2e4c1b8a5d..." (different from roomKey)

// Same key always gives same ID:
deriveRoomId("abc...") === deriveRoomId("abc...") // true
```

**Use Cases**:
- Hyperswarm topic for peer discovery
- Room identification in backend
- Local storage keys

---

### 3.4 User Key Pair Generation

```javascript
async generateKeyPair() {
  await sodium.ready;  // Wait for libsodium to initialize
  
  const publicKey = b4a.alloc(sodium.crypto_box_PUBLICKEYBYTES);
  const secretKey = b4a.alloc(sodium.crypto_box_SECRETKEYBYTES);
  
  sodium.crypto_box_keypair(publicKey, secretKey);
  
  return {publicKey, secretKey};
}
```

**Purpose**: Generate encryption keys for user

**How it works**:
1. **Wait for libsodium**: `await sodium.ready` ensures library is loaded
2. **Allocate buffers**: 
   - Public key: 32 bytes
   - Secret key: 32 bytes
3. **Generate keypair**: Uses Curve25519 (elliptic curve cryptography)
4. **Return both keys**: `{publicKey, secretKey}`

**Cryptography Details**:
- **Algorithm**: Curve25519 (part of NaCl/libsodium)
- **Public key**: Share with others to receive encrypted messages
- **Secret key**: Keep private, used to decrypt messages
- **Key sizes**: Both 32 bytes (256 bits)

**Security Properties**:
- Even if attacker has public key, can't derive secret key
- Keys are cryptographically strong (256-bit security)
- Used for **asymmetric encryption** (crypto_box)

---

### 3.5 Load or Generate Keys

```javascript
async loadOrGenerateKeys(username) {
  await sodium.ready;
  const keyPath = `user_keys_${username}`;

  try {
    // Try to load existing keys
    const storedKeys = await AsyncStorage.getItem(keyPath);
    
    if (storedKeys) {
      // Parse and reconstruct keys
      const keyData = JSON.parse(storedKeys);
      this.keyPair = {
        publicKey: b4a.from(keyData.publicKey, 'base64'),
        secretKey: b4a.from(keyData.secretKey, 'base64'),
      };
      console.log(`🔑 Loaded existing keys for ${username}`);
    } else {
      // Generate new keys
      this.keyPair = await this.generateKeyPair();

      // Store for future use
      const keyData = {
        publicKey: this.keyPair.publicKey.toString('base64'),
        secretKey: this.keyPair.secretKey.toString('base64'),
        username: username,
        created: Date.now(),
      };

      await AsyncStorage.setItem(keyPath, JSON.stringify(keyData));
      console.log(`💾 Generated new keys for ${username}`);
    }

    return this.keyPair;
  } catch (error) {
    console.error('❌ Failed to load/generate keys:', error);
    throw error;
  }
}
```

**Purpose**: Ensure user has persistent encryption keys

**Flow**:
```
┌─────────────────────────┐
│ loadOrGenerateKeys()    │
└────────┬────────────────┘
         │
    ┌────▼────┐
    │ Check   │
    │ Storage │
    └────┬────┘
         │
    ┌────▼──────────┐
    │ Keys exist?   │
    └────┬──────────┘
         │
    ┌────▼────┐          ┌──────────┐
    │  YES    │          │   NO     │
    └────┬────┘          └────┬─────┘
         │                    │
    ┌────▼────────┐      ┌───▼──────────┐
    │ Load from   │      │ Generate new │
    │ AsyncStorage│      │   keypair    │
    └────┬────────┘      └───┬──────────┘
         │                   │
         │              ┌────▼─────┐
         │              │  Store   │
         │              │   keys   │
         │              └────┬─────┘
         │                   │
    ┌────▼───────────────────▼────┐
    │  Return this.keyPair        │
    └─────────────────────────────┘
```

**Storage Format** (in AsyncStorage):
```json
{
  "publicKey": "Rj3k9mF2xL...==",  // Base64 encoded
  "secretKey": "pQ7vN8hK5w...==",  // Base64 encoded
  "username": "Alice",
  "created": 1696348800000
}
```

**Key Storage Pattern**:
- **Key**: `user_keys_${username}` (e.g., `user_keys_Alice`)
- **Each username**: Gets its own keypair
- **Persistent**: Survives app restarts
- **Format**: JSON with base64-encoded keys

**Why This Matters**:
- User keeps same identity across sessions
- Can receive messages intended for same public key
- Enables "resume chat" functionality

---

### 3.6 Message Encryption

```javascript
async encryptMessage(message, recipientPublicKey) {
  await sodium.ready;
  
  // Generate random nonce (number used once)
  const nonce = b4a.alloc(sodium.crypto_box_NONCEBYTES);
  sodium.randombytes_buf(nonce);

  // Convert message to bytes
  const plaintext = b4a.from(JSON.stringify(message));
  
  // Allocate space for ciphertext (includes MAC)
  const ciphertext = b4a.alloc(
    plaintext.length + sodium.crypto_box_MACBYTES
  );

  // Encrypt: your secret key + their public key
  sodium.crypto_box_easy(
    ciphertext,
    plaintext,
    nonce,
    recipientPublicKey,
    this.keyPair.secretKey,
  );

  return {
    type: 'encrypted',
    ciphertext: ciphertext.toString('base64'),
    nonce: nonce.toString('base64'),
    sender: this.keyPair.publicKey.toString('base64'),
  };
}
```

**Purpose**: Encrypt a message for specific recipient

**Encryption Algorithm**: **crypto_box** (libsodium)
- Combines Curve25519 (key exchange) + XSalsa20 (encryption) + Poly1305 (authentication)
- Provides **authenticated encryption**

**How crypto_box Works**:
```
┌─────────────────────────────────────────────┐
│  Your Secret Key + Their Public Key         │
│              ↓                               │
│  Compute Shared Secret (ECDH)               │
│              ↓                               │
│  Shared Secret + Nonce → Encryption Key     │
│              ↓                               │
│  Plaintext + Encryption Key → Ciphertext    │
│              ↓                               │
│  Add Authentication Tag (MAC)               │
└─────────────────────────────────────────────┘
```

**Components**:

1. **Nonce** (24 bytes):
   - Random value generated each time
   - Ensures same message encrypts differently
   - Never reused with same key pair
   - Sent alongside ciphertext

2. **Plaintext**:
   - Message object as JSON string
   - Example: `{"text":"Hello","sender":"Alice","timestamp":1696348800000}`

3. **Ciphertext**:
   - Encrypted message
   - Length = plaintext + 16 bytes (MAC)
   - MAC authenticates both ciphertext and nonce

4. **Sender Public Key**:
   - Included so recipient knows who sent it
   - Used for decryption

**Example**:
```javascript
const message = {
  text: "Hello Bob!",
  sender: "Alice",
  timestamp: 1696348800000
};

const encrypted = await encryptMessage(message, bobPublicKey);

// Result:
{
  type: 'encrypted',
  ciphertext: 'x7K9mF2p...==',  // Base64
  nonce: 'pQ3vN8hK5w...==',      // Base64
  sender: 'Rj3k9mF2xL...=='      // Alice's public key
}
```

**Security Properties**:
- **Confidentiality**: Only recipient with matching secret key can decrypt
- **Authenticity**: MAC proves message wasn't tampered with
- **Forward Secrecy**: Not provided (would need Diffie-Hellman per message)
- **Uniqueness**: Each encryption produces different ciphertext (due to random nonce)

---

### 3.7 Message Decryption

```javascript
async decryptMessage(encryptedData) {
  try {
    await sodium.ready;
    
    // Parse encrypted components
    const ciphertext = b4a.from(encryptedData.ciphertext, 'base64');
    const nonce = b4a.from(encryptedData.nonce, 'base64');
    const senderPublicKey = b4a.from(encryptedData.sender, 'base64');
    
    // Allocate buffer for plaintext
    const plaintext = b4a.alloc(
      ciphertext.length - sodium.crypto_box_MACBYTES
    );

    // Decrypt: sender's public key + your secret key
    if (
      sodium.crypto_box_open_easy(
        plaintext,
        ciphertext,
        nonce,
        senderPublicKey,
        this.keyPair.secretKey,
      )
    ) {
      return JSON.parse(plaintext.toString());
    }

    throw new Error('Decryption failed');
  } catch (error) {
    console.error('❌ Decryption failed:', error.message);
    return null;
  }
}
```

**Purpose**: Decrypt received encrypted message

**Decryption Process**:
```
┌─────────────────────────────────────────────┐
│  Sender's Public Key + Your Secret Key      │
│              ↓                               │
│  Compute Shared Secret (ECDH)               │
│              ↓                               │
│  Shared Secret + Nonce → Decryption Key     │
│              ↓                               │
│  Verify MAC (authentication tag)            │
│              ↓                               │
│  MAC valid? → Decrypt ciphertext            │
│              ↓                               │
│  Return plaintext as JSON object            │
└─────────────────────────────────────────────┘
```

**Key Points**:

1. **Shared Secret**: 
   - Sender used: Their secret + Your public
   - You use: Your secret + Their public
   - Both compute **same** shared secret (ECDH magic!)

2. **MAC Verification**:
   - `crypto_box_open_easy` returns `true` if MAC valid
   - Returns `false` if tampered or wrong key
   - Protects against MITM attacks

3. **Error Handling**:
   - Returns `null` if decryption fails
   - Doesn't crash app
   - Allows graceful handling of corrupt messages

**Example**:
```javascript
const encrypted = {
  type: 'encrypted',
  ciphertext: 'x7K9mF2p...==',
  nonce: 'pQ3vN8hK5w...==',
  sender: 'Rj3k9mF2xL...=='  // Alice's public key
};

const decrypted = await decryptMessage(encrypted);

// Result:
{
  text: "Hello Bob!",
  sender: "Alice",
  timestamp: 1696348800000
}
```

**Why Decryption Might Fail**:
- Wrong recipient (your secret key doesn't match)
- Tampered ciphertext (MAC check fails)
- Tampered nonce (MAC check fails)
- Corrupted data (invalid base64)

---

### 3.8 Utility Methods

```javascript
getPublicKeyHex() {
  return this.keyPair ? this.keyPair.publicKey.toString('hex') : null;
}
```

**Purpose**: Get public key as hex string

**Use Cases**:
- Debugging (print public key to console)
- Display in UI (show your identity)
- Sharing (though base64 used in protocol)

---

## 4. Core Module: RoomManager

**File**: `/src/rooms/RoomManager.js`

This module manages **room lifecycle**: creating rooms, joining rooms, and tracking current room state.

### 4.1 Constructor

```javascript
import b4a from 'b4a';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoManager from '../crypto/CryptoManager';

class RoomManager {
  constructor() {
    this.crypto = new CryptoManager();
    this.currentRoom = null;
  }
}
```

**State**:
- `this.crypto`: Own CryptoManager instance
- `this.currentRoom`: Current room object or `null`

---

### 4.2 Create Room

```javascript
async createRoom(username) {
  try {
    // Step 1: Generate room encryption key (32 random bytes)
    const roomKey = this.crypto.generateNewRoomKey();
    
    // Step 2: Derive deterministic room ID from key
    const roomId = this.crypto.deriveRoomId(roomKey);

    // Step 3: Load or generate user's encryption keys
    await this.crypto.loadOrGenerateKeys(username);

    // Step 4: Create room metadata
    const roomInfo = {
      roomId,
      roomKey: roomKey.toString('hex'),
      isCreator: true,
      username,
      createdAt: Date.now(),
    };

    // Step 5: Persist to local storage
    await AsyncStorage.setItem(
      `room_${roomId}`,
      JSON.stringify(roomInfo)
    );

    // Step 6: Set as current room (keep roomKey as Buffer)
    this.currentRoom = {
      ...roomInfo,
      roomKey: roomKey,  // Buffer for crypto operations
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
```

**What Happens** (step by step):

1. **Generate Room Key**:
   ```javascript
   const roomKey = this.crypto.generateNewRoomKey();
   // <Buffer a3 f2 9c ... 32 bytes>
   ```

2. **Derive Room ID**:
   ```javascript
   const roomId = this.crypto.deriveRoomId(roomKey);
   // "7d3a9f2e4c1b8a5d..." (64-char hex)
   ```

3. **Load User Keys**:
   ```javascript
   await this.crypto.loadOrGenerateKeys(username);
   // Ensures user has encryption keypair
   ```

4. **Create Room Metadata**:
   ```javascript
   const roomInfo = {
     roomId: "7d3a9f2e...",
     roomKey: "a3f29c4d...",  // Hex string
     isCreator: true,
     username: "Alice",
     createdAt: 1696348800000
   };
   ```

5. **Save to AsyncStorage**:
   ```javascript
   await AsyncStorage.setItem('room_7d3a9f2e...', JSON.stringify(roomInfo));
   // Persists for future app sessions
   ```

6. **Set Current Room**:
   ```javascript
   this.currentRoom = {
     ...roomInfo,
     roomKey: roomKey  // Keep as Buffer for crypto ops
   };
   ```

**Return Value**:
```javascript
{
  roomKey: "a3f29c4d7e8b1a5c...",  // Share this with others!
  roomId: "7d3a9f2e4c1b8a5d...",
  success: true
}
```

**Key Insight**: Room creator **shares** the `roomKey` with others. This key is the **secret** that grants access to the room.

---

### 4.3 Join Room

```javascript
async joinRoom(roomKeyHex, username) {
  try {
    // Step 1: Validate room key format
    if (!roomKeyHex || roomKeyHex.length !== 64) {
      throw new Error('Invalid room key format');
    }

    // Step 2: Convert hex string to Buffer
    const roomKey = b4a.from(roomKeyHex, 'hex');
    
    // Step 3: Derive room ID (same as creator got)
    const roomId = this.crypto.deriveRoomId(roomKey);

    // Step 4: Load or generate user's encryption keys
    await this.crypto.loadOrGenerateKeys(username);

    // Step 5: Create room metadata
    const roomInfo = {
      roomId,
      roomKey: roomKeyHex,
      isCreator: false,  // Not the creator
      username,
      joinedAt: Date.now(),  // joinedAt instead of createdAt
    };

    // Step 6: Persist to local storage
    await AsyncStorage.setItem(
      `room_${roomId}`,
      JSON.stringify(roomInfo)
    );

    // Step 7: Set as current room
    this.currentRoom = {
      ...roomInfo,
      roomKey: roomKey,  // Buffer for crypto operations
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
```

**Key Differences from `createRoom()`**:

| Aspect | Create | Join |
|--------|--------|------|
| Room Key | Generated | Provided by user |
| `isCreator` | `true` | `false` |
| Timestamp | `createdAt` | `joinedAt` |
| Return | Includes `roomKey` | Only `roomId` |

**Room Key Validation**:
```javascript
if (!roomKeyHex || roomKeyHex.length !== 64) {
  throw new Error('Invalid room key format');
}
```
- Must be exactly 64 hex characters
- Represents 32 bytes (32 * 2 hex digits)
- Invalid keys rejected immediately

**Critical Step**: 
```javascript
const roomId = this.crypto.deriveRoomId(roomKey);
```
- **Same room key** → **Same room ID**
- This is how joiner finds the same swarm as creator
- Deterministic hashing ensures consistency

---

### 4.4 Utility Methods

```javascript
getCurrentRoom() {
  return this.currentRoom;
}
```

**Purpose**: Get current room object

**Returns**:
```javascript
{
  roomId: "7d3a9f2e...",
  roomKey: <Buffer ...>,  // Buffer, not string!
  isCreator: true/false,
  username: "Alice",
  createdAt: 1696348800000  // or joinedAt
}
```

---

```javascript
getRoomSwarmKey() {
  if (!this.currentRoom) {
    return null;
  }
  return this.crypto.deriveRoomId(this.currentRoom.roomKey);
}
```

**Purpose**: Get room ID for swarm joining

**Use Case**: NetworkManager calls this to get the topic for Hyperswarm

---

## 5. Core Module: NetworkManager

**File**: `/src/network/NetworkManager.js`

This is the **most complex module** - handles all P2P networking using Hyperswarm.

### 5.1 Constructor

```javascript
import EventEmitter from 'events';
import Hyperswarm from 'hyperswarm';
import crypto from 'hypercore-crypto';
import b4a from 'b4a';

class NetworkManager extends EventEmitter {
  constructor(roomManager, cryptoManager) {
    super();  // Initialize EventEmitter
    this.roomManager = roomManager;
    this.crypto = cryptoManager;
    this.swarm = new Hyperswarm();
    this.connections = new Map();  // peerId -> peerData
    this.isStarted = false;
  }
}
```

**Extends EventEmitter**: 
```javascript
this.emit('peer-connected', peerId);
this.emit('message', messageData);
// Other modules listen with .on()
```

**State**:
- `this.swarm`: Hyperswarm instance (P2P networking)
- `this.connections`: Map of all active peer connections
- `this.isStarted`: Prevents multiple starts

**Connection Map Structure**:
```javascript
Map {
  'peer-id-1' => {
    connection: <Socket>,
    publicKey: <Buffer>,
    peerId: 'peer-id-1',
    connectedAt: 1696348800000,
    isRootPeer: false,
    announced: false,
    username: 'Bob'  // Set after key exchange
  },
  'peer-id-2' => { ... }
}
```

---

### 5.2 Start Networking

```javascript
async start() {
  if (this.isStarted) {
    return;
  }

  console.log('🌐 Starting P2P network...');

  try {
    const room = this.roomManager.getCurrentRoom();
    if (!room) {
      throw new Error('No room available for networking');
    }

    // Join room-specific swarm
    await this.joinRoomSwarm(room.roomKey);

    // Join discovery swarm for root peer
    await this.joinDiscoverySwarm();

    // Handle incoming connections
    this.swarm.on('connection', (conn, info) => {
      this.handleConnection(conn, info);
    });

    this.isStarted = true;
    console.log('✅ P2P network started');
  } catch (error) {
    console.error('❌ Failed to start P2P network:', error);
    throw error;
  }
}
```

**What Happens**:

1. **Get Current Room**:
   ```javascript
   const room = this.roomManager.getCurrentRoom();
   ```

2. **Join Two Swarms**:
   - **Room Swarm**: Find peers in this specific room
   - **Discovery Swarm**: Find the root peer server

3. **Setup Connection Handler**:
   ```javascript
   this.swarm.on('connection', (conn, info) => {
     this.handleConnection(conn, info);
   });
   ```
   - Called automatically when ANY peer connects
   - Works for both incoming and outgoing connections

**Two Swarm Strategy**:
```
┌─────────────────┐      ┌─────────────────┐
│   Room Swarm    │      │Discovery Swarm  │
│  (Room-specific)│      │ (Root peer)     │
├─────────────────┤      ├─────────────────┤
│ Topic: roomKey  │      │ Topic: "holepun│
│                 │      │ ch-root-peer-  │
│ All peers in    │      │ discovery"      │
│ same room       │      │                 │
│                 │      │ Only root peer  │
│ client: true    │      │ is server here  │
│ server: true    │      │                 │
└─────────────────┘      └─────────────────┘
```

---

### 5.3 Join Room Swarm

```javascript
async joinRoomSwarm(roomKey) {
  console.log('📡 Joining room swarm...');

  // Convert to Buffer if needed
  const swarmKey = b4a.isBuffer(roomKey) 
    ? roomKey 
    : b4a.from(roomKey, 'hex');
    
  this.swarm.join(swarmKey, {client: true, server: true});
}
```

**Hyperswarm Join Options**:
- `{client: true, server: true}` means:
  - **client**: Can initiate connections to others
  - **server**: Can accept connections from others
  - **Both**: Full peer (not just client or server)

**How Hyperswarm Works**:
```
Alice joins topic "abc..."  →  DHT announces: "Alice is here"
Bob joins topic "abc..."    →  DHT announces: "Bob is here"
                            →  DHT tells Alice about Bob
                            →  DHT tells Bob about Alice
                            →  They connect directly!
```

**Hyperswarm Magic**:
- Uses distributed hash table (DHT) for discovery
- NAT hole-punching for direct connections
- Fallback to relay servers if needed
- All automatic!

---

### 5.4 Join Discovery Swarm

```javascript
async joinDiscoverySwarm() {
  console.log('🔍 Joining root peer discovery swarm...');

  // Use well-known discovery topic
  const discoveryTopic = crypto.hash(
    b4a.from('holepunch-root-peer-discovery')
  );
  
  this.swarm.join(discoveryTopic, {client: true, server: false});
}
```

**Key Points**:

1. **Well-Known Topic**: 
   ```javascript
   hash('holepunch-root-peer-discovery')
   ```
   - Same string → same hash → same topic
   - All clients and root peer use this
   - Convention for finding infrastructure

2. **Client-Only Mode**:
   ```javascript
   {client: true, server: false}
   ```
   - Can connect TO root peer
   - Won't accept connections ON this topic
   - Reduces attack surface

3. **Why Separate**:
   - Room swarm: peer-to-peer chat
   - Discovery swarm: find infrastructure
   - Separates concerns

---

### 5.5 Handle Connection

```javascript
handleConnection(connection, info) {
  const peerId = info.publicKey.toString('hex');
  console.log(`🤝 Peer connected: ${peerId.slice(0, 16)}...`);

  // Create peer data object
  const peerData = {
    connection,
    publicKey: info.publicKey,
    peerId,
    connectedAt: Date.now(),
    isRootPeer: false,
    announced: false,
  };

  // Store in connections map
  this.connections.set(peerId, peerData);

  // Handle incoming messages
  connection.on('data', data => {
    this.handlePeerMessage(peerId, data);
  });

  // Handle disconnection
  connection.on('close', () => {
    console.log(`👋 Peer disconnected: ${peerId.slice(0, 16)}...`);
    this.connections.delete(peerId);
    this.emit('peer-disconnected', peerId);
  });

  // Handle errors
  connection.on('error', error => {
    console.error(
      `❌ Connection error with ${peerId.slice(0, 16)}: ${error.message}`
    );
    this.connections.delete(peerId);
  });

  this.emit('peer-connected', peerId);
}
```

**Flow**:
```
Connection established
       ↓
Extract peer ID from public key
       ↓
Create peerData object
       ↓
Store in connections Map
       ↓
Setup event listeners (data, close, error)
       ↓
Emit 'peer-connected' event
```

**Event Listeners**:

1. **'data'**: Received message from peer
   ```javascript
   connection.on('data', data => {
     this.handlePeerMessage(peerId, data);
   });
   ```

2. **'close'**: Peer disconnected
   ```javascript
   connection.on('close', () => {
     this.connections.delete(peerId);
     this.emit('peer-disconnected', peerId);
   });
   ```

3. **'error'**: Connection error
   ```javascript
   connection.on('error', error => {
     console.error(`❌ Connection error: ${error.message}`);
     this.connections.delete(peerId);
   });
   ```

**Peer ID**: 
- Uses peer's public key as ID
- Unique identifier for this connection
- Hex string (64 characters)

---

### 5.6 Handle Peer Message

```javascript
handlePeerMessage(peerId, data) {
  try {
    const message = JSON.parse(data.toString());
    const peerData = this.connections.get(peerId);

    if (!peerData) {
      return;  // Peer disconnected
    }

    // Route based on message type
    switch (message.type) {
      case 'root-peer-announce':
        this.handleRootPeerAnnounce(peerId, message);
        break;

      case 'public-key':
        this.handlePublicKeyExchange(peerId, message);
        break;

      case 'chat-message':
        this.handleChatMessage(peerId, message);
        break;

      case 'sync-response':
        this.handleSyncResponse(peerId, message);
        break;

      default:
        console.log(`❓ Unknown message type: ${message.type}`);
    }
  } catch (error) {
    // Not JSON - might be Hypercore replication data
    // This is normal for the protocol
  }
}
```

**Message Routing**:
```
Incoming data
     ↓
Parse as JSON
     ↓
Get message.type
     ↓
┌────┴─────────────────────────┐
│                               │
↓                               ↓
root-peer-announce      public-key
     ↓                         ↓
Mark as root peer       Store public key
     ↓                         ↓
Request sync            Can now encrypt
     │                         │
     └────────┬────────────────┘
              ↓
        chat-message
              ↓
        Decrypt & emit
              ↓
        sync-response
              ↓
        Load history
```

**Error Handling**:
- `try/catch` around JSON parsing
- Non-JSON data silently ignored
- Hypercore sends binary protocol data (normal)

---

### 5.7 Root Peer Announce

```javascript
handleRootPeerAnnounce(peerId, message) {
  const peerData = this.connections.get(peerId);
  if (peerData) {
    peerData.isRootPeer = true;
    console.log(`🏰 Connected to root peer: ${peerId.slice(0, 16)}...`);

    // Request message history
    this.syncWithRootPeer(peerId);
    
    this.emit('root-peer-connected', peerId);
  }
}
```

**What Happens**:
1. Mark peer as root peer: `peerData.isRootPeer = true`
2. Request message history sync
3. Emit event for UI (shows "Connected to server")

**Root Peer Identification**:
- Root peer sends `{type: 'root-peer-announce'}` first
- No other authentication (trust on first connect)
- Production would add signature verification

---

### 5.8 Public Key Exchange

```javascript
handlePublicKeyExchange(peerId, message) {
  const peerData = this.connections.get(peerId);
  if (peerData) {
    peerData.publicKey = b4a.from(message.publicKey, 'base64');
    peerData.username = message.username;
    console.log(`🔑 Exchanged keys with ${message.username}`);
  }
}
```

**Message Format**:
```javascript
{
  type: 'public-key',
  publicKey: 'Rj3k9mF2xL...==',  // Base64
  username: 'Alice'
}
```

**Purpose**: Exchange encryption keys before sending messages

**Flow**:
```
Alice connects to Bob
        ↓
Alice sends public-key message
        ↓
Bob receives and stores Alice's public key
        ↓
Bob sends his public-key message
        ↓
Alice receives and stores Bob's public key
        ↓
Both can now encrypt messages to each other
```

---

### 5.9 Handle Chat Message

```javascript
async handleChatMessage(peerId, message) {
  const peerData = this.connections.get(peerId);
  if (!peerData) {
    return;
  }

  let decryptedMessage;

  if (message.encrypted) {
    // Decrypt encrypted message
    decryptedMessage = await this.crypto.decryptMessage(message);
    if (!decryptedMessage) {
      console.warn('⚠️  Failed to decrypt message');
      return;  // Ignore undecryptable messages
    }
  } else {
    // Plain message (from sync)
    decryptedMessage = message;
  }

  console.log(`💬 [${decryptedMessage.sender}]: ${decryptedMessage.text}`);
  
  this.emit('message', {
    ...decryptedMessage,
    peerId,
    timestamp: message.timestamp || Date.now(),
  });
}
```

**Two Message Types**:

1. **Encrypted** (real-time P2P):
   ```javascript
   {
     type: 'chat-message',
     encrypted: true,
     ciphertext: '...',
     nonce: '...',
     sender: '...'
   }
   ```

2. **Plain** (from sync):
   ```javascript
   {
     type: 'chat-message',
     text: 'Hello',
     sender: 'Alice',
     timestamp: 1696348800000
   }
   ```

**Decryption**:
- Encrypted messages decrypted first
- If decryption fails, message ignored
- Plain messages passed through

**Event Emission**:
```javascript
this.emit('message', {
  text: 'Hello',
  sender: 'Alice',
  timestamp: 1696348800000,
  peerId: 'abc123...'
});
```
- ChatClient listens for this
- ChatClient stores and displays message

---

### 5.10 Handle Sync Response

```javascript
handleSyncResponse(peerId, message) {
  const {messages} = message;
  console.log(`✅ Synced ${messages.length} messages from root peer`);

  // Emit each message
  messages.forEach(msg => {
    this.emit('message', {
      ...msg,
      fromSync: true,  // Mark as historical
      peerId,
    });
  });
}
```

**Sync Response Format**:
```javascript
{
  type: 'sync-response',
  messages: [
    {text: 'Hello', sender: 'Alice', timestamp: 1696348800000},
    {text: 'Hi!', sender: 'Bob', timestamp: 1696348801000},
    // ... more messages
  ]
}
```

**`fromSync: true`**: 
- Marks messages as historical
- UI can display differently (e.g., no notification)
- Prevents duplicate storage

---

### 5.11 Broadcast Message

```javascript
async broadcastMessage(message) {
  const room = this.roomManager.getCurrentRoom();
  if (!room) {
    return {sentCount: 0, rootPeerCount: 0};
  }

  let sentToPeers = 0;
  let sentToRootPeers = 0;

  for (const [peerId, peerData] of this.connections) {
    try {
      if (peerData.isRootPeer) {
        // Send unencrypted to root peer
        const rootPeerMessage = {
          type: 'store-message',
          roomName: room.roomId,
          message: message,
        };
        peerData.connection.write(JSON.stringify(rootPeerMessage));
        sentToRootPeers++;
        
      } else if (peerData.publicKey) {
        // Send encrypted to regular peers
        const encryptedMessage = await this.crypto.encryptMessage(
          message,
          peerData.publicKey,
        );
        
        const messagePayload = {
          type: 'chat-message',
          ...encryptedMessage,
          encrypted: true,
        };
        
        peerData.connection.write(JSON.stringify(messagePayload));
        sentToPeers++;
      }
    } catch (error) {
      console.error(
        `Failed to send to ${peerId.slice(0, 16)}: ${error.message}`
      );
    }
  }

  console.log(
    `📤 Message sent to ${sentToPeers} peers, ${sentToRootPeers} root peers`
  );
  
  return {sentCount: sentToPeers, rootPeerCount: sentToRootPeers};
}
```

**Two Paths**:

1. **To Root Peer** (unencrypted):
   ```javascript
   {
     type: 'store-message',
     roomName: 'room-id-123...',
     message: {
       text: 'Hello',
       sender: 'Alice',
       timestamp: 1696348800000
     }
   }
   ```
   - Sent unencrypted for storage
   - Root peer persists for offline delivery

2. **To Regular Peers** (encrypted):
   ```javascript
   {
     type: 'chat-message',
     encrypted: true,
     ciphertext: '...',
     nonce: '...',
     sender: '...'
   }
   ```
   - Encrypted with recipient's public key
   - End-to-end encryption

**Trade-off**: 
- Root peer sees messages (no E2EE to root)
- Enables offline message delivery
- Could be improved with forward secrecy

---

### 5.12 Sync with Root Peer

```javascript
syncWithRootPeer(peerId) {
  const peerData = this.connections.get(peerId);
  const room = this.roomManager.getCurrentRoom();

  if (peerData && room) {
    const syncRequest = {
      type: 'sync-request',
      roomName: room.roomId,
      lastIndex: 0,  // Sync from beginning
    };

    peerData.connection.write(JSON.stringify(syncRequest));
    console.log(`🔄 Requested sync from root peer`);
  }
}
```

**Sync Request Format**:
```javascript
{
  type: 'sync-request',
  roomName: 'room-id-123...',
  lastIndex: 0
}
```

**`lastIndex: 0`**: 
- Get ALL messages from start
- Could track last seen index for efficiency
- Root peer responds with sync-response

---

### 5.13 Stop Networking

```javascript
async stop() {
  if (!this.isStarted) {
    return;
  }

  console.log('🛑 Stopping P2P network...');
  
  await this.swarm.destroy();
  this.connections.clear();
  this.isStarted = false;
  
  console.log('✅ P2P network stopped');
}
```

**Cleanup**:
1. Destroy Hyperswarm (closes all connections)
2. Clear connections Map
3. Reset started flag

**When Called**:
- User leaves chat room
- App closes
- Switching to different room

---

## 6. Core Module: StorageManager

**File**: `/src/storage/StorageManager.js`

Simple module for local message persistence using AsyncStorage.

### 6.1 Complete Implementation

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

class StorageManager {
  constructor() {
    this.roomId = null;
    this.storageKey = null;
  }

  async init(roomId) {
    this.roomId = roomId;
    this.storageKey = `room_messages_${roomId}`;
    console.log(`💾 Initialized storage for room: ${roomId}`);
  }

  async storeMessage(message) {
    try {
      const messages = await this.getMessages();
      messages.push({
        ...message,
        storedAt: Date.now(),
      });

      await AsyncStorage.setItem(
        this.storageKey,
        JSON.stringify(messages)
      );
      
      console.log(`✅ Message stored (${messages.length} total)`);
      return true;
    } catch (error) {
      console.error('❌ Failed to store message:', error);
      return false;
    }
  }

  async getMessages() {
    try {
      const data = await AsyncStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('❌ Failed to get messages:', error);
      return [];
    }
  }

  async clearMessages() {
    try {
      await AsyncStorage.removeItem(this.storageKey);
      console.log('🗑️  Cleared message history');
      return true;
    } catch (error) {
      console.error('❌ Failed to clear messages:', error);
      return false;
    }
  }
}
```

**Storage Key Format**:
```javascript
`room_messages_${roomId}`
// Example: "room_messages_7d3a9f2e4c1b8a5d..."
```

**Message Storage Format**:
```json
[
  {
    "text": "Hello!",
    "sender": "Alice",
    "timestamp": 1696348800000,
    "storedAt": 1696348800123
  },
  {
    "text": "Hi Alice!",
    "sender": "Bob",
    "timestamp": 1696348801000,
    "storedAt": 1696348801234
  }
]
```

**Key Methods**:

1. **`init(roomId)`**: Setup storage for specific room
2. **`storeMessage(message)`**: Append message to storage
3. **`getMessages()`**: Load all messages for room
4. **`clearMessages()`**: Delete message history

**Use Cases**:
- App restart: Load previous messages
- Offline: Store messages locally
- History: Show previous conversation

---

## 7. Core Module: ChatClient

**File**: `/src/chat/ChatClient.js`

The **orchestrator** - coordinates all other modules and provides unified API to UI.

### 7.1 Constructor

```javascript
import EventEmitter from 'events';
import RoomManager from '../rooms/RoomManager';
import NetworkManager from '../network/NetworkManager';
import StorageManager from '../storage/StorageManager';

class ChatClient extends EventEmitter {
  constructor() {
    super();
    this.roomManager = new RoomManager();
    this.networkManager = null;  // Created when room ready
    this.storageManager = new StorageManager();
    this.isConnected = false;
  }
}
```

**Architecture**:
```
ChatClient (Orchestrator)
    ├── RoomManager (created immediately)
    ├── NetworkManager (created when room ready)
    └── StorageManager (created immediately)
```

**Why NetworkManager Created Later**:
- Needs room information first
- Created in `createRoom()` or `joinRoom()`

---

### 7.2 Create Room

```javascript
async createRoom(username) {
  try {
    // Step 1: Create room
    const result = await this.roomManager.createRoom(username);
    if (!result.success) {
      throw new Error(result.error);
    }

    // Step 2: Initialize storage
    await this.storageManager.init(result.roomId);

    // Step 3: Create network manager
    this.networkManager = new NetworkManager(
      this.roomManager,
      this.roomManager.crypto,
    );

    // Step 4: Setup event forwarding
    this.setupNetworkEvents();

    // Step 5: Start P2P networking
    await this.networkManager.start();

    // Step 6: Register with root peer
    await this.registerRoomWithRootPeer();

    this.isConnected = true;
    console.log('✅ Room created and network started');

    return {
      success: true,
      roomKey: result.roomKey,
      roomId: result.roomId,
    };
  } catch (error) {
    console.error('❌ Failed to create room:', error);
    return {success: false, error: error.message};
  }
}
```

**Complete Flow**:
```
createRoom(username)
       ↓
1. RoomManager.createRoom()
   • Generate room key
   • Derive room ID
   • Load user keys
   • Save room info
       ↓
2. StorageManager.init()
   • Setup message storage
       ↓
3. Create NetworkManager
   • Pass dependencies
       ↓
4. Setup event forwarding
   • Forward network events to UI
       ↓
5. NetworkManager.start()
   • Join swarms
   • Start accepting connections
       ↓
6. Register with root peer
   • Tell root peer about room
       ↓
Return {roomKey, roomId}
```

**Return Value**:
```javascript
{
  success: true,
  roomKey: 'a3f29c4d7e8b1a5c...',  // Share with others!
  roomId: '7d3a9f2e4c1b8a5d...'
}
```

---

### 7.3 Join Room

```javascript
async joinRoom(roomKey, username) {
  try {
    // Step 1: Join room
    const result = await this.roomManager.joinRoom(roomKey, username);
    if (!result.success) {
      throw new Error(result.error);
    }

    // Step 2: Initialize storage
    await this.storageManager.init(result.roomId);

    // Step 3: Load message history
    const messages = await this.storageManager.getMessages();
    messages.forEach(msg => {
      this.emit('message', msg);
    });

    // Step 4: Create network manager
    this.networkManager = new NetworkManager(
      this.roomManager,
      this.roomManager.crypto,
    );

    // Step 5: Setup event forwarding
    this.setupNetworkEvents();

    // Step 6: Start P2P networking
    await this.networkManager.start();

    // Step 7: Register with root peer
    await this.registerRoomWithRootPeer();

    this.isConnected = true;
    console.log('✅ Joined room and network started');

    return {success: true, roomId: result.roomId};
  } catch (error) {
    console.error('❌ Failed to join room:', error);
    return {success: false, error: error.message};
  }
}
```

**Key Difference from `createRoom()`**:

**Step 3: Load Message History**
```javascript
const messages = await this.storageManager.getMessages();
messages.forEach(msg => {
  this.emit('message', msg);
});
```
- Loads previously stored messages
- Emits each to UI for display
- Shows conversation history immediately

**Flow**:
```
joinRoom(roomKey, username)
       ↓
1. RoomManager.joinRoom()
       ↓
2. StorageManager.init()
       ↓
3. Load & emit history ← DIFFERENT
       ↓
4. Create NetworkManager
       ↓
5. Setup events
       ↓
6. Start networking
       ↓
7. Register with root peer
       ↓
8. Sync with root peer (in NetworkManager)
```

---

### 7.4 Setup Network Events

```javascript
setupNetworkEvents() {
  // Peer connected
  this.networkManager.on('peer-connected', peerId => {
    console.log(`📱 Peer connected: ${peerId.slice(0, 16)}`);
    this.emit('peer-connected', peerId);
  });

  // Peer disconnected
  this.networkManager.on('peer-disconnected', peerId => {
    console.log(`📱 Peer disconnected: ${peerId.slice(0, 16)}`);
    this.emit('peer-disconnected', peerId);
  });

  // Root peer connected
  this.networkManager.on('root-peer-connected', peerId => {
    console.log('📱 Root peer connected');
    this.emit('root-peer-connected', peerId);
  });

  // Message received
  this.networkManager.on('message', async message => {
    // Store locally
    await this.storageManager.storeMessage(message);

    // Forward to UI
    this.emit('message', message);
  });
}
```

**Event Forwarding Pattern**:
```
NetworkManager        ChatClient           UI (ChatScreen)
      │                   │                       │
  emit('message')    on('message')         on('message')
      │──────────────────►│                       │
                          │ storeMessage()        │
                          │                       │
                      emit('message')             │
                          │───────────────────────►│
                                             Display!
```

**Why This Pattern**:
- **Encapsulation**: UI only talks to ChatClient
- **Flexibility**: Can swap NetworkManager implementation
- **Processing**: ChatClient adds storage before forwarding
- **Simplicity**: UI has single event source

---

### 7.5 Send Message

```javascript
async sendMessage(text) {
  try {
    if (!this.isConnected) {
      throw new Error('Not connected to network');
    }

    const room = this.roomManager.getCurrentRoom();
    
    const message = {
      text,
      sender: room.username,
      timestamp: Date.now(),
    };

    // Store locally FIRST
    await this.storageManager.storeMessage(message);

    // Broadcast to network
    const result = await this.networkManager.broadcastMessage(message);

    console.log(`✅ Message sent to ${result.sentCount} peers`);

    // Emit for local display
    this.emit('message', message);

    return true;
  } catch (error) {
    console.error('❌ Failed to send message:', error);
    return false;
  }
}
```

**Message Sending Flow**:
```
User types message
       ↓
sendMessage('Hello')
       ↓
1. Create message object
   {text, sender, timestamp}
       ↓
2. Store locally FIRST
   (ensures not lost)
       ↓
3. Broadcast to network
   • Encrypt for each peer
   • Send to root peer
       ↓
4. Emit for local display
   (optimistic UI)
       ↓
UI shows message immediately
```

**Optimistic UI**:
- Message shown before network confirms
- Better user experience
- If send fails, message still saved locally

---

### 7.6 Additional Methods

```javascript
async registerRoomWithRootPeer() {
  // Wait briefly for root peer connection
  await new Promise(resolve => setTimeout(resolve, 1000));

  const room = this.roomManager.getCurrentRoom();
  const publicKey = this.roomManager.crypto.getPublicKeyHex();

  for (const [peerId, peerData] of this.networkManager.connections) {
    if (peerData.isRootPeer) {
      const registration = {
        type: 'room-register',
        roomName: room.roomId,
        username: room.username,
        publicKey: publicKey,
      };

      peerData.connection.write(JSON.stringify(registration));
      console.log('📝 Registered room with root peer');
      break;
    }
  }
}
```

**Purpose**: Notify root peer about room participation

**Registration Message**:
```javascript
{
  type: 'room-register',
  roomName: 'room-id-123...',
  username: 'Alice',
  publicKey: 'abc123...'
}
```

---

```javascript
async disconnect() {
  try {
    if (this.networkManager) {
      await this.networkManager.stop();
    }
    this.isConnected = false;
    console.log('✅ Disconnected from chat');
  } catch (error) {
    console.error('❌ Failed to disconnect:', error);
  }
}
```

**Purpose**: Clean shutdown

**Called When**:
- User leaves room
- App closes
- Switching rooms

---

## 8. UI Screens Explained

### 8.1 WelcomeScreen

**File**: `/screens/WelcomeScreen.js`

**Purpose**: Landing page with two options

```javascript
const WelcomeScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔐 P2P Encrypted Chat</Text>
      <Text style={styles.subtitle}>Secure, decentralized messaging</Text>
      
      <TouchableOpacity onPress={() => navigation.navigate('CreateRoom')}>
        <Text>Create New Room</Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => navigation.navigate('JoinRoom')}>
        <Text>Join Existing Room</Text>
      </TouchableOpacity>
    </View>
  );
};
```

**User Flow**:
```
Welcome Screen
     ├── Create New Room → CreateRoomScreen
     └── Join Existing Room → JoinRoomScreen
```

**Key Points**:
- Simple landing page
- Two navigation options
- No state management
- Just navigation logic

---

### 8.2 CreateRoomScreen

**File**: `/screens/CreateRoomScreen.js`

**Purpose**: Create new chat room and get room key

#### **State Management**

```javascript
const [username, setUsername] = useState('');
const [loading, setLoading] = useState(false);
const [roomCreated, setRoomCreated] = useState(false);
const [roomKey, setRoomKey] = useState('');
```

**State Variables**:
- `username`: User's chosen display name
- `loading`: Shows loading spinner during creation
- `roomCreated`: Switches to "room created" view
- `roomKey`: Generated room key for sharing

---

#### **Create Room Flow**

```javascript
const handleCreateRoom = async () => {
  if (!username.trim()) {
    Alert.alert('Error', 'Please enter a username');
    return;
  }

  setLoading(true);

  try {
    const chatClient = new ChatClient();
    const result = await chatClient.createRoom(username.trim());

    if (result.success) {
      setRoomKey(result.roomKey);
      setRoomCreated(true);

      // Navigate to chat with client instance
      navigation.navigate('Chat', {
        chatClient,
        roomInfo: {
          roomId: result.roomId,
          roomKey: result.roomKey,
          username: username.trim(),
          isCreator: true,
        },
      });
    } else {
      Alert.alert('Error', result.error);
    }
  } catch (error) {
    Alert.alert('Error', error.message);
  } finally {
    setLoading(false);
  }
};
```

**Step by Step**:

1. **Validate Input**:
   ```javascript
   if (!username.trim()) {
     Alert.alert('Error', 'Please enter a username');
     return;
   }
   ```

2. **Create ChatClient Instance**:
   ```javascript
   const chatClient = new ChatClient();
   ```
   - New instance for this room
   - Will be passed to ChatScreen

3. **Create Room**:
   ```javascript
   const result = await chatClient.createRoom(username.trim());
   ```
   - Calls ChatClient.createRoom()
   - Triggers entire room creation flow
   - Returns room key and ID

4. **Navigate to Chat**:
   ```javascript
   navigation.navigate('Chat', {
     chatClient,        // Pass instance!
     roomInfo: {
       roomId: result.roomId,
       roomKey: result.roomKey,
       username: username.trim(),
       isCreator: true,
     },
   });
   ```
   - Passes chatClient instance via navigation
   - Includes room metadata
   - `isCreator: true` for UI customization

---

#### **Share Room Key**

```javascript
const shareRoomKey = async () => {
  try {
    await Share.share({
      message: `Join my encrypted chat room!\n\nRoom Key: ${roomKey}\n\nDownload the P2P Chat app and use this key to join.`,
      title: 'P2P Chat Room Key',
    });
  } catch (error) {
    console.error('Failed to share:', error);
  }
};

const copyRoomKey = () => {
  Clipboard.setString(roomKey);
  Alert.alert('Copied', 'Room key copied to clipboard!');
};
```

**Room Key Sharing**:
- **Share**: Native share sheet (SMS, email, etc.)
- **Copy**: Copy to clipboard
- **Warning**: "Keep this key secure!"

**Security Note**: Room key is the ONLY authentication mechanism!

---

### 8.3 JoinRoomScreen

**File**: `/screens/JoinRoomScreen.js`

**Purpose**: Join existing room using room key

#### **State Management**

```javascript
const [username, setUsername] = useState('');
const [roomKey, setRoomKey] = useState('');
const [loading, setLoading] = useState(false);
```

---

#### **Join Room Flow**

```javascript
const handleJoinRoom = async () => {
  // Validate username
  if (!username.trim()) {
    Alert.alert('Error', 'Please enter a username');
    return;
  }

  // Validate room key
  if (!roomKey.trim()) {
    Alert.alert('Error', 'Please enter a room key');
    return;
  }

  // Validate room key format (64 hex characters)
  if (roomKey.trim().length !== 64) {
    Alert.alert(
      'Error',
      'Invalid room key format. Key should be 64 characters.',
    );
    return;
  }

  setLoading(true);

  try {
    const chatClient = new ChatClient();
    const result = await chatClient.joinRoom(
      roomKey.trim(),
      username.trim()
    );

    if (result.success) {
      navigation.navigate('Chat', {
        chatClient,
        roomInfo: {
          roomId: result.roomId,
          roomKey: roomKey.trim(),
          username: username.trim(),
          isCreator: false,
        },
        cachedMessages: result.cachedMessages || [],
      });
    } else {
      Alert.alert('Error', result.error);
    }
  } catch (error) {
    Alert.alert('Error', error.message);
  } finally {
    setLoading(false);
  }
};
```

**Key Validation**:
```javascript
if (roomKey.trim().length !== 64) {
  Alert.alert('Error', 'Invalid room key format. Key should be 64 characters.');
  return;
}
```
- Room key MUST be exactly 64 hex characters
- Represents 32 bytes
- Invalid keys rejected early

**Key Difference from Create**:
- `isCreator: false` in navigation params
- Includes `cachedMessages` (historical messages)

---

### 8.4 ChatScreen

**File**: `/screens/ChatScreen.js`

**Purpose**: Main chat interface

#### **State Management**

```javascript
const {chatClient, roomInfo, cachedMessages = []} = route.params;
const [messages, setMessages] = useState(cachedMessages);
const [inputText, setInputText] = useState('');
const [connectedPeers, setConnectedPeers] = useState([]);
const [isConnectedToRoot, setIsConnectedToRoot] = useState(false);
const flatListRef = useRef(null);
```

**Props from Navigation**:
- `chatClient`: ChatClient instance
- `roomInfo`: Room metadata
- `cachedMessages`: Historical messages (from join)

---

#### **Event Listeners Setup**

```javascript
useEffect(() => {
  // Message received
  chatClient.on('message', messageData => {
    setMessages(prev => {
      // Avoid duplicates
      const exists = prev.find(m => m.messageId === messageData.messageId);
      if (exists) return prev;

      // Add and sort by timestamp
      const newMessages = [...prev, messageData];
      return newMessages.sort((a, b) => 
        (a.timestamp || 0) - (b.timestamp || 0)
      );
    });
  });

  // Peer connected
  chatClient.on('peer-connected', peerId => {
    console.log(`🤝 Peer connected: ${peerId}`);
    updateConnectedPeers();
  });

  // Peer disconnected
  chatClient.on('peer-disconnected', peerId => {
    console.log(`👋 Peer disconnected: ${peerId}`);
    updateConnectedPeers();
  });

  // Root peer connected
  chatClient.on('root-peer-connected', peerId => {
    console.log(`🏰 Root peer connected: ${peerId}`);
    setIsConnectedToRoot(true);
  });

  // Cleanup on unmount
  return () => {
    chatClient.removeAllListeners();
  };
}, [chatClient]);
```

**Event Handling**:

1. **'message' Event**:
   - Adds message to state
   - Deduplicates by messageId
   - Sorts by timestamp
   - Triggers re-render

2. **'peer-connected' / 'peer-disconnected'**:
   - Updates peer count
   - Shows in header

3. **'root-peer-connected'**:
   - Shows "Connected to server" indicator
   - Green dot in UI

---

#### **Send Message**

```javascript
const handleSendMessage = async () => {
  const text = inputText.trim();
  if (!text) return;

  setInputText('');  // Clear input immediately

  try {
    const result = await chatClient.sendMessage(text);
    if (!result.success) {
      Alert.alert('Error', `Failed to send message: ${result.error}`);
    }
  } catch (error) {
    Alert.alert('Error', `Failed to send message: ${error.message}`);
  }
};
```

**Flow**:
```
User types message
       ↓
Press send button
       ↓
Clear input immediately (optimistic UI)
       ↓
Call chatClient.sendMessage()
       ↓
ChatClient broadcasts to peers
       ↓
ChatClient emits 'message' event
       ↓
useEffect receives event
       ↓
Message added to state
       ↓
UI re-renders with message
```

**Optimistic UI**: Input cleared before network confirmation

---

#### **Message Rendering**

```javascript
const renderMessage = ({item}) => {
  const isOwnMessage = item.sender === roomInfo.username || item.fromSelf;

  return (
    <View style={[
      styles.messageContainer,
      isOwnMessage ? styles.ownMessage : styles.otherMessage,
    ]}>
      <View style={[
        styles.messageBubble,
        isOwnMessage ? styles.ownBubble : styles.otherBubble,
      ]}>
        {!isOwnMessage && (
          <Text style={styles.senderName}>{item.sender}</Text>
        )}
        <Text style={styles.messageText}>{item.text}</Text>
        <Text style={styles.timestamp}>
          {formatTimestamp(item.timestamp)}
          {item.fromSync && ' 📥'}
        </Text>
      </View>
    </View>
  );
};
```

**Message Layout**:
```
Own messages (right side):
┌─────────────────────────┐
│         ┌───────────┐   │
│         │ Message   │   │ Blue bubble
│         │ Text      │   │
│         │      10:30│   │ Timestamp
│         └───────────┘   │
└─────────────────────────┘

Other messages (left side):
┌─────────────────────────┐
│ ┌─────────────┐         │
│ │ Alice       │         │ Sender name
│ │ Message     │         │ Gray bubble
│ │ Text        │         │
│ │ 10:30 📥    │         │ Timestamp + sync icon
│ └─────────────┘         │
└─────────────────────────┘
```

**Special Indicators**:
- `item.fromSync`: Shows 📥 icon (synced from history)
- Own vs other: Different alignment and colors

---

#### **Header with Status**

```javascript
const renderHeader = () => (
  <View style={styles.header}>
    <TouchableOpacity onPress={handleLeaveRoom}>
      <Text style={styles.leaveButton}>← Leave</Text>
    </TouchableOpacity>

    <View style={styles.headerCenter}>
      <Text style={styles.headerTitle}>{roomInfo.username}</Text>
      <Text style={styles.headerSubtitle}>
        {connectedPeers.length} peer{connectedPeers.length !== 1 ? 's' : ''}
        {isConnectedToRoot && ' • 🟢 Server'}
      </Text>
    </View>
  </View>
);
```

**Header Shows**:
- Username
- Peer count: "2 peers"
- Server status: "🟢 Server" (if connected to root peer)
- Leave button

**Example Headers**:
```
← Leave    Alice
           1 peer • 🟢 Server

← Leave    Bob
           3 peers

← Leave    Charlie
           0 peers
```

---

#### **Leave Room**

```javascript
const handleLeaveRoom = () => {
  Alert.alert(
    'Leave Room',
    'Are you sure you want to leave this room?',
    [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await chatClient.stop();  // Disconnect from network
          navigation.popToTop();     // Return to welcome screen
        },
      },
    ]
  );
};
```

**Cleanup**:
1. Confirm with user
2. Call `chatClient.stop()` (closes all connections)
3. Navigate back to welcome screen
4. useEffect cleanup removes event listeners

---

## 9. Backend Server Explained

**File**: `/backend/ChatRootPeer.js`

The root peer is a **Node.js server** that provides:
1. **Message persistence** (store messages for offline users)
2. **Discovery point** (well-known server to connect to)
3. **Message sync** (send history to joining peers)

### 9.1 Server Initialization

```javascript
import Hyperswarm from 'hyperswarm';
import crypto from 'hypercore-crypto';
import b4a from 'b4a';

class ChatRootPeer {
  constructor() {
    this.swarm = new Hyperswarm();
    this.rooms = new Map();  // roomId -> room data
    this.connections = new Map();  // peerId -> connection info
  }

  async start() {
    console.log('🏰 Starting Root Peer Server...');

    // Join discovery swarm (same topic as clients)
    const discoveryTopic = crypto.hash(
      b4a.from('holepunch-root-peer-discovery')
    );
    
    this.swarm.join(discoveryTopic, {client: false, server: true});

    // Handle incoming connections
    this.swarm.on('connection', (conn, info) => {
      this.handleConnection(conn, info);
    });

    console.log('✅ Root Peer Server started');
  }
}
```

**Key Configuration**:
```javascript
{client: false, server: true}
```
- **server: true**: Accept connections
- **client: false**: Don't initiate connections
- Acts as a server, not peer

---

### 9.2 Handle Connection

```javascript
handleConnection(conn, info) {
  const peerId = info.publicKey.toString('hex');
  console.log(`🤝 Client connected: ${peerId.slice(0, 16)}...`);

  // Store connection
  this.connections.set(peerId, {
    connection: conn,
    publicKey: info.publicKey,
    peerId,
    rooms: [],  // Rooms this peer is in
  });

  // Announce as root peer
  this.announceRootPeer(conn);

  // Handle messages
  conn.on('data', data => {
    this.handleClientMessage(peerId, data);
  });

  // Handle disconnection
  conn.on('close', () => {
    console.log(`👋 Client disconnected: ${peerId.slice(0, 16)}...`);
    this.connections.delete(peerId);
  });
}
```

**Root Peer Announce**:
```javascript
announceRootPeer(conn) {
  const announcement = {
    type: 'root-peer-announce',
    message: 'Root peer connected',
  };
  conn.write(JSON.stringify(announcement));
}
```
- Immediately tells client: "I'm the root peer"
- Client marks this connection as root peer
- Client requests sync

---

### 9.3 Handle Client Messages

```javascript
handleClientMessage(peerId, data) {
  try {
    const message = JSON.parse(data.toString());

    switch (message.type) {
      case 'room-register':
        this.handleRoomRegistration(peerId, message);
        break;

      case 'store-message':
        this.handleStoreMessage(peerId, message);
        break;

      case 'sync-request':
        this.handleSyncRequest(peerId, message);
        break;

      default:
        console.log(`❓ Unknown message type: ${message.type}`);
    }
  } catch (error) {
    // Not JSON - ignore
  }
}
```

---

### 9.4 Room Registration

```javascript
handleRoomRegistration(peerId, message) {
  const {roomName, username, publicKey} = message;

  // Create room if doesn't exist
  if (!this.rooms.has(roomName)) {
    this.rooms.set(roomName, {
      roomId: roomName,
      messages: [],
      participants: new Map(),
      createdAt: Date.now(),
    });
    console.log(`🏗️  Created room: ${roomName}`);
  }

  // Add participant to room
  const room = this.rooms.get(roomName);
  room.participants.set(peerId, {
    username,
    publicKey,
    joinedAt: Date.now(),
  });

  // Track room for this peer
  const peerData = this.connections.get(peerId);
  if (peerData) {
    peerData.rooms.push(roomName);
  }

  console.log(`📝 ${username} registered in room ${roomName}`);
}
```

**Room Data Structure**:
```javascript
{
  roomId: 'room-id-123...',
  messages: [
    {text: 'Hello', sender: 'Alice', timestamp: 1696348800000},
    // ... more messages
  ],
  participants: Map {
    'peer-id-1' => {
      username: 'Alice',
      publicKey: 'abc123...',
      joinedAt: 1696348800000
    },
    'peer-id-2' => {username: 'Bob', ...}
  },
  createdAt: 1696348800000
}
```

---

### 9.5 Store Message

```javascript
handleStoreMessage(peerId, message) {
  const {roomName, message: chatMessage} = message;

  const room = this.rooms.get(roomName);
  if (!room) {
    console.warn(`⚠️  Room not found: ${roomName}`);
    return;
  }

  // Store message
  room.messages.push({
    ...chatMessage,
    storedAt: Date.now(),
  });

  console.log(
    `💾 Stored message in ${roomName}: [${chatMessage.sender}] ${chatMessage.text}`
  );
}
```

**Message Storage**:
- Messages stored **unencrypted** in root peer
- Enables offline delivery
- Trade-off: Root peer can read messages

**Production Improvement**:
- Could store encrypted with room key
- Would prevent offline delivery to new users
- Or use sealed box encryption

---

### 9.6 Sync Request

```javascript
handleSyncRequest(peerId, message) {
  const {roomName, lastIndex} = message;

  const room = this.rooms.get(roomName);
  if (!room) {
    console.warn(`⚠️  Room not found for sync: ${roomName}`);
    return;
  }

  // Get messages from lastIndex onwards
  const messages = room.messages.slice(lastIndex);

  // Send sync response
  const peerData = this.connections.get(peerId);
  if (peerData) {
    const syncResponse = {
      type: 'sync-response',
      messages: messages,
      totalCount: room.messages.length,
    };

    peerData.connection.write(JSON.stringify(syncResponse));
    console.log(`✅ Sent ${messages.length} messages to peer`);
  }
}
```

**Sync Flow**:
```
Client connects
       ↓
Root peer announces
       ↓
Client sends sync-request
{type: 'sync-request', roomName: '...', lastIndex: 0}
       ↓
Root peer sends sync-response
{type: 'sync-response', messages: [...], totalCount: 42}
       ↓
Client emits each message
       ↓
UI displays history
```

**`lastIndex` Parameter**:
- `0`: Get all messages
- `42`: Get messages from index 42 onwards
- Enables incremental sync (not implemented in PoC)

---

## 10. Complete Data Flow Examples

### 10.1 Creating a Room and Sending First Message

**Complete end-to-end flow**:

```
┌─────────────────────────────────────────────────────────┐
│ STEP 1: User Creates Room                               │
└─────────────────────────────────────────────────────────┘

User enters username "Alice" → presses "Create Room"
       ↓
CreateRoomScreen.handleCreateRoom()
       ↓
new ChatClient()
       ↓
chatClient.createRoom("Alice")
       ↓
┌────────────────── ChatClient.createRoom() ─────────────┐
│                                                          │
│  1. roomManager.createRoom("Alice")                     │
│     ├── crypto.generateNewRoomKey()                     │
│     │   └── Returns: <Buffer 32 bytes>                  │
│     ├── crypto.deriveRoomId(roomKey)                    │
│     │   └── Returns: "7d3a9f2e..." (64 char hex)        │
│     ├── crypto.loadOrGenerateKeys("Alice")              │
│     │   ├── Check AsyncStorage                          │
│     │   ├── Not found → generate new keypair            │
│     │   └── Save to AsyncStorage                        │
│     └── Save room info to AsyncStorage                  │
│                                                          │
│  2. storageManager.init(roomId)                         │
│     └── Setup storage key: "room_messages_7d3a9f2e..."  │
│                                                          │
│  3. networkManager = new NetworkManager(...)            │
│                                                          │
│  4. setupNetworkEvents()                                │
│     └── Forward events from NetworkManager              │
│                                                          │
│  5. networkManager.start()                              │
│     ├── joinRoomSwarm(roomKey)                          │
│     │   └── swarm.join(roomKey, {client:true, server:true})│
│     ├── joinDiscoverySwarm()                            │
│     │   └── swarm.join(discoveryTopic, {client:true, server:false})│
│     └── Setup connection handler                        │
│                                                          │
│  6. registerRoomWithRootPeer()                          │
│     └── Send 'room-register' to root peer               │
│                                                          │
└──────────────────────────────────────────────────────────┘
       ↓
Navigation.navigate('Chat', {chatClient, roomInfo})
       ↓
ChatScreen renders
       ↓
Setup event listeners (useEffect)
       ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 2: Root Peer Connects                              │
└─────────────────────────────────────────────────────────┘

Hyperswarm discovers root peer on discovery swarm
       ↓
Connection established
       ↓
networkManager.handleConnection(conn, info)
       ↓
Root peer sends {type: 'root-peer-announce'}
       ↓
networkManager.handleRootPeerAnnounce()
       ├── Mark as root peer
       ├── syncWithRootPeer() → request history
       └── emit('root-peer-connected')
       ↓
ChatClient forwards event
       ↓
ChatScreen receives 'root-peer-connected'
       ↓
UI shows: "🟢 Server" in header

┌─────────────────────────────────────────────────────────┐
│ STEP 3: Bob Joins the Room                              │
└─────────────────────────────────────────────────────────┘

Bob enters room key "a3f29c4d..." and username "Bob"
       ↓
JoinRoomScreen.handleJoinRoom()
       ↓
new ChatClient()
       ↓
chatClient.joinRoom("a3f29c4d...", "Bob")
       ↓
┌────────────────── ChatClient.joinRoom() ────────────────┐
│                                                          │
│  1. roomManager.joinRoom(roomKey, "Bob")                │
│     ├── Validate room key (64 chars)                    │
│     ├── crypto.deriveRoomId(roomKey)                    │
│     │   └── Returns: "7d3a9f2e..." (SAME as Alice!)     │
│     ├── crypto.loadOrGenerateKeys("Bob")                │
│     └── Save room info                                  │
│                                                          │
│  2. storageManager.init(roomId)                         │
│                                                          │
│  3. Load cached messages (if any)                       │
│                                                          │
│  4. networkManager = new NetworkManager(...)            │
│                                                          │
│  5. networkManager.start()                              │
│     ├── joinRoomSwarm(roomKey) ← SAME KEY               │
│     └── joinDiscoverySwarm()                            │
│                                                          │
└──────────────────────────────────────────────────────────┘
       ↓
Hyperswarm matches Alice and Bob on room swarm
(Both joined same topic: hash of roomKey)
       ↓
Connection established between Alice and Bob
       ↓
┌──────────────────────────────────────────────────────────┐
│ Alice's Side              │   Bob's Side                 │
├───────────────────────────┼──────────────────────────────┤
│ handleConnection()        │   handleConnection()         │
│   ↓                       │     ↓                        │
│ emit('peer-connected')    │   emit('peer-connected')     │
│   ↓                       │     ↓                        │
│ UI shows "1 peer"         │   UI shows "1 peer"          │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ STEP 4: Alice Sends Message                             │
└─────────────────────────────────────────────────────────┘

Alice types "Hello Bob!" → presses send
       ↓
ChatScreen.handleSendMessage()
       ↓
chatClient.sendMessage("Hello Bob!")
       ↓
┌────────────────── ChatClient.sendMessage() ─────────────┐
│                                                          │
│  1. Create message object:                              │
│     {                                                    │
│       text: "Hello Bob!",                               │
│       sender: "Alice",                                  │
│       timestamp: 1696348800000                          │
│     }                                                    │
│                                                          │
│  2. storageManager.storeMessage(message)                │
│     └── Save to AsyncStorage                            │
│                                                          │
│  3. networkManager.broadcastMessage(message)            │
│     ├── For root peer:                                  │
│     │   └── Send unencrypted {type:'store-message'}     │
│     └── For Bob:                                        │
│         ├── crypto.encryptMessage(message, bobPublicKey)│
│         └── Send encrypted {type:'chat-message'}        │
│                                                          │
│  4. emit('message', message)                            │
│     └── For local display (optimistic UI)               │
│                                                          │
└──────────────────────────────────────────────────────────┘
       ↓
┌──────────────────────────────────────────────────────────┐
│ Root Peer's Side          │   Bob's Side                 │
├───────────────────────────┼──────────────────────────────┤
│ Receives:                 │   Receives:                  │
│ {type:'store-message',    │   {type:'chat-message',      │
│  roomName:'7d3a...',      │    encrypted:true,           │
│  message:{...}}           │    ciphertext:'...',         │
│       ↓                   │    nonce:'...',              │
│ handleStoreMessage()      │    sender:'...'}             │
│   ↓                       │       ↓                      │
│ rooms.get('7d3a...')      │   handleChatMessage()        │
│   .messages.push(msg)     │     ↓                        │
│       ↓                   │   crypto.decryptMessage()    │
│ Message stored!           │     ↓                        │
│                           │   emit('message', ...)       │
│                           │     ↓                        │
│                           │   storageManager.storeMessage()│
│                           │     ↓                        │
│                           │   UI displays "Hello Bob!"   │
└──────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Alice's UI (immediate)    │   Bob's UI (after network) │
├───────────────────────────┼────────────────────────────┤
│ Message appears instantly │   Message appears after    │
│ (from local emit)         │   decryption               │
│                           │                            │
│ ┌─────────────────────┐   │   ┌──────────────┐        │
│ │     ┌───────────┐   │   │   │┌───────────┐ │        │
│ │     │Hello Bob! │   │   │   ││Alice      │ │        │
│ │     │      10:30│   │   │   ││Hello Bob! │ │        │
│ │     └───────────┘   │   │   ││10:30      │ │        │
│ └─────────────────────┘   │   │└───────────┘ │        │
│                           │   └──────────────┘        │
└────────────────────────────────────────────────────────┘
```

---

### 10.2 Offline Message Delivery

**Scenario**: Charlie joins room after Alice sent messages while Charlie was offline

```
┌─────────────────────────────────────────────────────────┐
│ TIMELINE                                                 │
└─────────────────────────────────────────────────────────┘

T=0: Alice creates room
T=1: Bob joins room
T=2: Alice sends: "Hello Bob!"
T=3: Alice sends: "How are you?"
T=4: Bob replies: "I'm good!"
T=5: Bob goes offline (closes app)
T=6: Alice sends: "See you later!"  ← Bob is OFFLINE
T=7: Alice goes offline
T=8: Charlie joins room  ← Everyone is OFFLINE

┌─────────────────────────────────────────────────────────┐
│ STEP 1: Messages Stored in Root Peer                    │
└─────────────────────────────────────────────────────────┘

When Alice sent "See you later!" at T=6:
       ↓
networkManager.broadcastMessage()
       ↓
Sends to root peer (even though Bob offline)
       ↓
Root peer receives {type:'store-message', ...}
       ↓
handleStoreMessage()
       ↓
rooms.get(roomId).messages = [
  {text:"Hello Bob!", sender:"Alice", timestamp:T2},
  {text:"How are you?", sender:"Alice", timestamp:T3},
  {text:"I'm good!", sender:"Bob", timestamp:T4},
  {text:"See you later!", sender:"Alice", timestamp:T6}
]

┌─────────────────────────────────────────────────────────┐
│ STEP 2: Charlie Joins at T=8                            │
└─────────────────────────────────────────────────────────┘

Charlie enters room key → JoinRoomScreen
       ↓
chatClient.joinRoom(roomKey, "Charlie")
       ↓
networkManager.start()
       ↓
Connects to root peer on discovery swarm
       ↓
Root peer announces: {type:'root-peer-announce'}
       ↓
Charlie's networkManager.handleRootPeerAnnounce()
       ↓
syncWithRootPeer(peerId)
       ↓
Sends: {type:'sync-request', roomName:roomId, lastIndex:0}
       ↓
Root peer receives sync-request
       ↓
handleSyncRequest()
       ↓
Gets all messages from rooms.get(roomId).messages
       ↓
Sends: {
  type:'sync-response',
  messages: [
    {text:"Hello Bob!", sender:"Alice", timestamp:T2},
    {text:"How are you?", sender:"Alice", timestamp:T3},
    {text:"I'm good!", sender:"Bob", timestamp:T4},
    {text:"See you later!", sender:"Alice", timestamp:T6}
  ],
  totalCount: 4
}
       ↓
Charlie's networkManager.handleSyncResponse()
       ↓
Emits each message with fromSync:true
       ↓
ChatClient stores each in StorageManager
       ↓
ChatClient forwards to ChatScreen
       ↓
UI displays all 4 messages with 📥 icon

Result: Charlie sees full conversation history!
```

**Key Insight**: Root peer acts as **message buffer** for offline users

---

### 10.3 Multi-Peer Broadcasting

**Scenario**: Room with Alice, Bob, Charlie, and Dave - Alice sends one message

```
┌─────────────────────────────────────────────────────────┐
│ Network Topology                                         │
└─────────────────────────────────────────────────────────┘

        Root Peer (Server)
             ▲
             │
        ┌────┼────┬────┐
        │    │    │    │
     Alice  Bob Charlie Dave
     
All peers connected to each other (full mesh)

┌─────────────────────────────────────────────────────────┐
│ Alice Sends: "Hello everyone!"                           │
└─────────────────────────────────────────────────────────┘

Alice: chatClient.sendMessage("Hello everyone!")
       ↓
networkManager.broadcastMessage(message)
       ↓
Loop through all connections:

┌────────────────────────────────────────────────────────┐
│ Connection 1: Root Peer                                │
├────────────────────────────────────────────────────────┤
│ if (peerData.isRootPeer) {                             │
│   Send unencrypted:                                    │
│   {                                                    │
│     type: 'store-message',                            │
│     roomName: roomId,                                 │
│     message: {                                        │
│       text: "Hello everyone!",                        │
│       sender: "Alice",                                │
│       timestamp: 1696348800000                        │
│     }                                                  │
│   }                                                    │
│ }                                                      │
└────────────────────────────────────────────────────────┘
       ↓
Root peer stores message

┌────────────────────────────────────────────────────────┐
│ Connection 2: Bob                                      │
├────────────────────────────────────────────────────────┤
│ else if (peerData.publicKey) {                         │
│   // Step 1: Encrypt for Bob                          │
│   encryptedMessage = crypto.encryptMessage(           │
│     message,                                          │
│     bobPublicKey  // Bob's public key                 │
│   )                                                    │
│   // Returns: {                                        │
│   //   ciphertext: "encrypted_for_bob...",            │
│   //   nonce: "...",                                   │
│   //   sender: alicePublicKey                         │
│   // }                                                 │
│                                                        │
│   // Step 2: Send encrypted message                   │
│   Send: {                                              │
│     type: 'chat-message',                             │
│     encrypted: true,                                  │
│     ciphertext: "encrypted_for_bob...",               │
│     nonce: "...",                                      │
│     sender: alicePublicKey                            │
│   }                                                    │
│ }                                                      │
└────────────────────────────────────────────────────────┘
       ↓
Bob receives and decrypts

┌────────────────────────────────────────────────────────┐
│ Connection 3: Charlie                                  │
├────────────────────────────────────────────────────────┤
│ // Step 1: Encrypt for Charlie (DIFFERENT encryption) │
│ encryptedMessage = crypto.encryptMessage(             │
│   message,                                            │
│   charliePublicKey  // Charlie's public key           │
│ )                                                      │
│ // Returns: {                                          │
│ //   ciphertext: "encrypted_for_charlie...",  ← DIFF │
│ //   nonce: "...",                             ← DIFF │
│ //   sender: alicePublicKey                          │
│ // }                                                   │
│                                                        │
│ Send: {                                                │
│   type: 'chat-message',                               │
│   encrypted: true,                                    │
│   ciphertext: "encrypted_for_charlie...",             │
│   nonce: "...",                                        │
│   sender: alicePublicKey                              │
│ }                                                      │
└────────────────────────────────────────────────────────┘
       ↓
Charlie receives and decrypts

┌────────────────────────────────────────────────────────┐
│ Connection 4: Dave                                     │
├────────────────────────────────────────────────────────┤
│ // Encrypt for Dave (YET ANOTHER encryption)          │
│ encryptedMessage = crypto.encryptMessage(             │
│   message,                                            │
│   davePublicKey  // Dave's public key                 │
│ )                                                      │
└────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ SUMMARY                                                  │
└─────────────────────────────────────────────────────────┘

One message sent by Alice results in:
  • 1 unencrypted copy → Root peer (for storage)
  • 3 encrypted copies → Bob, Charlie, Dave (each with unique encryption)

Total: 4 messages sent across network
Each peer receives uniquely encrypted version
Only they can decrypt their copy
```

**Key Points**:
- **N peers** = **N messages** sent (one per peer + root)
- Each encrypted **differently** (unique nonce + recipient's public key)
- **No shared secret**: Each pair has unique encryption
- **Scalability concern**: O(N) messages per send

---

### 10.4 App Restart and Message Persistence

**Scenario**: Alice closes app and reopens later

```
┌─────────────────────────────────────────────────────────┐
│ PHASE 1: Before Closing App                             │
└─────────────────────────────────────────────────────────┘

Alice is in room chatting with Bob
Messages received and sent:
  1. Alice: "Hello Bob!"
  2. Bob: "Hi Alice!"
  3. Alice: "How are you?"
  4. Bob: "I'm good!"

Each message automatically stored by ChatClient:
       ↓
networkManager.on('message', async message => {
  await storageManager.storeMessage(message);  ← SAVED
  this.emit('message', message);
});

AsyncStorage now contains:
{
  "room_messages_7d3a9f2e...": [
    {text:"Hello Bob!", sender:"Alice", timestamp:T1, storedAt:T1},
    {text:"Hi Alice!", sender:"Bob", timestamp:T2, storedAt:T2},
    {text:"How are you?", sender:"Alice", timestamp:T3, storedAt:T3},
    {text:"I'm good!", sender:"Bob", timestamp:T4, storedAt:T4}
  ],
  "room_7d3a9f2e...": {
    roomId: "7d3a9f2e...",
    roomKey: "a3f29c4d...",
    isCreator: true,
    username: "Alice",
    createdAt: 1696348800000
  },
  "user_keys_Alice": {
    publicKey: "Rj3k9mF2xL...",
    secretKey: "pQ7vN8hK5w...",
    username: "Alice",
    created: 1696348800000
  }
}

Alice presses Leave → app closes

┌─────────────────────────────────────────────────────────┐
│ PHASE 2: App Reopens                                     │
└─────────────────────────────────────────────────────────┘

Alice opens app → WelcomeScreen
       ↓
Alice taps "Join Existing Room"
       ↓
JoinRoomScreen
       ↓
Alice enters:
  • Username: "Alice" (same as before)
  • Room Key: "a3f29c4d..." (from clipboard/message)
       ↓
handleJoinRoom()
       ↓
chatClient.joinRoom("a3f29c4d...", "Alice")
       ↓
┌────────────────── Inside joinRoom() ───────────────────┐
│                                                          │
│  1. roomManager.joinRoom(roomKey, "Alice")              │
│     └── crypto.loadOrGenerateKeys("Alice")              │
│         ├── Check AsyncStorage: "user_keys_Alice"       │
│         ├── FOUND! Load existing keys                   │
│         └── this.keyPair = {publicKey, secretKey}       │
│              ↑                                           │
│              └── SAME KEYS as before!                   │
│                                                          │
│  2. storageManager.init(roomId)                         │
│                                                          │
│  3. Load message history:                               │
│     const messages = await storageManager.getMessages()│
│     // Returns all 4 messages from AsyncStorage!        │
│                                                          │
│     messages.forEach(msg => {                           │
│       this.emit('message', msg);  ← Emit to UI          │
│     });                                                  │
│                                                          │
│  4. Start networking...                                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
       ↓
ChatScreen renders
       ↓
useEffect receives 4 'message' events
       ↓
UI displays all 4 messages immediately (from local storage)
       ↓
Network connects to root peer
       ↓
Syncs any NEW messages sent while offline
       ↓
Full conversation restored!

┌─────────────────────────────────────────────────────────┐
│ RESULT                                                   │
└─────────────────────────────────────────────────────────┘

Alice sees:
  ✓ All previous messages (from local storage)
  ✓ Same encryption keys (persistent identity)
  ✓ Any new messages (from sync with root peer)

User experience: Seamless continuation!
```

**Key Technologies**:
- **AsyncStorage**: Persistent key-value store
- **Encryption Keys**: Stored per username
- **Messages**: Stored per room
- **Room Info**: Metadata persisted

---

## 11. Key Concepts & Patterns

### 11.1 Encryption Architecture

**Two-Tier Encryption System**:

```
┌─────────────────────────────────────────────────────────┐
│ 1. ROOM KEY (Symmetric)                                  │
├─────────────────────────────────────────────────────────┤
│ • 32 random bytes                                        │
│ • Shared secret among all room members                   │
│ • Used for: Room identification (via derivation)         │
│ • NOT used for message encryption (would need key dist.) │
│                                                          │
│ Security:                                                │
│ • Anyone with room key can join                          │
│ • Acts as "password" for room                            │
│ • Must be transmitted securely (out of band)             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 2. USER KEYPAIRS (Asymmetric)                            │
├─────────────────────────────────────────────────────────┤
│ • Each user has public/secret key pair                   │
│ • Used for: End-to-end encrypted messages                │
│ • Algorithm: Curve25519 + XSalsa20 + Poly1305           │
│                                                          │
│ Message Flow:                                            │
│   Alice → Bob:                                           │
│   1. Alice encrypts with: her secret + Bob's public     │
│   2. Bob decrypts with: his secret + Alice's public     │
│   3. Both derive SAME shared secret (ECDH)              │
│                                                          │
│ Security:                                                │
│ • Even if room key leaked, messages stay encrypted      │
│ • Each pair has unique encryption                       │
│ • Forward secrecy NOT provided (same keys reused)       │
└─────────────────────────────────────────────────────────┘
```

**Trade-offs**:

| Aspect | Current Implementation | Alternative |
|--------|----------------------|-------------|
| **Room Access** | Anyone with room key can join | Add room admin approval |
| **E2E Encryption** | ✅ Peer-to-peer | ❌ Root peer sees unencrypted |
| **Forward Secrecy** | ❌ Keys reused | ✅ Diffie-Hellman per message |
| **Key Distribution** | Manual (share room key) | Automatic (identity servers) |

---

### 11.2 Event-Driven Architecture

**Why EventEmitter Pattern?**

```javascript
// WITHOUT EventEmitter (tight coupling)
class ChatClient {
  async createRoom() {
    // ... room creation ...
    
    // Tightly coupled to UI
    updateUIWithRoomInfo(roomInfo);
    showConnectionStatus(true);
    displayMessage(message);
  }
}

// WITH EventEmitter (loose coupling)
class ChatClient extends EventEmitter {
  async createRoom() {
    // ... room creation ...
    
    // Just emit events
    this.emit('room-created', roomInfo);
    this.emit('connected', true);
    this.emit('message', message);
  }
}

// UI listens
chatClient.on('room-created', roomInfo => {
  // Update UI however you want
});
chatClient.on('message', message => {
  // Display message
});
```

**Benefits**:
1. **Decoupling**: Core modules don't know about UI
2. **Flexibility**: Multiple listeners possible
3. **Testing**: Can listen for events in tests
4. **Reactivity**: UI updates automatically

**Event Flow**:
```
NetworkManager              ChatClient              ChatScreen
     │                          │                       │
 emit('message') ───────────────►│                      │
                             Forward                    │
                      emit('message') ──────────────────►│
                                                    setState()
                                                         │
                                                    Re-render
```

---

### 11.3 Optimistic UI Pattern

**What is Optimistic UI?**

Update UI immediately, before server confirms

```javascript
// PESSIMISTIC (wait for confirmation)
async handleSendMessage() {
  const result = await chatClient.sendMessage(text);
  if (result.success) {
    setInputText('');  // Clear AFTER success
    // Message appears after network
  }
}

// OPTIMISTIC (assume success)
async handleSendMessage() {
  setInputText('');  // Clear IMMEDIATELY
  chatClient.sendMessage(text);
  // Message appears BEFORE network
}
```

**In This App**:

```javascript
chatClient.sendMessage(text) {
  // 1. Store locally first
  await this.storageManager.storeMessage(message);
  
  // 2. Broadcast to network
  await this.networkManager.broadcastMessage(message);
  
  // 3. Emit for local display (optimistic!)
  this.emit('message', message);  ← UI updates here
  
  // Network might still be sending...
}
```

**Benefits**:
- ✅ Feels instant (better UX)
- ✅ Works offline (stored locally)
- ✅ No waiting for network

**Risks**:
- ❌ Shows message even if send fails
- ❌ Need error handling
- ❌ Possible inconsistencies

**Mitigation**:
- Save locally first (ensures not lost)
- Show error if broadcast fails
- Retry failed sends

---

### 11.4 Hyperswarm Discovery

**How Peers Find Each Other**:

```
┌─────────────────────────────────────────────────────────┐
│ STEP 1: Join Swarm with Topic                            │
└─────────────────────────────────────────────────────────┘

Alice: swarm.join(hash("a3f29c4d..."), {client:true, server:true})
Bob:   swarm.join(hash("a3f29c4d..."), {client:true, server:true})
                    ↑
                 Same hash = Same topic

┌─────────────────────────────────────────────────────────┐
│ STEP 2: DHT Announcement                                 │
└─────────────────────────────────────────────────────────┘

Alice's node announces to DHT:
  "I'm interested in topic: 7d3a9f2e..."
  "My address: 192.168.1.10:54321"

Bob's node announces to DHT:
  "I'm interested in topic: 7d3a9f2e..."
  "My address: 192.168.1.20:54322"

┌─────────────────────────────────────────────────────────┐
│ STEP 3: DHT Lookup                                       │
└─────────────────────────────────────────────────────────┘

Alice's node queries DHT:
  "Who else is interested in topic: 7d3a9f2e...?"

DHT responds:
  "Bob at 192.168.1.20:54322"

Bob's node queries DHT:
  "Who else is interested in topic: 7d3a9f2e...?"

DHT responds:
  "Alice at 192.168.1.10:54321"

┌─────────────────────────────────────────────────────────┐
│ STEP 4: Direct Connection                                │
└─────────────────────────────────────────────────────────┘

Alice attempts connection to Bob's address
Bob attempts connection to Alice's address
                    ↓
     One succeeds (or both)
                    ↓
          Direct P2P connection!
                    ↓
    No server in the middle
```

**NAT Traversal**:
- **UPnP/NAT-PMP**: Automatically configure router
- **STUN**: Discover public IP and port
- **ICE**: Try multiple connection methods
- **Relay**: Fallback if direct fails

**Why It's Magic**:
- No central server needed (after discovery)
- Works across different networks
- Automatic NAT traversal
- Encrypted connections

---

### 11.5 Storage Strategy

**Three-Layer Storage**:

```
┌─────────────────────────────────────────────────────────┐
│ LAYER 1: AsyncStorage (Client Device)                   │
├─────────────────────────────────────────────────────────┤
│ • Persistent key-value store                            │
│ • Survives app restarts                                 │
│ • Stored per device                                     │
│                                                          │
│ Keys:                                                    │
│   • user_keys_{username}: Encryption keypair            │
│   • room_{roomId}: Room metadata                        │
│   • room_messages_{roomId}: All messages                │
│                                                          │
│ Pros: Fast, offline, private                            │
│ Cons: Device-specific, limited size                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ LAYER 2: In-Memory (Runtime State)                      │
├─────────────────────────────────────────────────────────┤
│ • JavaScript objects and Maps                           │
│ • Lost on app close                                     │
│ • Fast access                                           │
│                                                          │
│ Stored:                                                 │
│   • this.connections: Active peer connections           │
│   • this.currentRoom: Current room state                │
│   • React state: UI messages array                      │
│                                                          │
│ Pros: Very fast, flexible                               │
│ Cons: Not persistent                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ LAYER 3: Root Peer Storage (Server)                     │
├─────────────────────────────────────────────────────────┤
│ • Node.js Map structures                                │
│ • Lost on server restart (PoC limitation)               │
│ • Accessible by all clients                             │
│                                                          │
│ Stored:                                                 │
│   • rooms Map: All room messages                        │
│   • participants Map: Room members                      │
│                                                          │
│ Pros: Shared, enables offline delivery                  │
│ Cons: Not encrypted, not persistent (in PoC)           │
│                                                          │
│ Production: Would use Redis, PostgreSQL, etc.           │
└─────────────────────────────────────────────────────────┘
```

**Message Flow**:

```
Message sent
     │
     ├──► Layer 2: Add to React state (instant display)
     │
     ├──► Layer 1: Save to AsyncStorage (persist)
     │
     └──► Layer 3: Send to root peer (share)

Message received
     │
     ├──► Layer 2: Add to React state (display)
     │
     └──► Layer 1: Save to AsyncStorage (persist)

App restart
     │
     └──► Layer 1: Load from AsyncStorage → Layer 2
```

---

### 11.6 Security Considerations

**Current Security Posture**:

```
┌─────────────────────────────────────────────────────────┐
│ ✅ WHAT'S SECURE                                         │
├─────────────────────────────────────────────────────────┤
│ • Peer-to-peer encryption (E2EE between peers)          │
│ • Strong cryptography (libsodium/NaCl)                  │
│ • Authenticated encryption (Poly1305 MAC)               │
│ • Persistent key pairs (same identity)                  │
│ • Room access control (need room key)                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ ⚠️  SECURITY GAPS (PoC Limitations)                     │
├─────────────────────────────────────────────────────────┤
│ 1. Root Peer Sees Messages                              │
│    • Messages sent unencrypted to root peer             │
│    • Trade-off for offline delivery                     │
│    • Fix: Encrypt with room key for root peer          │
│                                                          │
│ 2. No Forward Secrecy                                   │
│    • Same keypair used for all messages                 │
│    • If key compromised, all past messages readable     │
│    • Fix: Diffie-Hellman key exchange per session      │
│                                                          │
│ 3. No Key Verification                                  │
│    • Trust public keys on first connect (TOFU)          │
│    • Vulnerable to MITM on first connect               │
│    • Fix: Key fingerprint verification, QR codes        │
│                                                          │
│ 4. Room Key Transmitted Out-of-Band                     │
│    • Manually shared (clipboard, SMS, etc.)             │
│    • Could be intercepted                               │
│    • Fix: QR code, NFC, secure channel                  │
│                                                          │
│ 5. No Root Peer Authentication                          │
│    • First peer to announce is trusted                  │
│    • Could be malicious                                 │
│    • Fix: TLS certificate, known public key             │
│                                                          │
│ 6. Keys Stored Unencrypted                              │
│    • AsyncStorage not encrypted on device               │
│    • Device compromise = key compromise                 │
│    • Fix: Secure Enclave, password encryption           │
└─────────────────────────────────────────────────────────┘
```

**Production Recommendations**:

1. **Encrypt Root Peer Storage**:
   ```javascript
   // Instead of storing plaintext:
   room.messages.push(message);
   
   // Store encrypted:
   const encrypted = encryptWithRoomKey(message, roomKey);
   room.messages.push(encrypted);
   ```

2. **Add Forward Secrecy**:
   ```javascript
   // Generate ephemeral key per session
   const sessionKey = await generateEphemeralKey();
   
   // Use for this session only
   const encrypted = encryptWithSessionKey(message, sessionKey);
   ```

3. **Verify Keys**:
   ```javascript
   // Show fingerprint to user
   const fingerprint = hash(publicKey).slice(0, 16);
   Alert.alert('Verify', `Bob's key: ${fingerprint}`);
   ```

4. **Secure Key Storage**:
   ```javascript
   // Use device keychain (iOS) or keystore (Android)
   import Keychain from 'react-native-keychain';
   await Keychain.setGenericPassword('keys', JSON.stringify(keyPair));
   ```

---

### 11.7 Scalability Analysis

**Current Architecture Limits**:

```
┌─────────────────────────────────────────────────────────┐
│ METRIC            │ LIMIT           │ BOTTLENECK        │
├───────────────────┼─────────────────┼──────────────────┤
│ Peers per room    │ ~10-20          │ O(N) broadcast   │
│ Messages/second   │ ~10-50          │ Encryption cost  │
│ Message size      │ ~64 KB          │ Network MTU      │
│ Rooms per server  │ ~100-1000       │ Memory           │
│ Storage           │ In-memory       │ Server RAM       │
└─────────────────────────────────────────────────────────┘
```

**Scaling Strategies**:

1. **For More Peers**:
   ```
   Current: Full mesh (everyone connects to everyone)
   Problem: N² connections with N peers
   
   Solution: Star topology
   ┌──────────┐
   │   Root   │ ← Central relay
   └─────┬────┘
     ┌───┼────┬─────┐
     │   │    │     │
   Peer1 Peer2 Peer3 Peer4
   
   Trade-off: Root peer sees all messages
   Benefit: O(N) instead of O(N²)
   ```

2. **For More Messages**:
   ```
   Current: Encrypt separately for each peer
   Problem: O(N) encryptions per message
   
   Solution: Group encryption
   • Shared room key for symmetric encryption
   • Key rotation for forward secrecy
   • Still E2EE (root peer encrypted too)
   ```

3. **For Persistence**:
   ```
   Current: In-memory Map
   Problem: Lost on server restart
   
   Solution: Database storage
   • PostgreSQL for messages
   • Redis for active sessions
   • S3 for media/attachments
   ```

4. **For Reliability**:
   ```
   Current: Single root peer
   Problem: Single point of failure
   
   Solution: Multi-peer backend
   • Multiple root peers
   • Consensus protocol (Raft)
   • Automatic failover
   ```

---

## Conclusion

This P2P Encrypted Chat application demonstrates:

**Core Technologies**:
- ✅ React Native for cross-platform mobile
- ✅ Hyperswarm for P2P networking
- ✅ libsodium for encryption
- ✅ Event-driven architecture
- ✅ Optimistic UI patterns

**Key Features**:
- ✅ End-to-end encrypted P2P messaging
- ✅ Decentralized peer discovery
- ✅ Offline message delivery
- ✅ Persistent local storage
- ✅ Real-time multi-peer chat

**Production Readiness**:
- ⚠️  Security gaps identified (see section 11.6)
- ⚠️  Scalability limits (see section 11.7)
- ⚠️  Root peer storage not persistent
- ✅  Code is well-structured and maintainable
- ✅  Clear upgrade path defined

**Next Steps**:
1. Implement forward secrecy
2. Add key verification
3. Encrypt root peer storage
4. Add database persistence
5. Implement group key management
6. Add media/file sharing
7. Implement read receipts
8. Add push notifications

This walkthrough covered every major component and data flow. You should now understand:
- How each module works internally
- How modules interact with each other
- How messages flow through the system
- What security trade-offs were made
- How to extend and improve the system

**Total Documentation**: ~25,000 words covering the complete codebase!

---

**End of Code Walkthrough** 🎉

