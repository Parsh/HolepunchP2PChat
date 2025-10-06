import crypto from 'hypercore-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import b4a from 'b4a';

interface KeyPair {
  publicKey: Buffer;
  secretKey: Buffer;
}

interface EncryptedMessage {
  type: 'encrypted';
  ciphertext: string;
  nonce: string;
  sender: string;
}

interface StoredKeyData {
  publicKey: string;
  secretKey: string;
  username: string;
  created: number;
}

export class CryptoManager {
  private keyPair: KeyPair | null = null;

  // Generate 32-byte encryption key for new rooms
  generateNewRoomKey(): Buffer {
    console.log('🔑 generateNewRoomKey called');
    const key = crypto.randomBytes(32);
    console.log('🔑 generateNewRoomKey completed');
    return key;
  }

  // Create deterministic room ID from encryption key
  deriveRoomId(roomKey: Buffer | string): string {
    console.log('🆔 deriveRoomId called');
    let keyBuffer: Buffer;
    if (typeof roomKey === 'string') {
      keyBuffer = b4a.from(roomKey, 'hex');
    } else {
      keyBuffer = roomKey;
    }
    console.log('🆔 About to call crypto.hash...');
    const hash = crypto.hash(keyBuffer);
    console.log('🆔 crypto.hash completed');
    return hash.toString('hex');
  }

  // Generate keypair for P2P encryption using hypercore-crypto
  async generateKeyPair(): Promise<KeyPair> {
    console.log('👥 generateKeyPair called');
    const keyPair = crypto.encryptionKeyPair();
    console.log('👥 generateKeyPair completed');
    return {
      publicKey: keyPair.publicKey,
      secretKey: keyPair.secretKey
    };
  }

  // Load or generate user keys
  async loadOrGenerateKeys(username: string): Promise<KeyPair> {
    const keyPath = `user_keys_${username}`;

    try {
      const storedKeys = await AsyncStorage.getItem(keyPath);
      if (storedKeys) {
        const keyData: StoredKeyData = JSON.parse(storedKeys);
        this.keyPair = {
          publicKey: b4a.from(keyData.publicKey, 'base64'),
          secretKey: b4a.from(keyData.secretKey, 'base64'),
        };
        console.log(`🔑 Loaded existing keys for ${username}`);
      } else {
        this.keyPair = await this.generateKeyPair();

        const keyData: StoredKeyData = {
          publicKey: this.keyPair.publicKey.toString('base64'),
          secretKey: this.keyPair.secretKey.toString('base64'),
          username: username,
          created: Date.now(),
        };

        await AsyncStorage.setItem(keyPath, JSON.stringify(keyData));
        console.log(`💾 Generated new keys for ${username}`);
      }

      return this.keyPair;
    } catch (error) {
      console.error('❌ Failed to load/generate keys:', error);
      throw error;
    }
  }

  // Encrypt message for P2P transmission using hypercore-crypto (sealed box)
  async encryptMessage(message: any, recipientPublicKey: Buffer): Promise<EncryptedMessage> {
    if (!this.keyPair) {
      throw new Error('KeyPair not initialized. Call loadOrGenerateKeys first.');
    }

    const plaintext = b4a.from(JSON.stringify(message));
    
    // Use hypercore-crypto's encrypt (crypto_box_seal)
    // Note: This is anonymous encryption (recipient can't verify sender)
    const ciphertext = crypto.encrypt(plaintext, recipientPublicKey);

    return {
      type: 'encrypted',
      ciphertext: ciphertext.toString('base64'),
      nonce: '', // Not used in sealed box encryption
      sender: this.keyPair.publicKey.toString('base64'),
    };
  }

  // Decrypt message from P2P transmission using hypercore-crypto (sealed box)
  async decryptMessage(encryptedData: EncryptedMessage): Promise<any | null> {
    try {
      if (!this.keyPair) {
        throw new Error('KeyPair not initialized. Call loadOrGenerateKeys first.');
      }

      const ciphertext = b4a.from(encryptedData.ciphertext, 'base64');
      // Note: sender publicKey is in the message for identification, not crypto

      // Use hypercore-crypto's decrypt (crypto_box_seal_open)
      const plaintext = crypto.decrypt(ciphertext, this.keyPair);
      
      if (!plaintext) {
        throw new Error('Decryption failed');
      }

      return JSON.parse(plaintext.toString());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Decryption failed:', errorMessage);
      return null;
    }
  }

  // Get public key as hex string
  getPublicKeyHex(): string | null {
    return this.keyPair ? this.keyPair.publicKey.toString('hex') : null;
  }
}
