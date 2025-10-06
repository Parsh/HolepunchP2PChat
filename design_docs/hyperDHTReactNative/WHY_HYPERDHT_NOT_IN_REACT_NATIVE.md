# Why Hyperdht is Not Supported in React Native (And How to Work Around It)

## ⚠️ UPDATE: There IS a Solution!

**See [BARE_KIT_SOLUTION.md](./BARE_KIT_SOLUTION.md) for how to run Hyperswarm in React Native using `react-native-bare-kit`!**

The bitcoin-tribe project successfully uses Hyperswarm in React Native by running it in a **Bare worklet** (native runtime) that communicates with React Native via IPC. This document explains why the standard approach doesn't work, but Bare Kit provides a native solution.

---

## Executive Summary (Standard React Native)

**Hyperdht** (used by Hyperswarm for P2P networking) **fundamentally cannot work in standard React Native** because it requires UDP socket access, which is not available in mobile JavaScript environments. This is not a limitation we can fix with polyfills or shims—it's an architectural constraint of mobile platforms.

**However**, using `react-native-bare-kit`, you can run Hyperswarm in a native worklet with full Node.js compatibility. See [BARE_KIT_SOLUTION.md](./BARE_KIT_SOLUTION.md) for details.

---

## What is Hyperdht?

`hyperdht` is the Distributed Hash Table (DHT) implementation used by Hyperswarm to:
- **Discover peers** on the network without a central server
- **Create direct P2P connections** using UDP hole-punching
- **Enable NAT traversal** so peers behind firewalls can connect to each other

## Why It Doesn't Work in React Native

### 1. **UDP Socket Access Required**

Hyperdht relies on **UDP sockets** for:
- DHT protocol communication
- UDP hole-punching for NAT traversal
- Direct peer-to-peer connections

**React Native does not provide UDP socket APIs** because:
- iOS and Android don't expose raw UDP socket access to JavaScript
- The JavaScript runtime (JavaScriptCore/Hermes) has no built-in UDP support
- There's no equivalent to Node.js's `dgram` module

```javascript
// This works in Node.js:
const dgram = require('dgram');
const socket = dgram.createSocket('udp4');

// This DOESN'T work in React Native - no dgram module exists
```

### 2. **Browser/Mobile Limitations**

React Native, like web browsers, runs in a **sandboxed environment** where:
- **Direct network access is restricted** for security
- Only HTTP/HTTPS, WebSocket, and WebRTC are available
- Raw TCP/UDP sockets are not accessible

This is the same reason you can't use Hyperswarm in a web browser:

```javascript
// From hyperdht source code:
if (typeof window !== 'undefined') {
  throw new Error('hyperdht is not supported in browsers')
}
```

### 3. **NAT Traversal Techniques Not Available**

Hyperdht uses advanced networking techniques that require OS-level access:

| Technique | Requires | Available in RN? |
|-----------|----------|------------------|
| **UDP Hole Punching** | Raw UDP sockets | ❌ No |
| **STUN/TURN** (manual) | UDP sockets | ❌ No |
| **Port Mapping (UPnP)** | Network protocol access | ❌ No |
| **Direct Socket Binding** | OS-level socket APIs | ❌ No |

### 4. **Node.js vs React Native Architecture**

```
┌─────────────────────────────────────────────────────────┐
│                      Node.js                             │
├─────────────────────────────────────────────────────────┤
│  JavaScript Code                                         │
│    ↓                                                     │
│  Node.js APIs (dgram, net, etc.)                        │
│    ↓                                                     │
│  libuv (C library for async I/O)                        │
│    ↓                                                     │
│  Operating System (UDP/TCP sockets)    ✅ Direct Access │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   React Native                           │
├─────────────────────────────────────────────────────────┤
│  JavaScript Code                                         │
│    ↓                                                     │
│  React Native Bridge                                     │
│    ↓                                                     │
│  Limited Native APIs (HTTP, WebSocket, WebRTC only)     │
│    ↓                                                     │
│  Operating System (UDP/TCP blocked)    ❌ No Access     │
└─────────────────────────────────────────────────────────┘
```

