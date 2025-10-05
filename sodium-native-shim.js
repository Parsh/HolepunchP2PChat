// Shim for sodium-native to use libsodium-wrappers in React Native
import sodium from 'libsodium-wrappers';

// Re-export libsodium-wrappers as sodium-native
module.exports = sodium;
