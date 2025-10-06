import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { HyperswarmManager } from '../src/network/managers/HyperswarmManager';

type RootStackParamList = {
  Welcome: undefined;
  CreateRoom: undefined;
  JoinRoom: undefined;
  Chat: { roomId: string; roomKey?: string };
};

type WelcomeScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Welcome'
>;

interface WelcomeScreenProps {
  navigation: WelcomeScreenNavigationProp;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeNetwork = async () => {
      try {
        const manager = HyperswarmManager.getInstance();
        
        // Set up event listener for when worklet is ready
        const unsubscribe = manager.onReady(() => {
          console.log('[WelcomeScreen] Hyperswarm worklet is ready!');
          setIsReady(true);
          setIsInitializing(false);
        });

        // Set up error listener
        const unsubscribeError = manager.onError((event) => {
          console.error('[WelcomeScreen] Hyperswarm error:', event.error);
          setError(event.error);
          setIsInitializing(false);
        });

        // Initialize the worklet with a seed (in production, load this from secure storage)
        const seed = 'demo-seed-' + Date.now(); // TODO: Replace with actual seed from storage
        await manager.initialize(seed);

        // Cleanup on unmount
        return () => {
          unsubscribe();
          unsubscribeError();
        };
      } catch (err) {
        console.error('[WelcomeScreen] Failed to initialize:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize');
        setIsInitializing(false);
      }
    };

    initializeNetwork();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔐 P2P Encrypted Chat</Text>
      <Text style={styles.subtitle}>Secure, decentralized messaging</Text>
      
      {isInitializing && (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.statusText}>Initializing P2P network...</Text>
        </View>
      )}

      {error && (
        <View style={[styles.statusContainer, styles.errorContainer]}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {isReady && (
        <View style={[styles.statusContainer, styles.readyContainer]}>
          <Text style={styles.readyText}>✓ Network Ready</Text>
        </View>
      )}
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={() => navigation.navigate('CreateRoom')}
      >
        <Text style={styles.buttonText}>Create New Room</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.button, styles.secondaryButton]} 
        onPress={() => navigation.navigate('JoinRoom')}
      >
        <Text style={styles.buttonText}>Join Existing Room</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 50,
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 15,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    marginBottom: 15,
  },
  secondaryButton: {
    backgroundColor: '#5856D6',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusContainer: {
    marginBottom: 20,
    padding: 15,
    borderRadius: 10,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    borderWidth: 1,
    borderColor: '#FF0000',
  },
  errorText: {
    fontSize: 16,
    color: '#CC0000',
    textAlign: 'center',
  },
  readyContainer: {
    backgroundColor: '#E5FFE5',
    borderWidth: 1,
    borderColor: '#00AA00',
  },
  readyText: {
    fontSize: 16,
    color: '#008800',
    fontWeight: 'bold',
  },
});

export default WelcomeScreen;