---

## What Networks Protocols ARE Available in React Native?

| Protocol | Available? | Use Case |
|----------|-----------|----------|
| **HTTP/HTTPS** | ✅ Yes | REST APIs, file downloads |
| **WebSocket** | ✅ Yes | Real-time bidirectional communication |
| **WebRTC** | ✅ Yes (with library) | P2P audio/video/data channels |
| **TCP Sockets** | ❌ No | Direct TCP connections |
| **UDP Sockets** | ❌ No | Hyperdht, gaming, VoIP |
| **Raw Sockets** | ❌ No | Custom protocols |

---

## Technical Deep Dive: The Error Chain

When you try to use Hyperswarm in React Native, here's what happens:

```javascript
// 1. You create a Hyperswarm instance
const swarm = new Hyperswarm();

// 2. Hyperswarm initializes hyperdht
const dht = new HyperDHT(opts);

// 3. hyperdht tries to detect the environment
if (typeof window !== 'undefined') {
  // Detects browser-like environment (React Native has 'window')
  throw new Error('hyperdht is not supported in browsers');
}

// 4. If that check passes, it tries to create UDP socket
const dgram = require('dgram'); // ❌ Fails - module not found

// 5. Even if shimmed, it tries to call:
socket.bind(port); // ❌ Fails - function doesn't exist
socket.send(msg, offset, length, port, address); // ❌ Fails
```

---

## Solutions Comparison

| Solution | True P2P? | Backend Required? | Complexity | Bundle Size | Status |
|----------|-----------|-------------------|------------|-------------|--------|
| **Bare Kit** ⭐ | ✅ Yes | ❌ No | Medium | Large | **Recommended** |
| WebSocket Bridge | ❌ No | ✅ Yes | Low | Small | Alternative |
| WebRTC | ✅ Yes | ⚠️ For signaling | High | Medium | Alternative |
| Native UDP Module | ✅ Yes | ❌ No | Very High | Small | Not recommended |

**Our Recommendation: Bare Kit** - Proven, production-ready, and enables true P2P with Hyperswarm.

---

## Solutions and Alternatives

### ⭐ Solution 0: **Bare Kit with Native Worklet** (RECOMMENDED ✨)

Use `react-native-bare-kit` to run Hyperswarm in a native worklet:
- **Bare Worklet (Native Runtime)**: Runs Hyperswarm with full UDP access
- **React Native App**: Communicates with worklet via IPC/RPC
- **True P2P on Mobile**: No backend server required!

**See [BARE_KIT_SOLUTION.md](./BARE_KIT_SOLUTION.md) for complete implementation guide.**

```
┌─────────────┐              ┌──────────────┐
│  RN App     │◄──── IPC ────►│ Bare Worklet │
│  (UI/UX)    │   (bare-rpc)  │ (Hyperswarm) │
└─────────────┘               └──────┬───────┘
                                     │
                              Hyperswarm P2P
                                     │
                              ┌──────┴──────┐
                              │   DHT       │
                              │   Network   │
                              └─────────────┘
```

**Pros:**
- True P2P between mobile devices
- No backend server required
- Full Hyperswarm functionality
- Native performance

**Cons:**
- Larger app bundle size (~238 MB for bare-kit)
- Additional complexity (managing two runtimes)
- Newer technology (smaller community)

---

### ✅ Solution 1: **WebSocket Bridge Architecture** (Alternative - Simpler Setup)

Use a **hybrid architecture**:
- **Backend (Node.js)**: Runs Hyperswarm for true P2P
- **Mobile (React Native)**: Connects to backend via WebSocket
- **Backend acts as a bridge** between mobile clients and P2P network

