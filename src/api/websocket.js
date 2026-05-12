/**
 * Minimal WebSocket client for Hyperliquid (zero dependencies)
 * Implements RFC 6455 basics: handshake, text frames, ping/pong, close.
 * Only a subset sufficient to stream l2Book / trades / allMids.
 */

const crypto = require('crypto');
const https = require('https');
const { EventEmitter } = require('events');

const WS_URL = 'wss://api.hyperliquid.xyz/ws';
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class HyperliquidWS extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.connected = false;
    this.reconnectDelay = 1000;
    this.subscriptions = [];
    this.buffer = Buffer.alloc(0);
    this.closing = false;
  }

  connect() {
    this.closing = false;
    const key = crypto.randomBytes(16).toString('base64');
    const url = new URL(WS_URL);

    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'GET',
      headers: {
        'Connection': 'Upgrade',
        'Upgrade': 'websocket',
        'Sec-WebSocket-Key': key,
        'Sec-WebSocket-Version': '13',
      },
    });

    req.on('upgrade', (res, socket) => {
      const accept = crypto
        .createHash('sha1')
        .update(key + WS_GUID)
        .digest('base64');
      if (res.headers['sec-websocket-accept'] !== accept) {
        socket.destroy();
        this.emit('error', new Error('WebSocket handshake failed'));
        this._scheduleReconnect();
        return;
      }

      this.socket = socket;
      this.connected = true;
      this.reconnectDelay = 1000;
      this.emit('open');

      // Re-subscribe after reconnect
      this.subscriptions.forEach((sub) => this._sendJson({ method: 'subscribe', subscription: sub }));

      socket.on('data', (chunk) => this._onData(chunk));
      socket.on('close', () => {
        this.connected = false;
        this.emit('close');
        if (!this.closing) this._scheduleReconnect();
      });
      socket.on('error', (err) => {
        this.emit('error', err);
      });
    });

    req.on('error', (err) => {
      this.emit('error', err);
      this._scheduleReconnect();
    });

    req.end();
  }

  _scheduleReconnect() {
    if (this.closing) return;
    setTimeout(() => this.connect(), this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      const fin = (first & 0x80) !== 0;
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      let len = second & 0x7f;
      let offset = 2;

      if (len === 126) {
        if (this.buffer.length < offset + 2) return;
        len = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (len === 127) {
        if (this.buffer.length < offset + 8) return;
        // Safe for our use case: lengths well below 2^32
        len = Number(this.buffer.readBigUInt64BE(offset));
        offset += 8;
      }

      if (masked) offset += 4; // server should not mask, but handle gracefully
      if (this.buffer.length < offset + len) return;

      const payload = this.buffer.slice(offset, offset + len);
      this.buffer = this.buffer.slice(offset + len);

      if (opcode === 0x1) { // text frame
        try {
          const msg = JSON.parse(payload.toString('utf8'));
          this.emit('message', msg);
        } catch (_) {}
      } else if (opcode === 0x9) { // ping
        this._sendFrame(0xA, payload);
      } else if (opcode === 0x8) { // close
        this.socket.end();
      }
    }
  }

  _sendFrame(opcode, payload) {
    if (!this.socket || !this.connected) return;
    const mask = crypto.randomBytes(4);
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[1] = 0x80 | len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[1] = 0x80 | 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    header[0] = 0x80 | opcode;

    const masked = Buffer.alloc(len);
    for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];

    this.socket.write(Buffer.concat([header, mask, masked]));
  }

  _sendJson(obj) {
    this._sendFrame(0x1, Buffer.from(JSON.stringify(obj), 'utf8'));
  }

  subscribe(sub) {
    this.subscriptions.push(sub);
    if (this.connected) this._sendJson({ method: 'subscribe', subscription: sub });
  }

  unsubscribeAll() {
    if (this.connected) {
      this.subscriptions.forEach((sub) =>
        this._sendJson({ method: 'unsubscribe', subscription: sub })
      );
    }
    this.subscriptions = [];
  }

  close() {
    this.closing = true;
    if (this.socket) {
      this._sendFrame(0x8, Buffer.alloc(0));
      this.socket.end();
    }
  }
}

module.exports = HyperliquidWS;
