# Deployment Guide - P2P Encrypted Chat

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Frontend Deployment](#frontend-deployment)
3. [Backend Deployment](#backend-deployment)
4. [Production Considerations](#production-considerations)
5. [Security Checklist](#security-checklist)

---

## Prerequisites

Before deploying, ensure you have:

- ✅ Tested the app thoroughly in development
- ✅ Run all unit and integration tests
- ✅ Verified exact version requirements (React 18.2.0, RN 0.74.1)
- ✅ Backend server ready for deployment
- ✅ Proper certificates for iOS/Android

---

## Frontend Deployment

### iOS Deployment

#### 1. Configure Xcode Project

```bash
cd ios
pod install
cd ..
```

#### 2. Open in Xcode
```bash
open ios/P2PChatTemp.xcworkspace
```

#### 3. Configure Signing
- Select your team in "Signing & Capabilities"
- Update Bundle Identifier
- Ensure provisioning profile is valid

#### 4. Build Release Version
```bash
npx react-native run-ios --configuration Release
```

#### 5. Archive for App Store

In Xcode:
1. Product → Archive
2. Validate App
3. Distribute App
4. Follow App Store submission process

#### iOS Configuration Checklist

- [ ] Update version and build number in `Info.plist`
- [ ] Configure App Icons in `Images.xcassets`
- [ ] Set Launch Screen in `LaunchScreen.storyboard`
- [ ] Review permissions in `Info.plist`
- [ ] Test on physical devices
- [ ] Enable App Transport Security exceptions if needed

---

### Android Deployment

#### 1. Generate Signing Key

```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 \
  -keystore my-release-key.keystore \
  -alias my-key-alias \
  -keyalg RSA -keysize 2048 -validity 10000
```

#### 2. Configure Gradle

Edit `android/gradle.properties`:
```properties
MYAPP_RELEASE_STORE_FILE=my-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=my-key-alias
MYAPP_RELEASE_STORE_PASSWORD=*****
MYAPP_RELEASE_KEY_PASSWORD=*****
```

Edit `android/app/build.gradle`:
```gradle
android {
    ...
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
                storeFile file(MYAPP_RELEASE_STORE_FILE)
                storePassword MYAPP_RELEASE_STORE_PASSWORD
                keyAlias MYAPP_RELEASE_KEY_ALIAS
                keyPassword MYAPP_RELEASE_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            ...
            signingConfig signingConfigs.release
        }
    }
}
```

#### 3. Build Release APK/AAB

**APK** (for testing):
```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

**AAB** (for Play Store):
```bash
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

#### 4. Test Release Build

```bash
npx react-native run-android --variant=release
```

#### Android Configuration Checklist

- [ ] Update version in `android/app/build.gradle`
- [ ] Configure App Icons in `android/app/src/main/res/mipmap-*`
- [ ] Review permissions in `AndroidManifest.xml`
- [ ] Test on multiple Android versions
- [ ] Enable ProGuard/R8 for code obfuscation
- [ ] Test release build thoroughly

---

## Backend Deployment

### Option 1: Traditional VPS (Recommended for PoC)

#### Prerequisites
- Linux VPS (Ubuntu 20.04+)
- Node.js 18+ installed
- SSH access
- Domain name (optional)

#### Deployment Steps

1. **Connect to VPS**:
```bash
ssh user@your-vps-ip
```

2. **Install Node.js**:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. **Clone/Upload Backend**:
```bash
mkdir -p ~/p2p-chat-backend
cd ~/p2p-chat-backend
# Upload files or use git clone
```

4. **Install Dependencies**:
```bash
npm install
```

5. **Create systemd Service**:

Create `/etc/systemd/system/p2p-chat-backend.service`:
```ini
[Unit]
Description=P2P Chat Root Peer Backend
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/home/your-user/p2p-chat-backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=p2p-chat-backend
Environment=NODE_ENV=production
Environment=STORAGE_DIR=/var/lib/p2p-chat-storage

[Install]
WantedBy=multi-user.target
```

6. **Start Service**:
```bash
sudo systemctl daemon-reload
sudo systemctl enable p2p-chat-backend
sudo systemctl start p2p-chat-backend
```

7. **Check Status**:
```bash
sudo systemctl status p2p-chat-backend
sudo journalctl -u p2p-chat-backend -f
```

#### VPS Configuration

**Firewall Rules**:
```bash
# Allow P2P connections (Hyperswarm uses random ports)
sudo ufw allow 49737:65535/tcp
sudo ufw allow 49737:65535/udp
```

**Monitoring**:
```bash
# View logs
sudo journalctl -u p2p-chat-backend -f

# Check resource usage
htop
```

---

### Option 2: Docker Deployment

#### Dockerfile

Create `backend/Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

#### Build and Run

```bash
cd backend
docker build -t p2p-chat-backend .
docker run -d \
  --name p2p-chat-backend \
  -p 49737-65535:49737-65535 \
  -v /var/lib/p2p-chat-storage:/app/root-peer-storage \
  --restart unless-stopped \
  p2p-chat-backend
```

#### Docker Compose

Create `backend/docker-compose.yml`:
```yaml
version: '3.8'

services:
  backend:
    build: .
    container_name: p2p-chat-backend
    ports:
      - "49737-65535:49737-65535"
    volumes:
      - p2p-chat-storage:/app/root-peer-storage
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - STORAGE_DIR=/app/root-peer-storage

volumes:
  p2p-chat-storage:
```

Run with:
```bash
docker-compose up -d
```

---

### Option 3: Cloud Platform (AWS, GCP, Azure)

#### AWS EC2

1. Launch EC2 instance (t3.small recommended)
2. Configure Security Group (allow ports 49737-65535)
3. Follow VPS deployment steps above

#### Google Cloud Platform

1. Create Compute Engine instance
2. Configure firewall rules
3. Follow VPS deployment steps above

#### Microsoft Azure

1. Create Virtual Machine
2. Configure Network Security Group
3. Follow VPS deployment steps above

---

## Production Considerations

### Performance

#### Frontend
- [ ] Enable Hermes engine (default in RN 0.74.1)
- [ ] Minimize bundle size
- [ ] Use ProGuard/R8 for Android
- [ ] Optimize images and assets
- [ ] Enable code splitting if needed

#### Backend
- [ ] Use production Node.js version
- [ ] Enable clustering for multiple cores
- [ ] Monitor memory usage
- [ ] Set up log rotation
- [ ] Use PM2 or systemd for process management

### Scalability

#### Multiple Root Peers
For better reliability, deploy multiple root peer instances:

```bash
# Instance 1
STORAGE_DIR=/data/root-peer-1 npm start

# Instance 2
STORAGE_DIR=/data/root-peer-2 npm start

# Instance 3
STORAGE_DIR=/data/root-peer-3 npm start
```

Peers will automatically discover each other via Hyperswarm.

#### Load Balancing
Not needed for P2P architecture - peers connect directly to each other.

### Monitoring

#### Backend Monitoring

**PM2 with monitoring**:
```bash
npm install -g pm2
pm2 start server.js --name p2p-chat-backend
pm2 monitor
```

**Custom health check**:
Add to `server.js`:
```javascript
import express from 'express';
const healthApp = express();

healthApp.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    rooms: rootPeer.stats.totalRooms,
    messages: rootPeer.stats.totalMessages,
    peers: rootPeer.stats.activePeers
  });
});