```
┌─────────────┐                    ┌──────────────┐
│  RN Client  │◄──── WebSocket ────►│   Backend    │
│  (Mobile)   │                     │  (Node.js)   │
└─────────────┘                     └──────────────┘
                                           │
                                    Hyperswarm P2P
                                           │
                                    ┌──────┴──────┐
                                    │   DHT       │
                                    │   Network   │
                                    └─────────────┘
```

**Pros:**
- Works immediately with existing Hyperswarm backend
- Mobile clients get full P2P network access through backend
- Backend can cache/relay messages

**Cons:**
- Mobile clients depend on backend availability
- Not "pure" P2P for mobile

---

### ✅ Solution 2: **WebRTC Data Channels** (Alternative - Industry Standard)

Use WebRTC for true peer-to-peer connections:
- **Signaling server** (can be your backend) helps peers discover each other
- **WebRTC data channels** provide P2P data transfer
- **STUN/TURN servers** handle NAT traversal

```
┌─────────────┐                    ┌──────────────┐
│  RN Client  │◄──── Signaling ────►│   Backend    │
│  (Mobile)   │      (WebSocket)    │  (Signal)    │
└──────┬──────┘                     └──────────────┘
       │
       │ WebRTC Data Channel (P2P)
       │
       ▼
┌─────────────┐
│  RN Client  │
│  (Mobile)   │
└─────────────┘
```

**Pros:**
- True P2P connections between mobile clients
- Industry standard (used by Zoom, Google Meet, etc.)
- Works on all platforms

**Cons:**
- Requires WebRTC implementation
- Needs STUN/TURN servers for NAT traversal
- More complex than WebSocket bridge

