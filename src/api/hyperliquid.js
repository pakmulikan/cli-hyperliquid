/**
 * Hyperliquid API Client - free public endpoints, zero npm dependencies
 * REST: https://api.hyperliquid.xyz/info
 * WS:   wss://api.hyperliquid.xyz/ws (implemented in src/api/websocket.js)
 */

const https = require('https');

const BASE_URL = 'https://api.hyperliquid.xyz';

class HyperliquidAPI {
  constructor(opts = {}) {
    this.timeout = opts.timeout || 10000;
    this.retries = opts.retries || 2;
    this.lastLatencyMs = 0;
  }

  async post(body) {
    let lastErr;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const start = Date.now();
        const result = await this._postOnce(body);
        this.lastLatencyMs = Date.now() - start;
        return result;
      } catch (err) {
        lastErr = err;
        if (attempt < this.retries) {
          await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
        }
      }
    }
    throw lastErr;
  }

  _postOnce(body) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const url = new URL(`${BASE_URL}/info`);

      const req = https.request({
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'hyperliquid-cli/1.0',
        },
        timeout: this.timeout,
      }, (res) => {
        let chunks = '';
        res.on('data', (c) => chunks += c);
        res.on('end', () => {
          if (res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode}: ${chunks.slice(0, 120)}`));
          }
          try {
            resolve(JSON.parse(chunks));
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout after ${this.timeout}ms`));
      });

      req.write(data);
      req.end();
    });
  }

  getMeta() { return this.post({ type: 'meta' }); }
  getAllMids() { return this.post({ type: 'allMids' }); }

  getL2Book(coin, nSigFigs) {
    const body = { type: 'l2Book', coin };
    if (nSigFigs) body.nSigFigs = nSigFigs;
    return this.post(body);
  }

  getRecentTrades(coin) {
    // Endpoint name changed in API history - support both
    return this.post({ type: 'recentTrades', coin }).catch(() =>
      this.post({ type: 'trades', coin })
    );
  }

  getFundingHistory(coin, startTime, endTime) {
    const now = Date.now();
    return this.post({
      type: 'fundingHistory',
      coin,
      startTime: startTime || now - 24 * 60 * 60 * 1000,
      endTime: endTime || now,
    });
  }

  getUserState(address) {
    return this.post({ type: 'clearinghouseState', user: address });
  }

  getUserOpenOrders(address) {
    return this.post({ type: 'openOrders', user: address });
  }

  getUserFills(address) {
    return this.post({ type: 'userFills', user: address });
  }

  getCandles(coin, interval = '1h', startTime, endTime) {
    const now = Date.now();
    const intervalMs = {
      '1m': 60_000, '5m': 300_000, '15m': 900_000,
      '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
    }[interval] || 3_600_000;
    return this.post({
      type: 'candleSnapshot',
      req: {
        coin,
        interval,
        startTime: startTime || now - 60 * intervalMs,
        endTime: endTime || now,
      },
    });
  }

  getMetaAndAssetCtxs() { return this.post({ type: 'metaAndAssetCtxs' }); }
  getSpotMetaAndAssetCtxs() { return this.post({ type: 'spotMetaAndAssetCtxs' }); }
}

module.exports = HyperliquidAPI;
