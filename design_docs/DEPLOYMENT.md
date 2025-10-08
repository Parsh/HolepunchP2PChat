# Deployment Guide

**Last Updated:** October 8, 2025

## Overview

This guide explains how to deploy the P2P Encrypted Chat application, including the React Native mobile apps and the root peer backend server.

## 🎯 Key Deployment Concepts

### No URL Configuration Required! 🎉

Unlike traditional client-server architectures, this P2P application **does not require hardcoding any backend URLs** in the mobile apps. Here's why:

1. **No HTTP/REST APIs** - The app uses Hyperswarm P2P networking, not HTTP
2. **DHT-based Discovery** - Peers discover each other through a Distributed Hash Table (DHT)
3. **Well-known Discovery Topic** - The root peer is found via a predefined topic hash
4. **Deploy Anywhere** - The backend can be deployed or moved without updating the apps

### How Discovery Works

```
Mobile App (Anywhere)          Hyperswarm DHT          Root Peer (Anywhere)
       │                            │                         │
       ├─ Join discovery topic ────►│                        │
       │   hash('holepunch-root-    │                        │
       │        peer-discovery')     │                        │
       │                             │◄─ Join same topic ────┤
       │                             │                        │
       │◄──────── DHT returns peer addresses ───────────────►│
       │                                                       │
       └──────────── Direct P2P connection ───────────────────┘
                    (Hole-punched NAT traversal)
```

**The discovery topic is hardcoded in both the app and backend**, but it's just a hash - not a URL or IP address. The DHT handles finding peers interested in that topic, regardless of where they're deployed.

---

## 📱 Mobile App Deployment

### iOS (TestFlight / App Store)

#### Prerequisites
- macOS with Xcode
- Apple Developer Account
- CocoaPods installed

#### Build Steps

1. **Prepare the build:**
```bash
cd HolepunchP2PChat
yarn install
yarn bundle:worklet
cd ios
pod install
cd ..
```

2. **Configure signing in Xcode:**
   - Open `ios/P2PChatTemp.xcworkspace` in Xcode
   - Select your development team
   - Configure bundle identifier
   - Set up provisioning profiles

3. **Archive for TestFlight:**
   - Select "Any iOS Device" as target
   - Product → Archive
   - Distribute App → App Store Connect
   - Upload to TestFlight

4. **TestFlight Distribution:**
   - Go to App Store Connect
   - Add internal/external testers
   - Testers receive email invitation
   - Install via TestFlight app

**Result:** Users can install the app via TestFlight and it will automatically discover any deployed root peer through DHT.

### Android (APK / Google Play)

#### Prerequisites
- Android Studio or React Native CLI
- Java JDK 17+
- Android SDK

#### Build Steps

1. **Prepare the build:**
```bash
cd HolepunchP2PChat
yarn install
yarn bundle:worklet
```

2. **Configure signing (for release):**
   - Generate keystore:
   ```bash
   keytool -genkeypair -v -keystore my-release-key.keystore \
     -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```
   - Configure in `android/gradle.properties`:
   ```properties
   MYAPP_RELEASE_STORE_FILE=my-release-key.keystore
   MYAPP_RELEASE_KEY_ALIAS=my-key-alias
   MYAPP_RELEASE_STORE_PASSWORD=****
   MYAPP_RELEASE_KEY_PASSWORD=****
   ```

3. **Build release APK:**
```bash
cd android
./gradlew assembleRelease
```

4. **Output location:**
```
android/app/build/outputs/apk/release/app-release.apk
```

5. **Distribute:**
   - **Direct APK:** Send `app-release.apk` to users
   - **Google Play:** Upload AAB to Play Console
   ```bash
   ./gradlew bundleRelease
   # Output: android/app/build/outputs/bundle/release/app-release.aab
   ```

**Result:** Users install the APK/app and it automatically discovers any deployed root peer through DHT.

---

## 🖥️ Backend Deployment

### Deployment Flexibility

The root peer backend can be deployed **anywhere that runs Node.js**:

- ☁️ Cloud VPS (DigitalOcean, Linode, AWS EC2, etc.)
- 🏠 Home server / Raspberry Pi
- 🐳 Docker container
- ☸️ Kubernetes cluster
- 🌐 PaaS platforms (Heroku, Render, Railway)

**The mobile apps will find it automatically** via DHT - no configuration needed!

### Requirements

- **Node.js 18+** runtime
- **Open UDP ports** (for Hyperswarm DHT - typically works through NAT)
- **Persistent storage** for message history
- **Internet connection** for DHT participation

### Option 1: VPS Deployment (Recommended)

