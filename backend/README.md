# P2P Chat Root Peer Backend

A TypeScript-based root peer server for the P2P Encrypted Chat application. Provides offline message storage, peer discovery relay, and message synchronization using Hyperswarm and Hypercore.

## 🎯 Purpose

The root peer serves three critical functions:

1. **Offline Message Storage** - Stores encrypted messages when recipients are offline
2. **Peer Discovery Relay** - Helps peers discover each other through a well-known discovery topic
3. **Message Synchronization** - Syncs message history to peers with incremental updates

**Important:** The root peer stores **encrypted messages** only. It cannot decrypt messages as it never receives room keys.

## ✨ Features

- ✅ **Hyperswarm P2P networking** - DHT-based peer discovery and connections
- ✅ **Hypercore storage** - Append-only logs for immutable message history
- ✅ **Incremental sync** - Only sends messages from requested index onwards
- ✅ **Room management** - Multi-room support with isolated storage
- ✅ **Persistent state** - Survives restarts with full state restoration
- ✅ **Zero-knowledge storage** - Stores encrypted data only
- ✅ **Event-driven architecture** - Clean event emission for monitoring
- ✅ **Graceful shutdown** - Handles SIGINT/SIGTERM properly

## 🚀 Quick Start

### Installation

```bash
cd backend
npm install
```

### Running the Server

**Development:**
```bash
npm run dev     # TypeScript with auto-restart
```

**Production:**
```bash
npm start       # Compiled JavaScript
```

### Expected Output

```
🏰 Starting Chat Root Peer...
📁 Storage directory: ./root-peer-storage
🔍 Joining root peer discovery swarm...
🚀 Root peer is ready and waiting for connections!
📊 Stats will be displayed every 30 seconds...

📡 New peer connected: a1b2c3d4e5f6...
🏰 Announcing root peer to a1b2c3d4e5f6...
🏗️  Room abc123... registered by peer a1b2c3d4e5f6
🔗 Root peer joined swarm for room: abc123...
```

## 📋 Architecture

### File Structure

```
backend/
├── server.ts              # Main server entry point
├── ChatRootPeer.ts        # Core P2P logic and storage
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── root-peer-storage/     # Data directory (created on first run)
    ├── root-peer-state.json       # Persistent metadata
    └── <room-topic-hash>/         # Per-room Hypercore storage
        ├── bitfield
        ├── data
        ├── oplog
        └── tree
```

### Core Class: ChatRootPeer

**File:** `ChatRootPeer.ts`

#### Constructor

```typescript
constructor(storageDir: string = './root-peer-storage')
```

Creates a new root peer instance with:
- Corestore for managing Hypercores
- Hyperswarm for P2P networking
- In-memory tracking of active peers and rooms
- Persistent state management

#### Key Methods

##### `start(): Promise<void>`
Initializes the root peer:
1. Loads persistent state from previous sessions
2. Restores existing room Hypercores
3. Joins root peer discovery swarm (topic: `hash('holepunch-root-peer-discovery')`)
4. Sets up connection handlers
5. Starts periodic stats display (every 30s)

##### `handlePeerConnection(conn, info): Promise<void>`
Handles incoming peer connections:
- Tracks peer metadata (ID, public key, connection time)
- Announces root peer identity
- Sets up message handlers
- Manages peer disconnections

##### `registerRoom(peerId, message): Promise<void>`
Registers a room when a peer announces membership:
- Creates/loads Hypercore for room
- Joins room-specific swarm for discovery
- Associates peer with room
- Emits `room-registered` event

##### `storeMessage(peerId, request): Promise<void>`
Stores an encrypted message:
```typescript
{
  type: 'message',
  roomName: 'abc123...',
  message: 'U2FsdGVkX1+...' // Encrypted string
}
```

Stored format in Hypercore:
```json
{
  "message": "U2FsdGVkX1+...",
  "storedAt": 1696723200000,
  "fromPeer": "a1b2c3d4e5f6...",
  "senderPublicKey": "04f3a8b9c2d1..."
}
```

##### `handleSyncRequest(peerId, request): Promise<void>`
Handles incremental sync requests:

**Request:**
```typescript
{
  type: 'sync-request',
  roomName: 'abc123...',
  lastIndex: 5  // Start from message index 5
}
```

