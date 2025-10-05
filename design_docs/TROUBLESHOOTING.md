# Troubleshooting Guide - P2P Encrypted Chat

## Table of Contents
1. [Installation Issues](#installation-issues)
2. [Build Errors](#build-errors)
3. [Runtime Errors](#runtime-errors)
4. [Network Issues](#network-issues)
5. [Backend Issues](#backend-issues)
6. [Platform-Specific Issues](#platform-specific-issues)

---

## Installation Issues

### Problem: `npm install` fails

**Symptoms:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solutions:**

1. **Clear npm cache**:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

2. **Use legacy peer deps**:
```bash
npm install --legacy-peer-deps
```

3. **Check Node version**:
```bash
node --version  # Should be 18+
```

---

### Problem: iOS Pods installation fails

**Symptoms:**
```
[!] CocoaPods could not find compatible versions for pod "..."
```

**Solutions:**

1. **Update CocoaPods**:
```bash
sudo gem install cocoapods
```

2. **Clean and reinstall**:
```bash
cd ios
rm -rf Pods Podfile.lock
pod install --repo-update
cd ..
```

3. **Update pod repo**:
```bash
cd ios
pod repo update
pod install
cd ..
```

---

## Build Errors

### Problem: Metro bundler fails to start

**Symptoms:**
```
Error: ENOSPC: System limit for number of file watchers reached
```

**Solutions:**

1. **Increase watchers (Linux)**:
```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

2. **Clear Metro cache**:
```bash
npm start -- --reset-cache
```

3. **Clean Watchman**:
```bash
watchman watch-del-all
```

---

### Problem: "Buffer is not defined" error

**Symptoms:**
```
ReferenceError: Buffer is not defined
```

**Solutions:**

1. **Verify b4a is installed**:
```bash
npm list b4a
```

2. **Check imports in files**:
```javascript
// Should be at top of file
import b4a from 'b4a';

// Not this:
// const Buffer = require('buffer').Buffer;
```

3. **Reinstall b4a**:
```bash
npm uninstall b4a
npm install b4a@^1.6.4
```

---

### Problem: TypeScript errors

**Symptoms:**
```
error TS2307: Cannot find module '...' or its corresponding type declarations
```

**Solutions:**

1. **Install type definitions**:
```bash
npm install --save-dev @types/node
```

2. **Check tsconfig.json**:
```json
{
  "compilerOptions": {
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true
  }
}
```

3. **Restart TypeScript server** (in VS Code):
   - Cmd/Ctrl + Shift + P
   - "TypeScript: Restart TS Server"

---

## Runtime Errors

### Problem: App crashes on launch

**Symptoms:**
- White screen
- Immediate crash
- No error message

**Solutions:**

1. **Check Metro logs**:
```bash
npm start
# Look for red error messages
```

2. **Rebuild app**:
```bash
# iOS
npm run ios

# Android
npm run android
```

3. **Clear all caches**:
```bash
npm start -- --reset-cache
cd android && ./gradlew clean && cd ..
cd ios && rm -rf Pods && pod install && cd ..
```

4. **Check for syntax errors** in recently modified files

---

### Problem: libsodium initialization fails

**Symptoms:**
```
Error: libsodium is not ready
```

**Solutions:**

1. **Add await to sodium.ready**:
```javascript
async function initCrypto() {
  await sodium.ready;
  // Now safe to use sodium
}
```

2. **Check import**:
```javascript
import sodium from 'libsodium-wrappers';
// Not: import * as sodium from 'libsodium-wrappers';
```

---

### Problem: AsyncStorage errors

**Symptoms:**
```
Error: AsyncStorage is null
```

**Solutions:**

1. **Verify installation**:
```bash
npm list @react-native-async-storage/async-storage
```

2. **Reinstall**:
```bash
npm uninstall @react-native-async-storage/async-storage
npm install @react-native-async-storage/async-storage
```

3. **iOS: Reinstall pods**:
```bash
cd ios && pod install && cd ..
```

4. **Android: Clean and rebuild**:
```bash
cd android && ./gradlew clean && cd ..
npm run android
```

---

## Network Issues

### Problem: Peers not connecting

**Symptoms:**
- Peer count stays at 0
- Messages not delivered
- No "Peer connected" logs

**Solutions:**

1. **Check Hyperswarm initialization**:
```javascript
// In NetworkManager.js
console.log('Swarm started:', this.swarm);
```

2. **Verify room key**:
```javascript
console.log('Room key:', roomKey.toString('hex'));
// Should be 64 characters
```

3. **Check network permissions** (Android):
```xml
<!-- In AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

4. **Test on real devices** (not simulators):
   - Hyperswarm works best on real networks
   - Simulators may have NAT issues

5. **Check firewall**:
   - Ensure ports 49737-65535 are open
   - Try on cellular data vs WiFi

---

### Problem: Root peer not connecting

**Symptoms:**
- "Root peer connected" never appears
- Sync doesn't work
- No offline message delivery

**Solutions:**

1. **Verify backend is running**:
```bash
cd backend
npm start
# Should see "Root peer is ready and waiting for connections!"
```

2. **Check discovery topic**:
```javascript
// Should match in both frontend and backend
const discoveryTopic = crypto.hash(
  b4a.from('holepunch-root-peer-discovery')
);
```

3. **Test backend connectivity**:
```bash
cd backend
npm start
# Watch for "New peer connected" logs
```

4. **Check backend logs**:
```bash
cd backend
npm start 2>&1 | tee backend.log
```

---

### Problem: Messages not encrypting

**Symptoms:**
- Messages appear in plaintext
- Encryption errors in console

**Solutions:**

1. **Verify key exchange**:
```javascript
console.log('My public key:', this.crypto.getPublicKeyHex());
console.log('Peer public key:', peerData.publicKey);
```

2. **Check libsodium initialization**:
```javascript
await sodium.ready;
console.log('Sodium ready:', sodium);
```

3. **Verify encryption call**:
```javascript
const encrypted = await this.crypto.encryptMessage(message, recipientPublicKey);
console.log('Encrypted:', encrypted);
```

---

## Backend Issues

### Problem: Backend crashes on startup

**Symptoms:**
```
Error: Cannot find module '...'
EADDRINUSE: Port already in use
```

**Solutions:**

1. **Install dependencies**:
```bash
cd backend
npm install
```

2. **Check for port conflicts**:
```bash
lsof -i :3000  # Change port if in use
```

3. **Check Node version**:
```bash
node --version  # Should be 18+
```

---

### Problem: Messages not persisting

**Symptoms:**
- Room disappears after restart
- Message history lost
- No state file created

**Solutions:**

1. **Check storage directory**:
```bash
ls -la ./root-peer-storage/
# Should see root-peer-state.json and Hypercore files
```

2. **Verify write permissions**:
```bash
chmod -R 755 ./root-peer-storage/
```

3. **Check logs for errors**:
```bash
cd backend
npm start 2>&1 | grep "ERROR\|Failed"
```

---

### Problem: Backend high memory usage

**Symptoms:**
- Memory usage increases over time
- Server becomes slow
- Out of memory errors

**Solutions:**

1. **Monitor memory**:
```bash
ps aux | grep node
```

2. **Restart periodically** (with systemd):
```ini
[Service]
RuntimeMaxSec=86400  # Restart every 24 hours
```

3. **Implement message cleanup**:
```javascript
// Add to ChatRootPeer.js
async cleanOldMessages(daysToKeep = 30) {
  const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  // Implementation to remove old messages
}
```

---

## Platform-Specific Issues

### iOS Issues

#### Problem: Build fails with signing error

**Solutions:**

1. **Select correct team** in Xcode:
   - Open `ios/P2PChatTemp.xcworkspace`
   - Select project → Signing & Capabilities
   - Choose your team

2. **Update Bundle ID**:
   - Make it unique: `com.yourcompany.p2pchat`

3. **Check provisioning profile**:
   - Ensure it matches Bundle ID and team

---

#### Problem: App crashes on physical device

**Solutions:**

1. **Check console logs** in Xcode:
   - Window → Devices and Simulators
   - Select device → View Device Logs

2. **Enable debugging**:
   - Shake device → Enable Remote JS Debugging

3. **Check for missing permissions**:
```xml
<!-- In Info.plist -->
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

---

### Android Issues

#### Problem: Build fails with Gradle error

**Solutions:**

1. **Clean Gradle**:
```bash
cd android
./gradlew clean
cd ..
```

2. **Update Gradle version** in `android/gradle/wrapper/gradle-wrapper.properties`:
```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.0.1-all.zip
```

3. **Check Java version**:
```bash
java -version  # Should be JDK 11 or 17
```

---

#### Problem: App crashes on Android

**Solutions:**

1. **Check Logcat**:
```bash
adb logcat | grep -i "error\|exception"
```

2. **Enable debug mode**:
```bash
adb shell input keyevent 82  # Open dev menu
```

3. **Check for ProGuard issues** (release builds):
```proguard
# In android/app/proguard-rules.pro
-keep class com.** { *; }
-keep class hyperswarm.** { *; }
```

---

#### Problem: Network connections fail on Android

**Solutions:**

1. **Check network security config** (`android/app/src/main/res/xml/network_security_config.xml`):
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
```

2. **Reference in AndroidManifest.xml**:
```xml
<application
    android:networkSecurityConfig="@xml/network_security_config">
</application>
```

---

## Getting Help

If you're still experiencing issues:

1. **Check existing issues** on GitHub
2. **Create detailed bug report** with:
   - Steps to reproduce
   - Error messages
   - Platform and version
   - Logs (Metro, device, backend)
3. **Ask on Discord/Slack** (if available)
4. **Review specifications** in `design/specs/`

---

## Debugging Checklist

Before asking for help, verify:

- [ ] Versions match requirements (React 18.2.0, RN 0.74.1)
- [ ] All dependencies installed (`npm install`)
- [ ] Metro bundler running
- [ ] Backend server running (if testing P2P)
- [ ] Device/emulator has network access
- [ ] Console logs checked for errors
- [ ] Tried on real device (not just simulator)
- [ ] Cache cleared (`npm start -- --reset-cache`)
- [ ] Pods reinstalled (iOS: `cd ios && pod install`)
- [ ] Gradle cleaned (Android: `cd android && ./gradlew clean`)

---

**Still stuck? Check the [DEVELOPMENT.md](./DEVELOPMENT.md) guide for more details.**
