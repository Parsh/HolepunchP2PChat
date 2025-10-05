import {ChatRootPeer} from './ChatRootPeer.js';

// Minimal PoC server - no production monitoring overhead
class RootPeerServer {
  constructor(options = {}) {
    this.storageDir = options.storageDir || './root-peer-storage';
    this.chatRootPeer = null;
  }

  async start() {
    console.log('🚀 Starting PoC Root Peer Server...');

    // Start minimal Chat Root Peer
    this.chatRootPeer = new ChatRootPeer(this.storageDir);
    await this.chatRootPeer.start();

    console.log('✅ P2P network ready for connections');

    // Simple shutdown handling
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  async shutdown() {
    console.log('\n🛑 Shutting down Root Peer Server...');

    if (this.chatRootPeer) {
      await this.chatRootPeer.shutdown();
    }

    console.log('✅ Root Peer Server shut down gracefully');
    process.exit(0);
  }

  // PoC stats method for debugging (no HTTP overhead)
  getStats() {
    if (!this.chatRootPeer) {
      return null;
    }

    return {
      totalRooms: this.chatRootPeer.stats.totalRooms,
      totalMessages: this.chatRootPeer.stats.totalMessages,
      activePeers: this.chatRootPeer.stats.activePeers,
    };
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new RootPeerServer({
    port: process.env.PORT || 3000,
    storageDir: process.env.STORAGE_DIR || './root-peer-storage',
  });

  server.start().catch(console.error);
}

export {RootPeerServer};
