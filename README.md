# P2P Encrypted Chat - React Native PoC

A proof-of-concept peer-to-peer encrypted chat application built with React Native 0.74.1 and Hyperswarm.

## 🎯 Features

- ✅ **End-to-end encrypted messaging** using AES-256 (crypto-js)
- ✅ **Peer-to-peer connectivity** via Hyperswarm
- ✅ **Offline message delivery** through root peer storage
- ✅ **Room-based chat** with secure key sharing
- ✅ **Incremental message sync** with persistent peer identity
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

- **Node.js 18+** (tested with Node.js 22.x)
- **Yarn** (or npm)
- **Xcode** (for iOS development) - macOS only
- **CocoaPods** (for iOS dependencies) - Install via `brew install cocoapods`
- **React Native CLI** - Install via `npm install -g react-native-cli`

### Setup & Installation

1. **Clone the repository and install dependencies**:
```bash
git clone <repository-url>
cd HolepunchP2PChat
yarn install
```

2. **Build the Bare.js worklet bundle**:
```bash
yarn bundle:worklet
```
> **Note:** The worklet bundle (`app.bundle.mjs`) is not included in the repository and must be generated before running the app. 

3. **Install iOS dependencies** (macOS only):
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
> **Note:** The backend uses npm (not yarn) as it's a separate Node.js project with its own `package-lock.json`.

### Running the App

**Step 1: Start the root peer backend** (in Terminal 1):
```bash
cd backend
npm run start
```

**Step 2: Start React Native** (in Terminal 2):
```bash
# For iOS
npx react-native run-ios

# Or specify a simulator
npx react-native run-ios --simulator="iPhone 17 Pro"

# For Android
npx react-native run-android
```

> **Note:** The Metro bundler will start automatically. If you need to reset the cache, use `npx react-native start --reset-cache`

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
│   ├── WelcomeScreen.tsx
│   ├── CreateRoomScreen.tsx
│   ├── JoinRoomScreen.tsx
│   └── ChatScreen.tsx
├── backend/             # Root peer server
│   ├── server.ts
│   ├── ChatRootPeer.ts
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
- crypto-js 4.2.0 (AES-256 encryption)
- AsyncStorage (persistence)
- react-native-gesture-handler (navigation gestures)
- react-native-bare-kit 0.5.6+ (Bare.js worklet support)
- b4a (Buffer implementation optimized for React Native)
- Node.js polyfills (buffer, process, events, stream, util)

### Backend
- Node.js 18+
- Hyperswarm
- Hypercore (message storage)
- Corestore (data management)

### React Native Adaptations
- Bare.js worklet for native Hyperswarm support (react-native-bare-kit)
- Node.js polyfills for Hyperswarm compatibility (buffer, process, events, stream, util)
- Custom Metro configuration for TypeScript and module resolution

## 📝 Key Dependencies

- React: `18.2.0`
- React Native: `0.74.1`
- TypeScript: `5.0.4`
- Hyperswarm: `4.14.0+`
- Node.js: `18+` (for backend)
- react-native-bare-kit: `0.5.6+` (for Bare.js worklet support)

## 📚 Documentation

- **[Architecture Guide](./design_docs/ARCHITECTURE.md)** - Complete system architecture, component interactions, and message flow
- **[Deployment Guide](./design_docs/DEPLOYMENT.md)** - Production deployment for mobile apps and backend (no URL config needed!)
- **[Encryption Architecture](./design_docs/ENCRYPTION_ARCHITECTURE.md)** - End-to-end encryption design and security model
- **[Backend Documentation](./backend/README.md)** - Root peer server setup and API
- **[Technical Research](./design_docs/hyperDHTReactNative/)** - Hyperswarm integration research and notes

## 🧪 Testing

Run unit tests:
```bash
npm test
```

## 🔒 Security

- End-to-end encryption using crypto-js AES-256
- 32-byte room keys (shared secret) for room identification
- SHA-256 key derivation for public room topic discovery
- Messages encrypted in React Native before transmission
- Root peer stores encrypted messages (cannot decrypt without room key)
- Incremental sync with persistent peer identity

## 🛠️ Development

### Debug Mode

Enable verbose logging by checking the console logs in the app.

### Metro Bundler

The project uses a custom Metro configuration for React Native compatibility:

- **Node.js Polyfills**: Provides built-in modules (buffer, process, events, stream, util) required by Hyperswarm
- **TypeScript Support**: Prioritizes `.ts`/`.tsx` files over `.js`/`.jsx`

If you encounter module resolution issues, try:
```bash
# Clear Metro cache
yarn start --reset-cache

# Clean Xcode build
cd ios
xcodebuild clean
cd ..
```

### Worklet Bundle

The Bare.js worklet must be bundled before running the app:

```bash
# Bundle the worklet
yarn bundle:worklet
```

This generates `src/network/worklet/app.bundle.mjs` which is:
- **Not committed** to the repository (in `.gitignore`)
- **Required** for the app to run
- **Auto-generated** when running `yarn ios` or `yarn android` (via prebuild hook)

If you get errors about missing worklet bundle:
```bash
# Manually regenerate
yarn bundle:worklet

# Or clean and rebuild
rm -rf node_modules
yarn install
yarn bundle:worklet
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
