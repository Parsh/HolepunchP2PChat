# P2P Chat Root Peer Backend

A minimal, modular root peer server for the P2P Encrypted Chat PoC.

## Features

- ✅ Hyperswarm P2P networking
- ✅ Message storage using Hypercore
- ✅ Room registry and management
- ✅ Peer discovery and routing
- ✅ Persistent state across restarts
- ✅ Clean, modular architecture

## Installation

```bash
cd backend
npm install
```

## Running the Server

```bash
npm start
```

The server will:
1. Start listening for P2P connections
2. Join the root peer discovery swarm
3. Restore any existing rooms from storage
4. Display stats every 30 seconds

## Configuration

Environment variables:
- `STORAGE_DIR`: Directory for data storage (default: `./root-peer-storage`)
- `PORT`: Port for monitoring (default: `3000`)

## Architecture

### Files

- `server.js` - Main server orchestration
- `ChatRootPeer.js` - Core P2P and storage logic
- `package.json` - Dependencies and scripts

### Key Components

**ChatRootPeer** handles:
- Hyperswarm connections
- Message storage (Hypercore)
- Room management
- Peer synchronization
- State persistence

## Storage

Messages are stored in Hypercore append-only logs, one per room. State is persisted to `root-peer-state.json`.

## Development

The server is designed for easy lift-and-shift into production environments. All components are modular and self-contained.

## Monitoring

Stats are logged to console every 30 seconds, including:
- Active rooms
- Total messages
- Connected peers
- Per-room message counts

## Shutdown

The server handles `SIGINT` and `SIGTERM` gracefully:
1. Saves current state
2. Closes all peer connections
3. Destroys Hyperswarm instance
4. Exits cleanly
