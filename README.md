# P2P Encrypted Chat - React Native PoC

A proof-of-concept peer-to-peer encrypted chat application built with React Native 0.74.1 and Hyperswarm.

## 🎯 Features

- ✅ **End-to-end encrypted messaging** using libsodium
- ✅ **Peer-to-peer connectivity** via Hyperswarm
- ✅ **Offline message delivery** through root peer storage
- ✅ **Room-based chat** with secure key sharing
- ✅ **Local message persistence** using AsyncStorage
- ✅ **Cross-platform** support (iOS & Android)

## 📋 Architecture

### Frontend (React Native)
- **Crypto Layer**: Room key generation, P2P encryption/decryption
- **Network Layer**: Hyperswarm P2P networking
- **Storage Layer**: Local message persistence
- **Chat Client**: Orchestration and event handling
- **UI Layer**: React Native screens and navigation

### Backend (Node.js)
- **Root Peer Server**: Message storage and peer discovery
- **Hypercore Storage**: Append-only message logs per room
- **State Persistence**: Room registry and message counts

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- React Native development environment
- iOS Simulator or Android Emulator

### Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Verify versions**:
```bash
npm run verify-versions
```

3. **Start Metro bundler**:
```bash
npm start
```

4. **Run on iOS**:
```bash
npm run ios
```

5. **Run on Android**:
```bash
npm run android
```

### Backend Setup

```bash
cd backend
npm install
npm start
```

## 📖 Usage

### Creating a Room

1. Launch the app
2. Tap "Create New Room"
3. Enter a username
4. Share the generated room key with others

### Joining a Room

1. Launch the app
2. Tap "Join Existing Room"
3. Enter a username and the room key
4. Start chatting!

### Features in Chat

- Real-time message delivery
- Connection status indicators
- Peer count display
- Root peer sync status
- Message history loading
- Offline message persistence

## 🏗️ Project Structure

```
.
├── src/
│   ├── crypto/          # Encryption and key management
│   ├── rooms/           # Room creation and joining
│   ├── network/         # P2P networking layer
│   ├── storage/         # Local message persistence
│   └── chat/            # Chat client orchestration
├── screens/             # React Native UI screens
│   ├── WelcomeScreen.js
│   ├── CreateRoomScreen.js
│   ├── JoinRoomScreen.js
│   └── ChatScreen.js
├── backend/             # Root peer server
│   ├── server.js
│   ├── ChatRootPeer.js
│   └── package.json
├── App.tsx              # Main app navigation
└── package.json         # Dependencies
```

## 🔧 Technologies

### Frontend
- React Native 0.74.1
- React 18.2.0
- React Navigation
- Hyperswarm (P2P networking)
- libsodium-wrappers (encryption)
- AsyncStorage (persistence)
- b4a (Buffer implementation optimized for React Native)

### Backend
- Node.js 18+
- Hyperswarm
- Hypercore (message storage)
- Corestore (data management)

## 📝 Version Requirements

**Critical**: These exact versions are required for compatibility:

- React: `18.2.0` (exact)
- React Native: `0.74.1` (exact)
- TypeScript: `5.0.4` (recommended)
- Node.js: `18+` (for backend)

## 🧪 Testing

Run unit tests:
```bash
npm test
```

## 📚 Documentation

### Getting Started
- [Quick Start Guide](./QUICK_START.md) - Fast setup checklist
- [Development Guide](./DEVELOPMENT.md) - Complete development guide
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment instructions

### Reference
- [Project Summary](./PROJECT_SUMMARY.md) - Executive overview and architecture
- [Implementation Progress](./IMPLEMENTATION_PROGRESS.md) - Stage-by-stage progress
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions
- [Migration to b4a](./MIGRATION_TO_B4A.md) - Buffer implementation upgrade

### Technical
- [Backend Documentation](./backend/README.md) - Root peer server guide
- [Specifications](./design/specs/) - Full technical specifications

## 🔒 Security

- End-to-end encryption using libsodium's `crypto_box`
- 32-byte room keys for room identification
- Per-user keypairs for P2P messaging
- Messages encrypted before transmission
- Root peer stores unencrypted messages for offline delivery

## 🛠️ Development

### Debug Mode

Enable verbose logging by checking the console logs in the app.

### Testing P2P Connectivity

1. Start the root peer backend
2. Launch two app instances
3. Create a room in instance 1
4. Join with the room key in instance 2
5. Send messages and verify delivery

## 📦 Building for Production

### iOS

```bash
cd ios
pod install
cd ..
npx react-native run-ios --configuration Release
```

### Android

```bash
npx react-native run-android --variant=release
```

## 🤝 Contributing

This is a proof-of-concept implementation. The modular architecture is designed for easy component extraction and integration into other projects.

## 📄 License

MIT

## 🔗 Related

- [Holepunch Documentation](https://docs.holepunch.to/)
- [Hyperswarm Documentation](https://github.com/holepunchto/hyperswarm)
- [React Native Documentation](https://reactnative.dev/)

---

**Built with ❤️ for P2P encrypted communication**
