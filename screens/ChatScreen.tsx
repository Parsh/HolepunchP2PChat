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
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ChatClient } from '../src/chat/ChatClient';
import { RootStackParamList, ChatMessage } from '../src/types';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;
type ChatScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Chat'>;

interface ChatScreenProps {
  route: ChatScreenRouteProp;
  navigation: ChatScreenNavigationProp;
}

interface PeerInfo {
  id: string;
  username?: string;
  isRootPeer: boolean;
  connectedAt: number;
}

const ChatScreen: React.FC<ChatScreenProps> = ({ route, navigation }) => {
  const { chatClient, roomInfo, cachedMessages = [] } = route.params as any;
  const [messages, setMessages] = useState<ChatMessage[]>(cachedMessages);
  const [inputText, setInputText] = useState('');
  const [connectedPeers, setConnectedPeers] = useState<PeerInfo[]>([]);
  const [isConnectedToRoot, setIsConnectedToRoot] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Set up event listeners
    const setupEventListeners = () => {
      chatClient.on('message', (messageData: ChatMessage) => {
        setMessages(prev => {
          // Avoid duplicates by checking message ID
          const exists = prev.find(m => m.messageId === messageData.messageId);
          if (exists) {
            return prev;
          }

          const newMessages = [...prev, messageData];
          // Sort by timestamp
          return newMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        });
      });

      chatClient.on('peer-connected', (peerId: string) => {
        console.log(`🤝 Peer connected: ${peerId}`);
        updateConnectedPeers();
      });

      chatClient.on('peer-disconnected', (peerId: string) => {
        console.log(`👋 Peer disconnected: ${peerId}`);
        updateConnectedPeers();
      });

      chatClient.on('root-peer-connected', (peerId: string) => {
        console.log(`🏰 Root peer connected: ${peerId}`);
        setIsConnectedToRoot(true);
      });
    };

    const updateConnectedPeers = () => {
      const peers = chatClient.getConnectedPeers() as PeerInfo[];
      setConnectedPeers(peers);
    };

    setupEventListeners();
    updateConnectedPeers();

    // Cleanup on unmount
    return () => {
      chatClient.removeAllListeners();
    };
  }, [chatClient]);

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text) {
      return;
    }

    setInputText('');

    try {
      const result = await chatClient.sendMessage(text);
      if (!result.success) {
        Alert.alert('Error', `Failed to send message: ${result.error}`);
      }
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
          await chatClient.stop();
          navigation.popToTop();
        },
      },
    ]);
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: ListRenderItemInfo<ChatMessage>) => {
    const isOwnMessage = item.sender === roomInfo.username || item.fromSelf;

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

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={handleLeaveRoom}>
        <Text style={styles.leaveButton}>← Leave</Text>
      </TouchableOpacity>

      <View style={styles.headerCenter}>
        <Text style={styles.roomTitle}>🔐 Encrypted Room</Text>
        <Text style={styles.roomSubtitle}>
          {connectedPeers.length} peers connected
          {isConnectedToRoot && ' • Root peer ✅'}
        </Text>
      </View>

      <View style={styles.headerRight} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {renderHeader()}

      <View style={styles.chatContainer}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item, index) => item.messageId || `msg_${index}`}
          style={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>
                Start the conversation! 💬
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
  headerRight: {
    width: 50,
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
});

export default ChatScreen;
