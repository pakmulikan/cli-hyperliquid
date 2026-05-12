/**
 * Demo/mock data for offline mode or when API is unreachable
 */

const DEMO_ASSETS = ['BTC', 'ETH', 'SOL', 'ARB', 'DOGE', 'AVAX', 'MATIC', 'LINK', 'UNI', 'OP'];

function randomPrice(base, variance = 0.02) {
  return base * (1 + (Math.random() - 0.5) * variance);
}

function generateDemoMeta() {
  return {
    universe: DEMO_ASSETS.map((name, i) => ({
      name,
      szDecimals: name === 'BTC' ? 4 : name === 'ETH' ? 3 : 1,
      maxLeverage: 50,
      onlyIsolated: false
    }))
  };
}

function generateDemoMids() {
  const basePrices = {
    BTC: 67432.5, ETH: 3521.8, SOL: 178.45, ARB: 1.23,
    DOGE: 0.1567, AVAX: 38.92, MATIC: 0.87, LINK: 18.34,
    UNI: 12.56, OP: 2.89
  };

  const mids = {};
  for (const [coin, base] of Object.entries(basePrices)) {
    mids[coin] = randomPrice(base).toFixed(coin === 'DOGE' ? 4 : coin === 'BTC' ? 1 : 2);
  }
  return mids;
}

function generateDemoOrderbook(coin) {
  const basePrices = {
    BTC: 67432.5, ETH: 3521.8, SOL: 178.45, ARB: 1.23,
    DOGE: 0.1567, AVAX: 38.92, MATIC: 0.87, LINK: 18.34,
    UNI: 12.56, OP: 2.89
  };

  const mid = basePrices[coin] || 100;
  const spread = mid * 0.0001;
  const levels = [];

  const bids = [];
  const asks = [];

  for (let i = 0; i < 15; i++) {
    const bidPrice = (mid - spread / 2 - i * spread).toFixed(2);
    const askPrice = (mid + spread / 2 + i * spread).toFixed(2);
    const bidSize = (Math.random() * 10 + 0.1).toFixed(3);
    const askSize = (Math.random() * 10 + 0.1).toFixed(3);

    bids.push({ px: bidPrice, sz: bidSize, n: Math.floor(Math.random() * 5) + 1 });
    asks.push({ px: askPrice, sz: askSize, n: Math.floor(Math.random() * 5) + 1 });
  }

  return { levels: [bids, asks] };
}

function generateDemoTrades(coin) {
  const basePrices = {
    BTC: 67432.5, ETH: 3521.8, SOL: 178.45, ARB: 1.23,
    DOGE: 0.1567, AVAX: 38.92, MATIC: 0.87, LINK: 18.34,
    UNI: 12.56, OP: 2.89
  };

  const mid = basePrices[coin] || 100;
  const trades = [];
  const now = Date.now();

  for (let i = 0; i < 20; i++) {
    trades.push({
      coin,
      side: Math.random() > 0.5 ? 'B' : 'A',
      px: randomPrice(mid, 0.001).toFixed(2),
      sz: (Math.random() * 5 + 0.01).toFixed(3),
      time: now - i * 3000,
      hash: `0x${Math.random().toString(16).slice(2, 10)}`
    });
  }

  return trades;
}

function generateDemoMetaAndAssetCtxs() {
  const basePrices = {
    BTC: 67432.5, ETH: 3521.8, SOL: 178.45, ARB: 1.23,
    DOGE: 0.1567, AVAX: 38.92, MATIC: 0.87, LINK: 18.34,
    UNI: 12.56, OP: 2.89
  };

  const meta = generateDemoMeta();
  const assetCtxs = DEMO_ASSETS.map(coin => ({
    funding: ((Math.random() - 0.3) * 0.001).toFixed(6),
    openInterest: (Math.random() * 500000000 + 10000000).toFixed(0),
    prevDayPx: (basePrices[coin] * (1 + (Math.random() - 0.5) * 0.05)).toFixed(2),
    dayNtlVlm: (Math.random() * 1000000000 + 50000000).toFixed(0),
    premium: ((Math.random() - 0.5) * 0.002).toFixed(6),
    oraclePx: basePrices[coin].toFixed(2),
    markPx: randomPrice(basePrices[coin], 0.0005).toFixed(2),
    midPx: basePrices[coin].toFixed(2),
    impactPxs: [
      (basePrices[coin] * 0.999).toFixed(2),
      (basePrices[coin] * 1.001).toFixed(2)
    ]
  }));

  return [meta, assetCtxs];
}

function generateDemoCandles(coin) {
  const basePrices = {
    BTC: 67432.5, ETH: 3521.8, SOL: 178.45, ARB: 1.23,
    DOGE: 0.1567, AVAX: 38.92, MATIC: 0.87, LINK: 18.34,
    UNI: 12.56, OP: 2.89
  };

  const base = basePrices[coin] || 100;
  const candles = [];
  const now = Date.now();
  let price = base * 0.97;

  for (let i = 24; i >= 0; i--) {
    const open = price;
    const close = randomPrice(open, 0.01);
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);
    
    candles.push({
      t: now - i * 3600000,
      T: now - (i - 1) * 3600000,
      s: coin,
      i: '1h',
      o: open.toFixed(2),
      c: close.toFixed(2),
      h: high.toFixed(2),
      l: low.toFixed(2),
      v: (Math.random() * 1000 + 100).toFixed(2),
      n: Math.floor(Math.random() * 500)
    });
    
    price = close;
  }

  return candles;
}

function generateDemoUserState() {
  return {
    marginSummary: {
      accountValue: '125432.56',
      totalNtlPos: '89234.12',
      totalRawUsd: '36198.44',
      totalMarginUsed: '17846.82'
    },
    assetPositions: [
      {
        position: {
          coin: 'BTC',
          szi: '1.5',
          entryPx: '65200.0',
          positionValue: '101148.75',
          unrealizedPnl: '3348.75',
          returnOnEquity: '0.0514',
          leverage: { type: 'cross', value: 5 },
          liquidationPx: '52160.0'
        }
      },
      {
        position: {
          coin: 'ETH',
          szi: '-10.0',
          entryPx: '3600.0',
          positionValue: '-35218.0',
          unrealizedPnl: '782.0',
          returnOnEquity: '0.0217',
          leverage: { type: 'cross', value: 3 },
          liquidationPx: '4320.0'
        }
      },
      {
        position: {
          coin: 'SOL',
          szi: '50.0',
          entryPx: '172.30',
          positionValue: '8922.50',
          unrealizedPnl: '-307.50',
          returnOnEquity: '-0.0344',
          leverage: { type: 'isolated', value: 10 },
          liquidationPx: '155.07'
        }
      }
    ]
  };
}

module.exports = {
  generateDemoMeta,
  generateDemoMids,
  generateDemoOrderbook,
  generateDemoTrades,
  generateDemoMetaAndAssetCtxs,
  generateDemoCandles,
  generateDemoUserState,
  DEMO_ASSETS
};
