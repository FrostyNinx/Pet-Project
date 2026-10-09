import { Peer } from 'peerjs';

export class PeerSyncEngine {
  constructor({
    onConnected,
    onDisconnected,
    onRemoteStroke,
    onRemoteFrameAdd,
    onRemoteFrameDuplicate,
    onRemoteFrameDelete,
    onRemoteCursor,
    onRemoteCareAction,
    onRemotePetMessage,
    onFullPetSync,
    onVersionMismatch,
    appVersion
  }) {
    this.peer = null;
    this.conn = null;
    this.myPeerId = null;
    this.roomCode = null;
    this.isHost = false;
    this.isConnected = false;
    this.isHandshakeComplete = false;
    this.handshakeTimeout = null;
    this.appVersion = appVersion || '1.0.2';

    this.onConnected = onConnected || (() => {});
    this.onDisconnected = onDisconnected || (() => {});
    this.onRemoteStroke = onRemoteStroke || (() => {});
    this.onRemoteFrameAdd = onRemoteFrameAdd || (() => {});
    this.onRemoteFrameDuplicate = onRemoteFrameDuplicate || (() => {});
    this.onRemoteFrameDelete = onRemoteFrameDelete || (() => {});
    this.onRemoteCursor = onRemoteCursor || (() => {});
    this.onRemoteCareAction = onRemoteCareAction || (() => {});
    this.onRemotePetMessage = onRemotePetMessage || (() => {});
    this.onFullPetSync = onFullPetSync || (() => {});
    this.onVersionMismatch = onVersionMismatch || (() => {});
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'PET-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  normalizeRoomCode(rawCode) {
    let code = (rawCode || '').trim().toUpperCase();
    if (code.startsWith('COOP-PET-')) {
      code = code.replace('COOP-PET-', '');
    }
    if (!code.startsWith('PET-')) {
      code = 'PET-' + code;
    }
    return code;
  }

  /**
   * Start as Host: creates a Peer with the room code
   * @param {string} customCode Optional custom room code
   */
  startHost(customCode = null) {
    const code = customCode ? this.normalizeRoomCode(customCode) : this.generateRoomCode();
    this.roomCode = code;
    this.isHost = true;

    // Use PeerJS standard cloud broker
    this.peer = new Peer(`coop-pet-${code.toLowerCase()}`);

    this.peer.on('open', (id) => {
      this.myPeerId = id;
      console.log('Peer Host opened with ID:', id, 'Room Code:', code);
      document.dispatchEvent(new CustomEvent('p2p-host-ready', { detail: code }));
    });

    this.peer.on('connection', (conn) => {
      console.log('Incoming connection from partner!');
      this.setupConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.warn('Peer error:', err);
      // If code was taken, try another random code
      if (err.type === 'unavailable-id') {
        document.dispatchEvent(new CustomEvent('p2p-error', {
          detail: { message: 'This room code is already active. Generating a new one...' }
        }));
        this.startHost();
      } else {
        document.dispatchEvent(new CustomEvent('p2p-error', {
          detail: { message: err.message || 'P2P network error' }
        }));
      }
    });
  }

  /**
   * Join an existing Host room using code
   * @param {string} code 
   */
  joinRoom(code) {
    const normalized = this.normalizeRoomCode(code);
    this.roomCode = normalized;
    this.isHost = false;

    this.peer = new Peer();

    this.peer.on('open', (myId) => {
      this.myPeerId = myId;
      console.log('Connecting to host room:', normalized);
      const conn = this.peer.connect(`coop-pet-${normalized.toLowerCase()}`, {
        reliable: true
      });
      this.setupConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('Peer join error:', err);
      document.dispatchEvent(new CustomEvent('p2p-error', {
        detail: { message: `Could not connect to room ${code}. Please check the code and ensure host is online.` }
      }));
    });
  }

  setupConnection(conn) {
    this.conn = conn;
    this.isHandshakeComplete = false;
    clearTimeout(this.handshakeTimeout);

    conn.on('open', () => {
      console.log(`[PeerSync] WebRTC DataChannel transport connected. Initiating version handshake (local v${this.appVersion})...`);

      // Exchange app versions before marking connection established
      this.send('VERSION_HANDSHAKE', { version: this.appVersion });

      // Strict handshake timeout: If handshake is not completed within 3.5s, reject as older/incompatible client
      this.handshakeTimeout = setTimeout(() => {
        if (!this.isHandshakeComplete) {
          console.warn('[PeerSync] Handshake timed out without version agreement. Rejecting older client.');
          this.disconnect();
          this.onVersionMismatch({
            localVersion: this.appVersion,
            remoteVersion: 'Older client'
          });
        }
      }, 3500);
    });

    conn.on('data', (data) => {
      this.handleIncomingData(data);
    });

    conn.on('close', () => {
      clearTimeout(this.handshakeTimeout);
      this.isHandshakeComplete = false;
      this.isConnected = false;
      this.conn = null;
      try {
        this.onDisconnected();
      } catch (err) {
        console.warn('onDisconnected handler error:', err);
      }
      console.log('Partner disconnected');
    });

    conn.on('error', (err) => {
      console.warn('Connection data error:', err);
      clearTimeout(this.handshakeTimeout);
      this.isHandshakeComplete = false;
      this.isConnected = false;
      this.conn = null;
      try {
        this.onDisconnected();
      } catch (e) {}
    });
  }

  send(type, payload) {
    try {
      if (this.conn && this.conn.open) {
        this.conn.send({ type, payload });
      }
    } catch (e) {
      console.warn('P2P send suppressed (connection closing or closed):', e);
    }
  }

