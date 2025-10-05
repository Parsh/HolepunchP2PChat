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

- **Node.js 18+** (recommended: Node.js 22.x via nvm)
- **Yarn 3.6.4** (or npm as alternative)
- **React Native development environment**
  - **iOS**: Xcode, CocoaPods
  - **Android**: Android Studio, Android SDK
- **iOS Simulator or Android Emulator**

### Environment Setup

1. **Install nvm (Node Version Manager)**:
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Add to ~/.zshrc
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Reload shell configuration
source ~/.zshrc

# Install Node.js
nvm install 22
nvm use 22
```

2. **Create system-wide node symlink** (for Xcode):
```bash
sudo ln -sf "$(which node)" /usr/local/bin/node
```

3. **Install Yarn** (if not already installed):
```bash
npm install -g yarn
```

4. **Install CocoaPods** (for iOS):
```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install CocoaPods
brew install cocoapods
```

### Installation

1. **Install frontend dependencies**:
```bash
yarn install
```

2. **Install iOS pods**:
```bash
cd ios
pod install
cd ..
```

3. **Verify versions**:
```bash
yarn verify-versions
```

### Backend Setup

1. **Install backend dependencies**:
```bash
cd backend
yarn install
cd ..
```

2. **Start the root peer backend**:
```bash
cd backend
source ~/.nvm/nvm.sh && node server.js &
cd ..
```

### Running the App

1. **Start Metro bundler**:
```bash
yarn start
```

2. **Run on iOS** (in a new terminal):
```bash
yarn ios
```

3. **Run on Android** (in a new terminal):
```bash
yarn android
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
- React Navigation (Stack Navigator)
- Hyperswarm 4.14.0+ (P2P networking)
- libsodium-wrappers 0.7.15 (encryption)
- AsyncStorage (persistence)
- react-native-gesture-handler (navigation gestures)
- b4a (Buffer implementation optimized for React Native)
- Node.js polyfills (buffer, process, events, stream, util)

### Backend
- Node.js 18+
- Hyperswarm
- Hypercore (message storage)
- Corestore (data management)

### React Native Adaptations
- Custom Metro resolver for sodium-native compatibility
- Polyfills for Node.js built-in modules
- libsodium-wrappers shim for native module compatibility

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

### Metro Bundler

The project uses a custom Metro configuration to handle React Native-incompatible Node.js modules:

- **Custom resolver**: Intercepts `sodium-native` and `sodium-universal` requires
- **Polyfills**: Provides Node.js built-in modules (buffer, process, events, stream, util)
- **Shim layer**: Maps native modules to React Native-compatible alternatives

If you encounter module resolution issues, try:
```bash
# Clear Metro cache
yarn start --reset-cache

# Clean Xcode build
cd ios
xcodebuild clean
cd ..
```

### Testing P2P Connectivity

1. Start the root peer backend
2. Launch two app instances (simulator + physical device, or two simulators)
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
