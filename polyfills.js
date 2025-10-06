// Polyfills for Node.js built-in modules in React Native
// IMPORTANT: react-native-get-random-values must be imported FIRST
import 'react-native-get-random-values';

import {Buffer} from 'buffer';
import process from 'process';

// Make Buffer and process globally available
global.Buffer = Buffer;
global.process = process;

// Set process.env if not already set
if (!global.process.env) {
  global.process.env = {};
}

// Disable WebAssembly for libsodium (not supported in React Native)
global.WebAssembly = undefined;
