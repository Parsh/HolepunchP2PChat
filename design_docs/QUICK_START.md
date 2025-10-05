# Quick Start Checklist - P2P Encrypted Chat

Use this checklist to quickly set up and run the P2P Encrypted Chat PoC.

---

## ⚡ Prerequisites

- [ ] **Node.js 18+** installed
  ```bash
  node --version  # Should show v18.x.x or higher
  ```

- [ ] **npm or yarn** installed
  ```bash
  npm --version
  ```

- [ ] **React Native development environment** set up
  - iOS: Xcode installed (macOS only)
  - Android: Android Studio installed

- [ ] **Git** installed
  ```bash
  git --version
  ```

---

## 📱 Frontend Setup

### 1. Install Dependencies

```bash
cd /path/to/HolepunchP2PChat
npm install
```

**Expected output**: All dependencies installed successfully

### 2. Verify Versions

```bash
npm run verify-versions
```

**Expected output**:
```
✅ React version: 18.2.0
✅ React Native version: 0.74.1
```

### 3. iOS Setup (macOS only)

```bash
cd ios
pod install
cd ..
```

**Expected output**: Pods installed successfully

### 4. Start Metro Bundler

```bash
npm start
```

**Expected output**: Metro bundler running on port 8081

### 5. Run on Device/Simulator

**iOS**:
```bash
npm run ios
```

**Android**:
```bash
npm run android
```

**Expected output**: App launches successfully

---

## 🖥️ Backend Setup

### 1. Navigate to Backend Directory

```bash
cd backend
```

### 2. Install Dependencies

```bash
npm install
```

**Expected output**: Backend dependencies installed

### 3. Start Backend Server

```bash
npm start
```

**Expected output**:
```
🏰 Starting Chat Root Peer...
📁 Storage directory: ./root-peer-storage
🔍 Joining root peer discovery swarm...
🚀 Root peer is ready and waiting for connections!
```

---

## ✅ Verification Steps

### Frontend

- [ ] App launches without errors
- [ ] Welcome screen displays with two buttons
- [ ] "Create New Room" button is clickable
- [ ] "Join Existing Room" button is clickable
- [ ] No red error screens

### Backend

- [ ] Server starts without errors
- [ ] Discovery swarm joined successfully
- [ ] Storage directory created
- [ ] Stats display every 30 seconds

---

## 🧪 Testing the Complete Flow

### Test 1: Create and Join Room

1. **Device/Simulator 1**:
   - [ ] Tap "Create New Room"
   - [ ] Enter username (e.g., "Alice")
   - [ ] Room key appears (64 characters)
   - [ ] Copy room key
   - [ ] Navigate to chat screen

2. **Device/Simulator 2**:
   - [ ] Tap "Join Existing Room"
   - [ ] Enter username (e.g., "Bob")
   - [ ] Paste room key
   - [ ] Tap "Join Room"
   - [ ] Navigate to chat screen

### Test 2: Send Messages

- [ ] Device 1: Type and send message
- [ ] Device 2: Receives message
- [ ] Device 2: Type and send message
- [ ] Device 1: Receives message

### Test 3: Peer Connection

- [ ] Both devices show "Connected peers: 1"
- [ ] Connection indicator shows green/active
- [ ] Messages deliver in real-time

### Test 4: Root Peer Connection

- [ ] Backend logs show "New peer connected"
- [ ] Backend logs show "Message stored"
- [ ] Stats show room count and message count

### Test 5: Offline Sync

1. **Disconnect Device 1**:
   - [ ] Close app or disable network

2. **Send message from Device 2**:
   - [ ] Message sent successfully
   - [ ] Backend stores message

3. **Reconnect Device 1**:
   - [ ] App reconnects to root peer
   - [ ] Syncs missed messages
   - [ ] Displays all messages

---

## 🐛 Common Issues Quick Fixes

### Issue: "Buffer is not defined"

```bash
# Verify b4a is installed
npm list b4a

# If not, install it
npm install b4a@^1.6.4

# Restart Metro
npm start -- --reset-cache
```

### Issue: Metro bundler won't start

```bash
# Kill Metro process
pkill -f "cli.js start"

# Clear cache and restart
npm start -- --reset-cache
```

### Issue: iOS build fails

```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
npm run ios
```

### Issue: Android build fails

```bash
cd android
./gradlew clean
cd ..
npm run android
```

### Issue: Peers not connecting

- [ ] Verify backend is running
- [ ] Check both devices are on same network (or cellular)
- [ ] Try on physical devices (not simulators)
- [ ] Check Metro logs for errors
- [ ] Check backend logs for peer connections

### Issue: Backend crashes on start

```bash
# Check Node version
node --version  # Should be 18+

# Reinstall dependencies
cd backend
rm -rf node_modules package-lock.json
npm install
npm start
```

---

## 📚 Next Steps

Once everything is working:

1. **Read Documentation**:
   - [ ] [README.md](./README.md) - Project overview
   - [ ] [DEVELOPMENT.md](./DEVELOPMENT.md) - Development guide
   - [ ] [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide

2. **Explore Code**:
   - [ ] `src/crypto/CryptoManager.js` - Encryption
   - [ ] `src/network/NetworkManager.js` - P2P networking
   - [ ] `src/chat/ChatClient.js` - Orchestration
   - [ ] `backend/ChatRootPeer.js` - Backend logic

3. **Test More Scenarios**:
   - [ ] Multiple rooms
   - [ ] Multiple peers in one room
   - [ ] Disconnect and reconnect
   - [ ] Background app → foreground
   - [ ] Message history persistence

4. **Review Specs**:
   - [ ] `design/specs/REACT_NATIVE_SPECIFICATION_PART_1.md`
   - [ ] `design/specs/REACT_NATIVE_SPECIFICATION_PART_2.md`
   - [ ] `design/specs/REACT_NATIVE_SPECIFICATION_PART_3.md`

---

## 🎯 Success Criteria

You've successfully set up the project if:

✅ Frontend app launches without errors
✅ Backend server starts successfully  
✅ You can create a room
✅ You can join a room with the room key
✅ Messages send and receive in real-time
✅ Peer count shows connected peers
✅ Backend logs show connections and stored messages
✅ Offline sync works (messages delivered after reconnect)

---

## 🆘 Need Help?

If stuck:

1. **Check logs**:
   - Metro bundler console
   - Device/simulator console
   - Backend terminal

2. **Review documentation**:
   - [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
   - [DEVELOPMENT.md](./DEVELOPMENT.md)

3. **Verify setup**:
   - Node.js version ≥ 18
   - React 18.2.0 exact
   - React Native 0.74.1 exact
   - All dependencies installed

4. **Clean and restart**:
   ```bash
   # Frontend
   npm start -- --reset-cache
   
   # Backend
   cd backend
   npm start
   ```

---

**Ready to start? Let's go! 🚀**
