import crypto from 'hypercore-crypto';
import sodium from 'libsodium-wrappers';
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
    return crypto.randomBytes(32);
  }

  // Create deterministic room ID from encryption key
  deriveRoomId(roomKey: Buffer | string): string {
    let keyBuffer: Buffer;
    if (typeof roomKey === 'string') {
      keyBuffer = b4a.from(roomKey, 'hex');
    } else {
      keyBuffer = roomKey;
    }
    return crypto.hash(keyBuffer).toString('hex');
  }

  // Generate keypair for P2P encryption
  async generateKeyPair(): Promise<KeyPair> {
    await sodium.ready;
    const publicKey = b4a.alloc(sodium.crypto_box_PUBLICKEYBYTES);
    const secretKey = b4a.alloc(sodium.crypto_box_SECRETKEYBYTES);
    sodium.crypto_box_keypair(publicKey, secretKey);
    return { publicKey, secretKey };
  }

  // Load or generate user keys
  async loadOrGenerateKeys(username: string): Promise<KeyPair> {
    await sodium.ready;
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

  // Encrypt message for P2P transmission
  async encryptMessage(message: any, recipientPublicKey: Buffer): Promise<EncryptedMessage> {
    await sodium.ready;
    
    if (!this.keyPair) {
      throw new Error('KeyPair not initialized. Call loadOrGenerateKeys first.');
    }

    const nonce = b4a.alloc(sodium.crypto_box_NONCEBYTES);
    sodium.randombytes_buf(nonce);

    const plaintext = b4a.from(JSON.stringify(message));
    const ciphertext = b4a.alloc(plaintext.length + sodium.crypto_box_MACBYTES);

    sodium.crypto_box_easy(
      ciphertext,
      plaintext,
      nonce,
      recipientPublicKey,
      this.keyPair.secretKey,
    );

    return {
      type: 'encrypted',
      ciphertext: ciphertext.toString('base64'),
      nonce: nonce.toString('base64'),
      sender: this.keyPair.publicKey.toString('base64'),
    };
  }

  // Decrypt message from P2P transmission
  async decryptMessage(encryptedData: EncryptedMessage): Promise<any | null> {
    try {
      await sodium.ready;
      
      if (!this.keyPair) {
        throw new Error('KeyPair not initialized. Call loadOrGenerateKeys first.');
      }

      const ciphertext = b4a.from(encryptedData.ciphertext, 'base64');
      const nonce = b4a.from(encryptedData.nonce, 'base64');
      const senderPublicKey = b4a.from(encryptedData.sender, 'base64');
      const plaintext = b4a.alloc(ciphertext.length - sodium.crypto_box_MACBYTES);

      if (
        sodium.crypto_box_open_easy(
          plaintext,
          ciphertext,
          nonce,
          senderPublicKey,
          this.keyPair.secretKey,
        )
      ) {
        return JSON.parse(plaintext.toString());
      }

      throw new Error('Decryption failed');
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
