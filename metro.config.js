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
    extraNodeModules: {
      events: require.resolve('events'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer'),
      process: require.resolve('process/browser'),
      util: require.resolve('util'),
    },
    resolveRequest: (context, moduleName, platform) => {
      // Redirect sodium-native and sodium-universal to our shim
      if (moduleName === 'sodium-native' || moduleName === 'sodium-universal') {
        return {
          filePath: path.resolve(__dirname, 'sodium-native-shim.js'),
          type: 'sourceFile',
        };
      }
      
      // Use default resolver for everything else
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