**Libraries:**
- [`react-native-webrtc`](https://github.com/react-native-webrtc/react-native-webrtc)
- [`simple-peer`](https://github.com/feross/simple-peer) (works in RN)

---

### ❌ Solution 3: **Native UDP Module** (Not Recommended)

You *could* create a native module that exposes UDP sockets to React Native:
- Write Objective-C/Swift (iOS) and Java/Kotlin (Android) code
- Expose UDP socket APIs to JavaScript
- Implement the entire hyperdht protocol in native code

**Why this is a bad idea:**
- Massive amount of work (thousands of lines of native code)
- Need to maintain separate iOS and Android implementations
- Would need to reimplement hyperdht's complex DHT logic
- Security concerns (exposing raw sockets)
- App store rejection risk (some platforms restrict P2P apps)

---

## Comparison: What Works Where

| Feature | Node.js | React Native | Browser |
|---------|---------|--------------|---------|
| **Hyperswarm** | ✅ Yes | ❌ No | ❌ No |
| **hyperdht** | ✅ Yes | ❌ No | ❌ No |
| **UDP Sockets** | ✅ Yes | ❌ No | ❌ No |
| **TCP Sockets** | ✅ Yes | ❌ No | ❌ No |
| **WebSocket** | ✅ Yes | ✅ Yes | ✅ Yes |
| **WebRTC** | ✅ Yes | ✅ Yes* | ✅ Yes |
| **HTTP/HTTPS** | ✅ Yes | ✅ Yes | ✅ Yes |

*Requires `react-native-webrtc` library

---

## Why This Matters for Your Project

Your current architecture uses:
```typescript
// src/network/NetworkManager.ts
import Hyperswarm from 'hyperswarm';  // ❌ Won't work in standard React Native

// backend/ChatRootPeer.ts
import Hyperswarm from 'hyperswarm';  // ✅ Works in Node.js backend
```

**You have two codebases:**
1. **Backend (Node.js)** - Can use Hyperswarm ✅
2. **Mobile App (React Native)** - Cannot use Hyperswarm in standard way ❌

**The recommended solution:** Use Bare Kit to run Hyperswarm in a native worklet on mobile! 🎉

With Bare Kit, your mobile app can:
- Run Hyperswarm directly (in a worklet)
- Have true P2P networking
- Work offline without backend
- Connect directly to other peers

**Alternative solution:** Keep Hyperswarm in the backend, use WebSocket to connect mobile clients (hybrid approach).

---

## Implementation Recommendation

Based on your project structure and the proven bitcoin-tribe implementation, **we recommend Solution 0: Bare Kit** for true P2P functionality.

### ⭐ Recommended: **Bare Kit Implementation** (Best for True P2P)

**Why this is the best choice:**
- ✅ **True peer-to-peer** - No backend dependency for P2P networking
- ✅ **Proven solution** - Successfully used in production by bitcoin-tribe
- ✅ **Full Hyperswarm** - Complete feature set, no compromises
- ✅ **Native performance** - Direct UDP socket access
- ✅ **Future-proof** - Built by Holepunch team specifically for this use case

**Implementation steps:**
1. Follow [IMPLEMENTATION_GUIDE_BARE_KIT.md](./IMPLEMENTATION_GUIDE_BARE_KIT.md)
2. Install `react-native-bare-kit` and dependencies
3. Create worklet with Hyperswarm code
4. Generate bundle with `bare-pack`
5. Create PeerManager for React Native integration
6. Test on iOS and Android

**When to choose this:**
- You want true P2P mobile networking
- You're okay with larger bundle size (~238 MB)
- You want to avoid backend server costs/complexity
- You need offline-capable P2P functionality

---

### Alternative: **WebSocket Bridge** (Quick Start, Requires Backend)

If you need a faster implementation or want to avoid the Bare Kit complexity initially:

1. Add WebSocket server to your backend
2. Modify `NetworkManager.ts` to use WebSocket instead of Hyperswarm
3. Backend bridges messages between WebSocket clients and Hyperswarm peers

**When to choose this:**
- You need a working solution immediately
- You already have backend infrastructure
- Bundle size is critical
- You're okay with backend dependency

---

### Alternative: **WebRTC P2P** (Complex Setup)

For direct P2P without Bare Kit:

1. Add WebRTC signaling to backend
2. Use `react-native-webrtc` for direct mobile-to-mobile connections
3. Backend only used for initial peer discovery

**When to choose this:**
- You want P2P but can't use Bare Kit
- You need audio/video capabilities anyway
- You have WebRTC expertise

---

## References

- [Hyperswarm GitHub](https://github.com/holepunchto/hyperswarm) - "Works in Node.js only"
- [hyperdht Source Code](https://github.com/holepunchto/hyperdht/blob/main/index.js#L1) - Browser check
- [React Native Networking](https://reactnative.dev/docs/network) - Available APIs
- [WebRTC in React Native](https://github.com/react-native-webrtc/react-native-webrtc)

---

## Conclusion

**Hyperdht cannot work in standard React Native** because:
1. It requires UDP sockets (not available in RN)
2. It needs OS-level network access (blocked by mobile sandbox)
3. React Native only supports HTTP, WebSocket, and WebRTC

**However, there IS a solution:** Use `react-native-bare-kit` to run Hyperswarm in a native worklet with full UDP access. This is a proven, production-ready approach used by bitcoin-tribe.

**Recommended path forward:**
1. **Start here:** Read [BARE_KIT_SOLUTION.md](./BARE_KIT_SOLUTION.md) to understand the architecture
2. **Implement:** Follow [IMPLEMENTATION_GUIDE_BARE_KIT.md](./IMPLEMENTATION_GUIDE_BARE_KIT.md) step-by-step
3. **Reference:** Study [bitcoin-tribe's implementation](https://github.com/bithyve/bitcoin-tribe/tree/main/src/services/p2p)

**Alternative approaches** (WebSocket bridge or WebRTC) are available if you need a faster start or have constraints that prevent using Bare Kit, but **Bare Kit is the recommended solution for true peer-to-peer mobile networking with Hyperswarm**.

This is not a bug or missing feature—standard React Native intentionally restricts UDP access for security. Bare Kit works around this by providing a native runtime alongside React Native. 🚀
