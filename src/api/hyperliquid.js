/**
 * Hyperliquid API Client - uses only free public endpoints
 * API Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
 */

const https = require('https');

const BASE_URL = 'https://api.hyperliquid.xyz';

class HyperliquidAPI {
  constructor() {
    this.cache = {};
    this.cacheExpiry = {};
  }

  /**
   * Make a POST request to the Hyperliquid info endpoint
   */
  async post(body) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const url = new URL(`${BASE_URL}/info`);

      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 10000
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Failed to parse response: ${body.slice(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * Get all trading metadata (asset names, sizes, etc.)
   */
  async getMeta() {
    return this.post({ type: 'meta' });
  }

  /**
   * Get all mid prices and market info
   */
  async getAllMids() {
    return this.post({ type: 'allMids' });
  }

  /**
   * Get L2 orderbook for a coin
   */
  async getL2Book(coin, nSigFigs = 5) {
    return this.post({
      type: 'l2Book',
      coin: coin,
      nSigFigs: nSigFigs
    });
  }

  /**
   * Get recent trades for a coin
   */
  async getRecentTrades(coin, limit = 20) {
    return this.post({
      type: 'recentTrades',
      coin: coin,
      limit: limit
    });
  }

  /**
   * Get funding rate history
   */
  async getFundingHistory(coin, startTime, endTime) {
    const now = Date.now();
    return this.post({
      type: 'fundingHistory',
      coin: coin,
      startTime: startTime || now - 24 * 60 * 60 * 1000,
      endTime: endTime || now
    });
  }

  /**
   * Get user state (positions, margin, etc.)
   */
  async getUserState(address) {
    return this.post({
      type: 'clearinghouseState',
      user: address
    });
  }

  /**
   * Get user open orders
   */
  async getUserOpenOrders(address) {
    return this.post({
      type: 'openOrders',
      user: address
    });
  }

  /**
   * Get candle data for a coin
   */
  async getCandles(coin, interval = '1h', startTime, endTime) {
    const now = Date.now();
    return this.post({
      type: 'candleSnapshot',
      req: {
        coin: coin,
        interval: interval,
        startTime: startTime || now - 24 * 60 * 60 * 1000,
        endTime: endTime || now
      }
    });
  }

  /**
   * Get perpetuals market summary (open interest, funding, volume)
   */
  async getMetaAndAssetCtxs() {
    return this.post({ type: 'metaAndAssetCtxs' });
  }

  /**
   * Get spot market metadata and context
   */
  async getSpotMetaAndAssetCtxs() {
    return this.post({ type: 'spotMetaAndAssetCtxs' });
  }
}

module.exports = HyperliquidAPI;