**Example: Ubuntu 22.04 on DigitalOcean/AWS/Linode**

1. **Setup server:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 process manager
sudo npm install -g pm2
```

2. **Deploy application:**
```bash
# Create app directory
sudo mkdir -p /opt/p2p-chat
cd /opt/p2p-chat

# Clone repository (or upload files)
git clone <your-repo-url> .
cd backend

# Install dependencies
npm install

# Build TypeScript
npm run build
```

3. **Configure environment:**
```bash
# Create .env file
cat > .env << EOF
NODE_ENV=production
STORAGE_DIR=/var/lib/p2p-chat
EOF

# Create storage directory
sudo mkdir -p /var/lib/p2p-chat
sudo chown $USER:$USER /var/lib/p2p-chat
```

4. **Start with PM2:**
```bash
# Start server
pm2 start npm --name "p2p-root-peer" -- start

# Save PM2 configuration
pm2 save

# Setup auto-restart on reboot
pm2 startup
# Run the command it outputs (sudo ...)

# Monitor
pm2 logs p2p-root-peer
pm2 monit
```

5. **Firewall (Optional but recommended):**
```bash
# Allow SSH
sudo ufw allow 22/tcp

# Hyperswarm typically works through NAT
# But you can open common DHT ports if needed
sudo ufw allow 49737/udp

# Enable firewall
sudo ufw enable
```

**That's it!** Mobile apps will now discover this root peer through DHT.

### Option 2: Docker Deployment

1. **Create Dockerfile** (already provided in backend README):
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

2. **Build and run:**
```bash
cd backend

# Build image
docker build -t p2p-root-peer .

# Run container
docker run -d \
  --name p2p-root-peer \
  --restart unless-stopped \
  -v /var/lib/p2p-chat:/app/root-peer-storage \
  p2p-root-peer

# View logs
docker logs -f p2p-root-peer
```

3. **Docker Compose (optional):**
```yaml
version: '3.8'
services:
  root-peer:
    build: ./backend
    container_name: p2p-root-peer
    restart: unless-stopped
    volumes:
      - /var/lib/p2p-chat:/app/root-peer-storage
    environment:
      - NODE_ENV=production
      - STORAGE_DIR=/app/root-peer-storage
```

Run with: `docker-compose up -d`

### Option 3: Systemd Service (Alternative to PM2)

1. **Create service file:**
```bash
sudo nano /etc/systemd/system/p2p-root-peer.service
```

2. **Add configuration:**
```ini
[Unit]
Description=P2P Chat Root Peer
After=network.target

[Service]
Type=simple
User=p2p
WorkingDirectory=/opt/p2p-chat/backend
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=STORAGE_DIR=/var/lib/p2p-chat

[Install]
WantedBy=multi-user.target
```

3. **Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable p2p-root-peer
sudo systemctl start p2p-root-peer

# Check status
sudo systemctl status p2p-root-peer

# View logs
sudo journalctl -u p2p-root-peer -f
```

---

## 🔄 Updating the Backend

### The Beauty of Decentralized Discovery

When you need to update or move the backend:

1. **Stop old server:**
```bash
pm2 stop p2p-root-peer
```

2. **Deploy to new location** (different server, different provider, etc.)

3. **Start new server:**
```bash
pm2 start npm --name "p2p-root-peer" -- start
```

4. **Mobile apps automatically reconnect** - No app update required!

### How This Works

- Mobile apps continuously query the DHT for the discovery topic
- When the new root peer joins the DHT, it announces itself on that topic
- Mobile apps discover the new root peer and connect automatically
- **Zero downtime if you run both servers briefly during migration**

### Data Migration (Optional)

If you want to preserve message history:

```bash
# On old server
tar -czf root-peer-backup.tar.gz root-peer-storage/

# Transfer to new server
scp root-peer-backup.tar.gz user@new-server:/opt/p2p-chat/backend/

# On new server
tar -xzf root-peer-backup.tar.gz
```

---

## 🌍 Multi-Region Deployment

### Running Multiple Root Peers

You can deploy **multiple root peers** in different regions for redundancy:

```
Root Peer 1 (US East)     ─┐
Root Peer 2 (EU West)      ├─► All join same discovery topic
Root Peer 3 (Asia)        ─┘

Mobile App connects to → Closest/fastest peer automatically
```

**Setup:**
1. Deploy the same backend code to multiple servers
2. They all join the same discovery topic (`hash('holepunch-root-peer-discovery')`)
3. Mobile apps will discover and connect to one (typically the fastest)

**Note:** Currently, each root peer maintains independent message storage. For full redundancy, you'd need to implement Hypercore replication between root peers (future enhancement).

---