healthApp.listen(3000, () => {
  console.log('Health check endpoint: http://localhost:3000/health');
});
```

#### App Monitoring

- Use Sentry for error tracking
- Use Firebase Analytics for usage metrics
- Monitor crash rates in App Store Connect / Play Console

### Backup & Recovery

#### Backend Data Backup

```bash
# Backup storage directory
tar -czf p2p-chat-backup-$(date +%Y%m%d).tar.gz /var/lib/p2p-chat-storage/

# Restore from backup
tar -xzf p2p-chat-backup-20250103.tar.gz -C /
```

**Automated backup script**:
```bash
#!/bin/bash
BACKUP_DIR="/backups/p2p-chat"
STORAGE_DIR="/var/lib/p2p-chat-storage"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/backup-$DATE.tar.gz $STORAGE_DIR

# Keep only last 7 days
find $BACKUP_DIR -name "backup-*.tar.gz" -mtime +7 -delete
```

Run daily via cron:
```bash
0 2 * * * /path/to/backup-script.sh
```

---

## Security Checklist

### Frontend Security

- [ ] **API Keys**: Never commit API keys to version control
- [ ] **Secrets**: Use secure storage for user keys (done via AsyncStorage)
- [ ] **Code Obfuscation**: Enable ProGuard/R8 for Android
- [ ] **SSL Pinning**: Consider for production (optional for P2P)
- [ ] **Jailbreak Detection**: Add if needed for enterprise

### Backend Security

- [ ] **Firewall**: Only open necessary ports
- [ ] **Updates**: Keep Node.js and dependencies updated
- [ ] **Rate Limiting**: Add if needed
- [ ] **DDoS Protection**: Use Cloudflare or similar
- [ ] **Monitoring**: Set up alerts for suspicious activity
- [ ] **Backups**: Automated daily backups

### P2P Security

- [ ] **Encryption**: End-to-end encryption enabled ✅
- [ ] **Key Management**: Proper key storage ✅
- [ ] **Room Keys**: 64-character hex keys for security ✅
- [ ] **Peer Authentication**: Public key verification ✅

### Data Security

- [ ] **Local Storage**: Encrypted AsyncStorage (consider crypto-async-storage)
- [ ] **Message Storage**: Root peer stores unencrypted (by design for offline delivery)
- [ ] **Key Rotation**: Implement if needed for long-term use
- [ ] **Data Retention**: Implement message expiry if needed

---

## Post-Deployment

### Testing Production Build

1. **Install on test devices**
2. **Create and join rooms**
3. **Test message delivery**
4. **Test offline sync**
5. **Monitor backend logs**
6. **Check for crashes**

### Rollout Strategy

1. **Alpha**: Internal testing (10-20 users)
2. **Beta**: External testing (100-500 users)
3. **Production**: Gradual rollout (10% → 50% → 100%)

### Maintenance

- Monitor backend health daily
- Check app crash rates weekly
- Update dependencies monthly
- Review security advisories regularly
- Backup data daily

---

## Support & Updates

### Over-the-Air Updates

Consider CodePush for React Native updates:
```bash
npm install -g appcenter-cli
appcenter codepush release-react P2PChat -d Production
```

### App Store Updates

- iOS: Submit updates via App Store Connect
- Android: Upload new AAB to Play Console

---

## Additional Resources

- [React Native Deployment Docs](https://reactnative.dev/docs/running-on-device)
- [Hyperswarm Production Guide](https://github.com/holepunchto/hyperswarm)
- [PM2 Documentation](https://pm2.keymetrics.io/)

---

**Good luck with your deployment! 🚀**
