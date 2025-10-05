// Polyfills for Node.js built-in modules in React Native
import {Buffer} from 'buffer';
import process from 'process';

// Make Buffer and process globally available
global.Buffer = Buffer;
global.process = process;

// Set process.env if not already set
if (!global.process.env) {
  global.process.env = {};
}
