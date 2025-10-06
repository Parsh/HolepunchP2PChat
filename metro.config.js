const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Prioritize TypeScript files over JavaScript files
    sourceExts: ['ts', 'tsx', 'js', 'jsx', 'json'],
    
    extraNodeModules: {
      events: require.resolve('events'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer'),
      process: require.resolve('process/browser'),
      util: require.resolve('util'),
    },
    resolveRequest: (context, moduleName, platform) => {
      // Redirect both sodium-native and sodium-universal to sodium-javascript for React Native
      // sodium-universal uses the browser field which Metro doesn't respect by default
      if (moduleName === 'sodium-native' || moduleName === 'sodium-universal') {
        return {
          filePath: require.resolve('sodium-javascript'),
          type: 'sourceFile',
        };
      }
      
      // Use default resolver for everything else
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
