# Development Guide - P2P Encrypted Chat

## Table of Contents
1. [Development Environment Setup](#development-environment-setup)
2. [Project Structure](#project-structure)
3. [Architecture Overview](#architecture-overview)
4. [Development Workflow](#development-workflow)
5. [Debugging](#debugging)
6. [Testing](#testing)
7. [Contributing](#contributing)

---

## Development Environment Setup

### Prerequisites

- **Node.js**: 18+ (required for Hyperswarm compatibility)
- **npm** or **yarn**: Latest version
- **React Native CLI**: For running the app
- **Xcode** (macOS): For iOS development
- **Android Studio**: For Android development
- **Git**: For version control

### Initial Setup

1. **Clone the repository**:
```bash
git clone <repository-url>
cd HolepunchP2PChat
```

2. **Install frontend dependencies**:
```bash
npm install
```

3. **Install iOS pods** (macOS only):
```bash
cd ios
pod install
cd ..
```

4. **Install backend dependencies**:
```bash
cd backend
npm install
cd ..
```

5. **Verify versions**:
```bash
npm run verify-versions
```

### Version Requirements

**Critical**: These exact versions must be maintained:

- **React**: `18.2.0` (exact)
- **React Native**: `0.74.1` (exact)
- **TypeScript**: `5.0.4` (recommended)
- **Node.js**: `18+` (for backend)

---

## Project Structure

```
.
├── App.tsx                 # Main app with navigation
├── index.js                # App entry point
├── package.json            # Frontend dependencies
│
├── src/                    # Core modules (lift-and-shift ready)
│   ├── crypto/             # Encryption & key management
│   │   └── CryptoManager.js
│   ├── rooms/              # Room creation & joining
│   │   └── RoomManager.js
│   ├── network/            # P2P networking (Hyperswarm)
│   │   └── NetworkManager.js
│   ├── storage/            # Local message persistence
│   │   └── StorageManager.js
│   └── chat/               # Chat orchestration
│       └── ChatClient.js
│
├── screens/                # React Native UI
│   ├── WelcomeScreen.js
│   ├── CreateRoomScreen.js
│   ├── JoinRoomScreen.js
│   └── ChatScreen.js
│
├── backend/                # Root peer server
│   ├── server.js
│   ├── ChatRootPeer.js
│   └── package.json
│
├── design/                 # Specifications
│   └── specs/
│
├── __tests__/              # Test files
│   └── App.test.tsx
│
├── android/                # Android native code
├── ios/                    # iOS native code
│
└── docs/                   # Documentation
    ├── DEVELOPMENT.md      # This file
    ├── DEPLOYMENT.md
    └── TROUBLESHOOTING.md
```

---

## Architecture Overview

### Modular Design

The codebase is designed with **lift-and-shift** capability in mind. Each module is:
- **Independent**: Minimal cross-dependencies
- **Event-driven**: Uses EventEmitter for loose coupling
- **Reusable**: Can be extracted for other projects
- **Well-documented**: Clear interfaces and comments

### Layer Architecture

```
┌─────────────────────────────────────┐
│         UI Layer (Screens)          │
│   WelcomeScreen, CreateRoomScreen   │
│   JoinRoomScreen, ChatScreen        │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│      Orchestration (ChatClient)     │
│   Coordinates all core modules      │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│         Core Modules                │
├──────────────┬──────────────────────┤
│ CryptoManager│ NetworkManager       │
│ RoomManager  │ StorageManager       │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│      External Dependencies          │
│  Hyperswarm, libsodium, AsyncStorage│
└─────────────────────────────────────┘
```

### Key Components

#### 1. CryptoManager
- **Purpose**: All cryptographic operations
- **Key Methods**:
  - `generateNewRoomKey()`: Create 32-byte room keys
  - `deriveRoomId()`: Deterministic room ID
  - `generateKeyPair()`: P2P encryption keys
  - `encryptMessage()` / `decryptMessage()`: E2E encryption
  - `loadOrGenerateKeys()`: Persistent user keys

#### 2. RoomManager
- **Purpose**: Room lifecycle management
- **Key Methods**:
  - `createRoom(username)`: Generate new room
  - `joinRoom(roomKey, username)`: Join existing room
  - `getCurrentRoom()`: Get current room state

#### 3. NetworkManager
- **Purpose**: P2P networking via Hyperswarm
- **Key Methods**:
  - `start()`: Initialize P2P networking
  - `joinRoomSwarm()`: Join room-specific swarm
  - `joinDiscoverySwarm()`: Connect to root peer
  - `broadcastMessage()`: Send to all peers
  - `syncWithRootPeer()`: Request message history

#### 4. StorageManager
- **Purpose**: Local message persistence
- **Key Methods**:
  - `init(roomId)`: Initialize storage for room
  - `storeMessage()`: Save message locally
  - `getMessages()`: Retrieve message history
  - `getRoomInfo()` / `setRoomInfo()`: Room metadata

#### 5. ChatClient
- **Purpose**: Orchestrates all operations
- **Key Methods**:
  - `createRoom(username)`: Full room creation workflow
  - `joinRoom(roomKey, username)`: Full joining workflow
  - `sendMessage(text)`: Message sending with storage
  - `disconnect()`: Clean shutdown

---

## Development Workflow

### Running the App

1. **Start Metro bundler**:
```bash
npm start
```

2. **In a new terminal, run iOS**:
```bash
npm run ios
```

3. **Or run Android**:
```bash
npm run android
```

### Running the Backend

```bash
cd backend
npm start
```

The backend will:
- Start listening on P2P connections
- Join discovery swarm
- Restore existing rooms
- Display stats every 30 seconds

### Hot Reload

React Native supports hot reloading:
- **iOS**: Press `Cmd + R` in simulator
- **Android**: Press `R` twice in emulator
- **Both**: Shake device to open dev menu

### Making Changes

1. **Frontend code changes**: Edit files in `src/` or `screens/`
   - Changes auto-reload with Fast Refresh
   - For structural changes, restart Metro

2. **Backend code changes**: Edit files in `backend/`
   - Restart the backend server manually
   - Use `nodemon` for auto-restart (optional)

3. **Native code changes**: Requires full rebuild
   - iOS: `npm run ios`
   - Android: `npm run android`

---

## Debugging

### React Native Debugger

1. **Enable Debug Mode**:
   - iOS: `Cmd + D` → "Debug"
   - Android: `Cmd + M` → "Debug"

2. **Chrome DevTools**:
   - Opens automatically when debug enabled
   - Use Console, Network, and React DevTools

3. **React Native Debugger (Recommended)**:
```bash
brew install --cask react-native-debugger
```

### Console Logging

The app uses extensive console logging:

```javascript
console.log('🏗️  Created room:', roomId);     // Success
console.log('📡 Joining room swarm...');      // Info
console.error('❌ Failed to create room');    // Error
```

**Filtering logs**:
```bash
# iOS
npx react-native log-ios | grep "🔑"

# Android
npx react-native log-android | grep "🔑"
```

### Network Debugging

**Hyperswarm connections**:
```javascript
// In NetworkManager.js
this.swarm.on('connection', (conn, info) => {
  console.log('🤝 Peer connected:', info.publicKey.toString('hex'));
});
```

**Backend monitoring**:
```bash
cd backend
npm start
# Watch for connection logs
```

### Common Issues

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

---

## Testing

### Unit Tests

Run Jest tests:
```bash
npm test
```

Run with coverage:
```bash
npm test -- --coverage
```

### Integration Tests

Test full workflow:
1. Start backend server
2. Launch app instance 1
3. Create room in instance 1
4. Launch app instance 2
5. Join room in instance 2
6. Send messages both ways

### E2E Tests

See `__tests__/` directory for test files.

---

## Contributing

### Code Style

- **ESLint**: Configured in `.eslintrc.js`
- **Prettier**: Configured in `.prettierrc.js`

Run linter:
```bash
npm run lint
```

### Commit Messages

Use conventional commits:
```
feat: Add message encryption
fix: Resolve peer connection issue
docs: Update README
refactor: Improve CryptoManager
test: Add unit tests for RoomManager
```

### Pull Request Process

1. Create feature branch from `main`
2. Make changes with tests
3. Run `npm run lint` and `npm test`
4. Submit PR with description
5. Wait for review and CI checks

---

## Additional Resources

- [React Native Documentation](https://reactnative.dev/)
- [Hyperswarm Documentation](https://github.com/holepunchto/hyperswarm)
- [Holepunch Documentation](https://docs.holepunch.to/)
- [libsodium Documentation](https://libsodium.gitbook.io/)

---

**Happy coding! 🚀**
