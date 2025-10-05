// Shared TypeScript types for the application

export type RootStackParamList = {
  Welcome: undefined;
  CreateRoom: undefined;
  JoinRoom: undefined;
  Chat: { roomId: string; roomKey?: string };
};

export interface RoomInfo {
  roomId: string;
  roomKey: string | Buffer;
  isCreator: boolean;
  username: string;
  createdAt?: number;
  joinedAt?: number;
}

export interface ChatMessage {
  text: string;
  sender: string;
  timestamp: number;
  messageId?: string;
  fromSelf?: boolean;
  fromSync?: boolean;
  peerId?: string;
}