  handleIncomingData(message) {
    if (!message || !message.type) return;

    // Strict Version Handshake Gate:
    if (!this.isHandshakeComplete) {
      if (message.type === 'VERSION_HANDSHAKE') {
        clearTimeout(this.handshakeTimeout);
        const remoteVersion = message.payload?.version;

        if (!remoteVersion || remoteVersion !== this.appVersion) {
          console.warn(`[PeerSync] VERSION MISMATCH REJECTED: local v${this.appVersion} vs remote v${remoteVersion}`);
          this.send('VERSION_REJECTED', { localVersion: this.appVersion, remoteVersion: remoteVersion || 'Older client' });
          this.disconnect();
          this.onVersionMismatch({
            localVersion: this.appVersion,
            remoteVersion: remoteVersion || 'Older client'
          });
          return;
        }

        // Versions match! Handshake complete
        this.isHandshakeComplete = true;
        this.isConnected = true;
        console.log(`[PeerSync] Version verified (both on v${this.appVersion})! Session established.`);

        // Officially notify application
        this.onConnected(this.roomCode, this.isHost);

        // If host, transmit full pet data now
        if (this.isHost) {
          document.dispatchEvent(new CustomEvent('p2p-request-full-sync'));
        }
        return;
      } else if (message.type === 'VERSION_REJECTED') {
        clearTimeout(this.handshakeTimeout);
        const { localVersion, remoteVersion } = message.payload || {};
        this.disconnect();
        this.onVersionMismatch({
          localVersion: this.appVersion,
          remoteVersion: localVersion || remoteVersion || 'Older client'
        });
        return;
      } else {
        // Any other message received BEFORE VERSION_HANDSHAKE means the remote client is an OLD client
        // that does not implement version handshaking!
        console.warn(`[PeerSync] Legacy client detected (sent ${message.type} without handshake). Rejecting connection.`);
        clearTimeout(this.handshakeTimeout);
        this.send('VERSION_REJECTED', { localVersion: this.appVersion, remoteVersion: 'Older client' });
        this.disconnect();
        this.onVersionMismatch({
          localVersion: this.appVersion,
          remoteVersion: 'Older client'
        });
        return;
      }
    }

    // Normal message handling (only runs when version is verified):
    switch (message.type) {
      case 'PARTNER_LEAVE': {
        this.isConnected = false;
        this.conn = null;
        try {
          this.onDisconnected();
        } catch (e) {}
        break;
      }
      case 'VERSION_HANDSHAKE': {
        const remoteVersion = message.payload?.version;
        if (remoteVersion && remoteVersion !== this.appVersion) {
          console.warn(`P2P Version Mismatch: local v${this.appVersion} vs remote v${remoteVersion}`);
          this.send('VERSION_REJECTED', { localVersion: this.appVersion, remoteVersion });
          this.disconnect();
          this.onVersionMismatch({ localVersion: this.appVersion, remoteVersion });
        }
        break;
      }
      case 'VERSION_REJECTED': {
        const { localVersion, remoteVersion } = message.payload || {};
        this.disconnect();
        this.onVersionMismatch({ localVersion: this.appVersion, remoteVersion: localVersion || remoteVersion || 'Older client' });
        break;
      }
      case 'FULL_PET_SYNC':
        this.onFullPetSync(message.payload);
        break;
      case 'DRAW_STROKE':
        this.onRemoteStroke(message.payload);
        break;
      case 'FRAME_ADD':
        this.onRemoteFrameAdd(message.payload);
        break;
      case 'FRAME_DUPLICATE':
        this.onRemoteFrameDuplicate(message.payload);
        break;
      case 'FRAME_DELETE':
        this.onRemoteFrameDelete(message.payload);
        break;
      case 'CURSOR_MOVE':
        this.onRemoteCursor(message.payload);
        break;
      case 'CARE_ACTION':
        this.onRemoteCareAction(message.payload);
        break;
      case 'PET_MESSAGE':
        this.onRemotePetMessage(message.payload);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  setAppVersion(version) {
    this.appVersion = version;
  }

  broadcastStroke(strokeData) {
    this.send('DRAW_STROKE', strokeData);
  }

  broadcastCursor(x, y, tool, clip = 'idle', frameIndex = 0) {
    this.send('CURSOR_MOVE', { x, y, tool, clip, frameIndex });
  }

  broadcastFrameAdd(clip, newIndex) {
    this.send('FRAME_ADD', { clip, newIndex });
  }

  broadcastFrameDuplicate(clip, index) {
    this.send('FRAME_DUPLICATE', { clip, index });
  }

  broadcastFrameDelete(clip, index) {
    this.send('FRAME_DELETE', { clip, index });
  }

  broadcastCareAction(action, data = {}) {
    this.send('CARE_ACTION', { action, ...data });
  }

  broadcastPetMessage(text, meta = {}) {
    this.send('PET_MESSAGE', { text, timestamp: Date.now(), ...meta });
  }

  broadcastFullPet(petJSON) {
    this.send('FULL_PET_SYNC', petJSON);
  }

  disconnect() {
    clearTimeout(this.handshakeTimeout);
    this.isHandshakeComplete = false;
    this.isConnected = false;
    if (this.conn) {
      try {
        this.send('PARTNER_LEAVE', {});
        this.conn.close();
      } catch (e) {}
      this.conn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {}
      this.peer = null;
    }
    try {
      this.onDisconnected();
    } catch (e) {}
  }
}
