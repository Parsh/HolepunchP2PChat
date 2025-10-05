/**
 * @format
 */

// Gesture handler must be imported first
import 'react-native-gesture-handler';

// Load polyfills
import './polyfills';

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
