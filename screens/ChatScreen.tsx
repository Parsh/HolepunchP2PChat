import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ListRenderItemInfo,
  Modal,
  Share,
  Clipboard,
  RefreshControl,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { HyperswarmManager } from '../src/network/managers/HyperswarmManager';
import { RoomStorage } from '../src/storage/RoomStorage';
import { RootStackParamList, ChatMessage } from '../src/types';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;
type ChatScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Chat'>;

interface ChatScreenProps {
  route: ChatScreenRouteProp;
  navigation: ChatScreenNavigationProp;
}

const ChatScreen: React.FC<ChatScreenProps> = ({ route, navigation }) => {
  const { roomId, roomKey } = route.params;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [connectedPeersCount, setConnectedPeersCount] = useState(0);
  const [isRootPeerConnected, setIsRootPeerConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [myPublicKey, setMyPublicKey] = useState<string>('');
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const manager = HyperswarmManager.getInstance();

  useEffect(() => {
    // Get my public key
    const getMyKey = async () => {
      try {
        const keys = await manager.getKeys();
        setMyPublicKey(keys.publicKey);
      } catch (error) {
        console.error('Failed to get keys:', error);
      }
    };

    // Update last active timestamp for this room
    RoomStorage.updateLastActive(roomId);

    getMyKey();

    // Set up event listeners
    const unsubscribePeerConnected = manager.onPeerConnected((event) => {
      console.log(`🤝 Peer connected: ${event.peerPublicKey}`);
      updateConnectedPeers();
    });

    const unsubscribePeerDisconnected = manager.onPeerDisconnected((event) => {
      console.log(`👋 Peer disconnected: ${event.peerPublicKey}`);
      updateConnectedPeers();
    });

    const unsubscribeMessage = manager.onMessageReceived((event) => {
      console.log(`📨 Message received from ${event.peerPublicKey}`);
      
      const newMessage: ChatMessage = {
        text: event.message.text,
        sender: event.peerPublicKey.substring(0, 8), // Use first 8 chars of public key as display name
        timestamp: event.message.timestamp || Date.now(),
        messageId: `${event.peerPublicKey}_${Date.now()}`,
        fromSelf: false,
      };

      setMessages(prev => {
        // Avoid duplicates
        const exists = prev.find(m => m.messageId === newMessage.messageId);
        if (exists) return prev;
        
        const updated = [...prev, newMessage];
        return updated.sort((a, b) => a.timestamp - b.timestamp);
      });
    });

    // Listen for root peer disconnection
    const unsubscribeRootPeerDisconnected = manager.onRootPeerDisconnected(() => {
      console.log('[ChatScreen] ⚠️ Root peer disconnected!');
      setIsRootPeerConnected(false);
      Alert.alert(
        'Backend Server Disconnected',
        'The backend server has disconnected. Your messages will not be backed up until the server reconnects.',
        [{ text: 'OK' }]
      );
    });

    // Listen for root peer reconnection
    const unsubscribeRootPeerConnected = manager.onRootPeerConnected(() => {
      console.log('[ChatScreen] ✅ Root peer reconnected!');
      setIsRootPeerConnected(true);
      Alert.alert(
        'Backend Server Connected',
        'The backend server has reconnected. Message backup has resumed.',
        [{ text: 'OK' }]
      );
    });

    const updateConnectedPeers = async () => {
      try {
        const peers = await manager.getConnectedPeers();
        setConnectedPeersCount(peers.length);
      } catch (error) {
        console.error('Failed to get peers:', error);
      }
    };

    // Check initial root peer connection status
    setIsRootPeerConnected(manager.isRootPeerConnected());

    updateConnectedPeers();

    // Cleanup on unmount
    return () => {
      unsubscribePeerConnected();
      unsubscribePeerDisconnected();
      unsubscribeMessage();
      unsubscribeRootPeerDisconnected();
      unsubscribeRootPeerConnected();
    };
  }, [manager]);

  const onRefresh = async () => {
    setRefreshing(true);

    try {
      if (manager.isRootPeerConnected()) {
        Alert.alert(
          'Backend Already Connected',
          'The backend server is already connected.',
          [{ text: 'OK' }]
        );
      } else {
        console.log('[ChatScreen] 🔄 Attempting to reconnect to backend...');
        console.log('[ChatScreen] 📡 Waiting for root peer discovery...');
        
        try {
          // Try to reconnect with 5 second timeout
          // Note: The worklet is already actively searching for the root peer
          // on the discovery swarm. This just waits for the connection.
          await manager.waitForRootPeer(5000);
          
          Alert.alert(
            'Backend Reconnected',
            'Successfully reconnected to the backend server. Message backup has resumed.',
            [{ text: 'OK' }]
          );
        } catch (error) {
          Alert.alert(
            'Backend Unavailable',
            'Could not connect to the backend server within 5 seconds. Please ensure the server is running.\n\nThe app will continue trying to connect in the background.',
            [{ text: 'OK' }]
          );
        }
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text) {
      return;
    }

    setInputText('');

    try {
      const timestamp = Date.now();
      const messageId = `${myPublicKey}_${timestamp}`;

      const message = {
        id: messageId,
        roomTopic: roomId,
        text,
        sender: myPublicKey.substring(0, 8),
        timestamp,
      };

      // Add to local messages immediately
      const localMessage: ChatMessage = {
        text: message.text,
        sender: message.sender,
        timestamp: message.timestamp,
        messageId: message.id,
        fromSelf: true,
      };

      setMessages(prev => [...prev, localMessage].sort((a, b) => a.timestamp - b.timestamp));

      // Send to all peers in the room
      await manager.sendMessage(roomId, message);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to send message: ${errorMessage}`);
    }
  };

  const handleLeaveRoom = () => {
    Alert.alert('Leave Room', 'Are you sure you want to leave this room?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await manager.leaveRoom(roomId);
            navigation.popToTop();
          } catch (error) {
            console.error('Failed to leave room:', error);
            navigation.popToTop();
          }
        },
      },
    ]);
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: ListRenderItemInfo<ChatMessage>) => {
    const isOwnMessage = item.fromSelf || item.sender === myPublicKey.substring(0, 8);

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}>
        <View
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownBubble : styles.otherBubble,
          ]}>
          {!isOwnMessage && (
            <Text style={styles.senderName}>{item.sender}</Text>
          )}
          <Text
            style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
            ]}>
            {item.text}
          </Text>
          <Text
            style={[
              styles.timestamp,
              isOwnMessage ? styles.ownTimestamp : styles.otherTimestamp,
            ]}>
            {formatTimestamp(item.timestamp)}
            {item.fromSync && ' 📥'}
          </Text>
        </View>
      </View>
    );
  };

  const shareRoomKey = async () => {
    try {
      await Share.share({
        message: `Join my encrypted chat room!\n\nRoom Key: ${roomKey}\n\nDownload the P2P Chat app and use this key to join.`,
        title: 'P2P Chat Room Key',
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  const copyRoomKey = () => {
    Clipboard.setString(roomKey);
    Alert.alert('Copied', 'Room key copied to clipboard!');
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={handleLeaveRoom}>
        <Text style={styles.leaveButton}>← Leave</Text>
      </TouchableOpacity>

      <View style={styles.headerCenter}>
        <Text style={styles.roomTitle}>🔐 Encrypted Room</Text>
        <View style={styles.connectionStatusContainer}>
          <View style={styles.statusBadge}>
            <Text style={[
              styles.statusText,
              isRootPeerConnected ? styles.connectedText : styles.disconnectedText
            ]}>
              {isRootPeerConnected ? '✓' : '⚠️'} Backend
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.peersText}>
              👥 {connectedPeersCount} peer{connectedPeersCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.headerRight} 
        onPress={() => setShowRoomInfo(true)}
      >
        <Text style={styles.infoButton}>ℹ️</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {renderHeader()}

      {/* Room Info Modal */}
      <Modal
        visible={showRoomInfo}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRoomInfo(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Room Information</Text>
              <TouchableOpacity onPress={() => setShowRoomInfo(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Room Key</Text>
              <Text style={styles.modalSubtext}>
                Share this key with others to let them join this room
              </Text>
              
              <View style={styles.roomKeyContainer}>
                <Text style={styles.roomKeyText}>{roomKey}</Text>
              </View>

              <TouchableOpacity 
                style={styles.modalButton} 
                onPress={() => {
                  copyRoomKey();
                  setShowRoomInfo(false);
                }}
              >
                <Text style={styles.modalButtonText}>📋 Copy Room Key</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonSecondary]} 
                onPress={() => {
                  shareRoomKey();
                  setShowRoomInfo(false);
                }}
              >
                <Text style={styles.modalButtonText}>📤 Share Room Key</Text>
              </TouchableOpacity>

              <View style={styles.modalWarning}>
                <Text style={styles.modalWarningText}>
                  ⚠️ Anyone with this key can join your room
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.chatContainer}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item, index) => item.messageId || `msg_${index}`}
          style={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              title="Pull to reconnect backend"
              tintColor="#007AFF"
              titleColor="#666"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>
                Start the conversation! 💬
              </Text>
              <Text style={styles.pullToRefreshHint}>
                Pull down to reconnect backend if disconnected
              </Text>
            </View>
          }
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              multiline={true}
              maxLength={1000}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !inputText.trim() && styles.sendButtonDisabled,
              ]}
              onPress={handleSendMessage}
              disabled={!inputText.trim()}>
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  leaveButton: {
    color: '#007AFF',
    fontSize: 16,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  roomTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  roomSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  connectionStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  connectedText: {
    color: '#00AA00',
  },
  disconnectedText: {
    color: '#FF8800',
  },
  peersText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007AFF',
  },
  headerRight: {
    width: 50,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  infoButton: {
    fontSize: 24,
    color: '#007AFF',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  messageContainer: {
    marginVertical: 5,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
  },
  ownBubble: {
    backgroundColor: '#007AFF',
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  senderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 16,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 10,
    opacity: 0.7,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownTimestamp: {
    color: '#FFFFFF',
  },
  otherTimestamp: {
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#A0A0A0',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#BBB',
  },
  pullToRefreshHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 20,
    fontStyle: 'italic',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  modalClose: {
    fontSize: 28,
    color: '#666',
    fontWeight: '300',
  },
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  roomKeyContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  roomKeyText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
  },
  modalButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalButtonSecondary: {
    backgroundColor: '#5856D6',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalWarning: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FFE69C',
  },
  modalWarningText: {
    fontSize: 13,
    color: '#856404',
    textAlign: 'center',
  },
});

export default ChatScreen;