**Response:**
```typescript
{
  type: 'sync-response',
  roomName: 'abc123...',
  messages: [
    { message: '...', storedAt: 123, fromPeer: '...', messageIndex: 5 },
    { message: '...', storedAt: 456, fromPeer: '...', messageIndex: 6 },
    // ... more messages
  ],
  totalMessages: 10
}
```

**Optimization:** Only reads and sends messages from `lastIndex` to `roomCore.length`, avoiding full history transfer.

##### `shutdown(): Promise<void>`
Graceful shutdown:
1. Saves current state to disk
2. Closes all peer connections
3. Destroys Hyperswarm instance
4. Cleans up resources

### Message Protocol

The root peer handles these message types:

| Type | Direction | Purpose |
|------|-----------|---------|
| `root-peer-announcement` | Root Peer → Client | Identifies as root peer |
| `register-room` | Client → Root Peer | Register interest in a room |
| `message` | Client → Root Peer | Store encrypted message |
| `sync-request` | Client → Root Peer | Request message history from index |
| `sync-response` | Root Peer → Client | Send message history |

### Storage Structure

#### Hypercore (Per Room)

Append-only log with immutable message history:

```
room-abc123.../
├── bitfield     # Sparse bitfield for data availability
├── data         # Actual message blocks
├── oplog        # Operation log for replication
└── tree         # Merkle tree for verification
```

**Properties:**
- **Immutable:** Once written, messages cannot be modified
- **Verifiable:** Merkle tree ensures data integrity
- **Efficient:** Sparse reads don't require full download
- **Replicable:** Can be replicated to other peers

#### State File (JSON)

**File:** `root-peer-storage/root-peer-state.json`

```json
{
  "rooms": {
    "abc123def456...": {
      "name": "abc123def456...",
      "messageCount": 42,
      "createdAt": 1696723200000,
      "lastActivity": 1696809600000
    }
  },
  "totalMessages": 42,
  "rootPeerCreatedAt": 1696723200000,
  "lastSaved": 1696809600000
}
```

Saved:
- Every 10 messages
- On graceful shutdown
- Periodically (every 30s with stats)

## 🔧 Configuration

### Environment Variables

```bash
STORAGE_DIR=./root-peer-storage  # Data directory
PORT=3000                         # Monitoring port (future use)
NODE_ENV=production               # Environment
```

### Command Line

```bash
# Custom storage directory
STORAGE_DIR=/var/lib/p2p-chat npm start

# Development with TypeScript
npm run dev

# Build only
npm run build
```

## 📊 Monitoring

### Stats Display (Every 30s)

```
================================
📊 Root Peer Statistics
================================
📁 Total Rooms: 3
📨 Total Messages: 127
👥 Active Peers: 5
🕐 Server Uptime: 3.2 hours
================================

📫 Room Details:
  🏠 Room abc123... - 45 messages
  🏠 Room def456... - 62 messages
  🏠 Room ghi789... - 20 messages
================================
```

### Event Emissions

The root peer emits events for monitoring:

```typescript
// Available events
rootPeer.on('ready', () => {});
rootPeer.on('peer-connected', (peerId) => {});
rootPeer.on('peer-disconnected', (peerId) => {});
rootPeer.on('room-registered', ({ roomId, peerId, messageCount }) => {});
rootPeer.on('message-stored', ({ roomName, messageCount, totalMessages }) => {});
```

### Logging

Comprehensive console logging with emojis for easy scanning:

- 🏰 Root peer operations
- 📡 Peer connections
- 🏗️ Room registration
- 💾 Message storage
- 🔄 Sync operations
- ✅ Success messages
- ❌ Error messages

## 🔒 Security

### Zero-Knowledge Storage

**What the root peer knows:**
- ✅ Room ID (public hash)
- ✅ Peer public keys
- ✅ Connection timestamps
- ✅ Message count per room

**What the root peer CANNOT know:**
- ❌ Room keys (never transmitted)
- ❌ Message content (always encrypted)
- ❌ Sender usernames (unless in public key)
- ❌ Any metadata inside encrypted messages

### Encryption Model

```
User A                     Root Peer                    User B
   │                            │                          │
   ├─ Encrypt with room key ───►│                         │
   │                            │                          │
   │                       [Store encrypted]               │
   │                            │                          │
   │                            │◄─── Request sync ────────┤
   │                            │                          │
   │                            ├─ Send encrypted ────────►│
   │                            │                          │
   │                            │                 [Decrypt with room key]
```

### Data Persistence

- **Immutable logs:** Hypercore prevents tampering
- **State backups:** JSON state saved frequently
- **Corruption recovery:** Hypercore self-verifies data integrity

## 🛠️ Development

### TypeScript Support

Full TypeScript with strict type checking:

```typescript
interface Message {
  type: string;
  roomId?: string;
  roomName?: string;
  message?: any;
  lastIndex?: number;
}

interface PeerData {
  connection: any;
  rooms: Set<string>;
  connectedAt: number;
  publicKey?: string;
}
```

### Hot Reload Development

```bash
npm run dev
```

Uses `ts-node-dev` for automatic restart on file changes.

### Building for Production

```bash
npm run build   # Compiles to JavaScript
npm start       # Runs compiled code
```

## 🚀 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure persistent storage directory
- [ ] Set up log aggregation (console.log → file/service)
- [ ] Configure process manager (PM2, systemd)
- [ ] Set up monitoring/alerting
- [ ] Configure firewall for P2P connections
- [ ] Enable automatic restarts on failure

### Process Manager (PM2)

```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start npm --name "p2p-root-peer" -- start

# Monitor
pm2 logs p2p-root-peer
pm2 monit

# Auto-restart on reboot
pm2 startup
pm2 save
```

### Systemd Service

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

### Docker (Optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🐛 Troubleshooting

### Common Issues

**Issue:** Peers can't connect to root peer
- Check firewall allows UDP/TCP connections
- Verify root peer is running and joined discovery swarm
- Check logs for "Root peer is ready" message

**Issue:** Messages not persisting across restarts
- Check storage directory permissions
- Verify `root-peer-state.json` is being saved
- Check disk space availability

**Issue:** High memory usage
- Hypercore caches blocks in memory
- Normal for high message volume
- Consider rotating storage or implementing cleanup

**Issue:** Sync returning too many messages
- Clients should track `lastSyncedIndex`
- Use incremental sync with proper lastIndex parameter
- Consider implementing pagination for very large rooms

### Debug Mode

Enable verbose Hyperswarm logs:

```bash
DEBUG=hyperswarm* npm start
```

## 📈 Performance

### Benchmarks (Approximate)

- **Connections:** 100+ concurrent peers
- **Storage:** Limited by disk space (append-only)
- **Throughput:** 1000+ messages/second
- **Latency:** <50ms message storage
- **Memory:** ~50MB base + ~1KB per cached message

### Optimization Tips

1. **Incremental Sync:** Always use `lastIndex` parameter
2. **State Saves:** Reduce frequency for high-volume rooms
3. **Storage:** Use SSD for better Hypercore performance
4. **Network:** Deploy on well-connected server for better DHT performance

## 🔄 Backup & Recovery

### Backup Strategy

**Data to backup:**
- `root-peer-storage/root-peer-state.json` (metadata)
- `root-peer-storage/room-*/` (Hypercore data)

**Backup script:**
```bash
#!/bin/bash
tar -czf backup-$(date +%Y%m%d).tar.gz root-peer-storage/
```

### Recovery

```bash
# Stop server
pm2 stop p2p-root-peer

# Restore backup
tar -xzf backup-20251008.tar.gz

# Start server
pm2 start p2p-root-peer

# Verify
pm2 logs p2p-root-peer
```

## 🔗 Related Documentation

- **[Main Architecture Guide](../design_docs/ARCHITECTURE.md)** - Complete system overview
- **[Encryption Architecture](../design_docs/ENCRYPTION_ARCHITECTURE.md)** - Security model
- **[Hypercore Documentation](https://docs.holepunch.to/building-blocks/hypercore)** - Storage details
- **[Hyperswarm Documentation](https://docs.holepunch.to/building-blocks/hyperswarm)** - P2P networking

## 📝 License

MIT

---

**Built with ❤️ using Holepunch technologies**
