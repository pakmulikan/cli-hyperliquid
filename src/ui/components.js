/**
 * UI Components - reusable terminal UI building blocks
 */

const c = require('../lib/colors');
const t = require('../lib/terminal');

const components = {
  /**
   * Render a styled box with title
   */
  panel: (x, y, width, height, title, style = 'rounded') => {
    const titleColored = title ? c.header(title) : '';
    t.box(x, y, width, height, title, style);
    // Re-draw title with color
    if (title) {
      const titleStr = ` ${titleColored} `;
      t.writeAt(x + 3, y, titleStr);
    }
  },

  /**
   * Render orderbook
   */
  orderbook: (x, y, width, height, data) => {
    const innerW = width - 4;
    const halfH = Math.floor((height - 3) / 2);

    // Header
    const hdrPrice = t.padEnd('Price', Math.floor(innerW * 0.4));
    const hdrSize = t.padEnd('Size', Math.floor(innerW * 0.35));
    const hdrTotal = 'Total';
    t.writeAt(x + 2, y + 1, c.gray(`${hdrPrice}${hdrSize}${hdrTotal}`));

    if (!data || !data.levels) return;

    const [bids, asks] = data.levels;
    const maxBidTotal = bids.reduce((s, b) => s + parseFloat(b.sz), 0);
    const maxAskTotal = asks.reduce((s, a) => s + parseFloat(a.sz), 0);

    // Asks (top, reversed - highest first)
    let askTotal = 0;
    const visibleAsks = asks.slice(0, halfH).reverse();
    visibleAsks.forEach((ask, i) => {
      askTotal += parseFloat(ask.sz);
      const price = t.padEnd(parseFloat(ask.px).toFixed(2), Math.floor(innerW * 0.4));
      const size = t.padEnd(parseFloat(ask.sz).toFixed(3), Math.floor(innerW * 0.35));
      const total = askTotal.toFixed(2);
      // Depth visualization
      const depthPct = askTotal / maxAskTotal;
      const depthBar = Math.floor(depthPct * (innerW - 1));
      const bgLine = c.rgb(40, 20, 20)(' '.repeat(Math.min(depthBar, innerW)));

      t.writeAt(x + 2, y + 2 + i, c.loss(price) + c.dim(size) + c.gray(total));
    });

    // Spread indicator
    const spreadLine = y + 2 + halfH;
    if (bids.length > 0 && asks.length > 0) {
      const spread = (parseFloat(asks[0].px) - parseFloat(bids[0].px)).toFixed(2);
      const spreadPct = ((parseFloat(asks[0].px) - parseFloat(bids[0].px)) / parseFloat(asks[0].px) * 100).toFixed(3);
      t.writeAt(x + 2, spreadLine, c.yellow(`  Spread: $${spread} (${spreadPct}%)`));
    }

    // Bids (bottom)
    let bidTotal = 0;
    bids.slice(0, halfH).forEach((bid, i) => {
      bidTotal += parseFloat(bid.sz);
      const price = t.padEnd(parseFloat(bid.px).toFixed(2), Math.floor(innerW * 0.4));
      const size = t.padEnd(parseFloat(bid.sz).toFixed(3), Math.floor(innerW * 0.35));
      const total = bidTotal.toFixed(2);

      t.writeAt(x + 2, spreadLine + 1 + i, c.profit(price) + c.dim(size) + c.gray(total));
    });
  },

  /**
   * Render price ticker with sparkline
   */
  ticker: (x, y, width, height, mids, prevMids, priceHistory) => {
    if (!mids) return;

    const innerW = width - 4;
    const coins = Object.keys(mids).slice(0, height - 3);

    // Header
    const hdr = c.gray(
      t.padEnd('Coin', 8) +
      t.padEnd('Price', 14) +
      t.padEnd('Change', 10) +
      'Chart'
    );
    t.writeAt(x + 2, y + 1, hdr);

    coins.forEach((coin, i) => {
      if (i >= height - 3) return;
      const price = parseFloat(mids[coin]);
      const prev = prevMids && prevMids[coin] ? parseFloat(prevMids[coin]) : price;
      const change = ((price - prev) / prev * 100);

      const coinStr = t.padEnd(c.bold(coin), 8);
      const priceStr = t.padEnd(`$${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14);
      const changeStr = change >= 0
        ? c.profit(t.padEnd(`+${change.toFixed(2)}%`, 10))
        : c.loss(t.padEnd(`${change.toFixed(2)}%`, 10));

      // Sparkline
      const history = priceHistory[coin] || [];
      const spark = history.length > 2 ? t.sparkline(history, 12) : '';
      const sparkColored = change >= 0 ? c.profit(spark) : c.loss(spark);

      t.writeAt(x + 2, y + 2 + i, `${coinStr}${priceStr}${changeStr}${sparkColored}`);
    });
  },

  /**
   * Render funding rates table
   */
  fundingRates: (x, y, width, height, metaAndCtx) => {
    if (!metaAndCtx || !metaAndCtx[0] || !metaAndCtx[1]) return;

    const [meta, ctxs] = metaAndCtx;
    const innerW = width - 4;
    const maxRows = height - 3;

    // Header
    t.writeAt(x + 2, y + 1, c.gray(
      t.padEnd('Asset', 7) +
      t.padEnd('Funding/h', 11) +
      t.padEnd('OI ($M)', 10) +
      t.padEnd('24h Vol', 10) +
      '8h APR'
    ));

    const assets = meta.universe || [];
    const sortedIndices = ctxs
      .map((ctx, i) => ({ idx: i, funding: Math.abs(parseFloat(ctx.funding || 0)) }))
      .sort((a, b) => b.funding - a.funding)
      .slice(0, maxRows);

    sortedIndices.forEach(({ idx }, i) => {
      if (i >= maxRows) return;
      const asset = assets[idx];
      const ctx = ctxs[idx];
      if (!asset || !ctx) return;

      const funding = parseFloat(ctx.funding || 0);
      const oi = parseFloat(ctx.openInterest || 0) / 1e6;
      const vol = parseFloat(ctx.dayNtlVlm || 0) / 1e6;
      const apr = (funding * 8 * 365 * 100);

      const name = t.padEnd(asset.name, 7);
      const fundStr = funding >= 0
        ? c.profit(t.padEnd(`+${(funding * 100).toFixed(4)}%`, 11))
        : c.loss(t.padEnd(`${(funding * 100).toFixed(4)}%`, 11));
      const oiStr = t.padEnd(`$${oi.toFixed(1)}M`, 10);
      const volStr = t.padEnd(`$${vol.toFixed(1)}M`, 10);
      const aprStr = apr >= 0
        ? c.profit(`${apr.toFixed(1)}%`)
        : c.loss(`${apr.toFixed(1)}%`);

      t.writeAt(x + 2, y + 2 + i, `${name}${fundStr}${c.dim(oiStr)}${c.dim(volStr)}${aprStr}`);
    });
  },

  /**
   * Render recent trades
   */
  trades: (x, y, width, height, trades, coin) => {
    if (!trades || trades.length === 0) return;

    const innerW = width - 4;
    const maxRows = height - 3;

    // Header
    t.writeAt(x + 2, y + 1, c.gray(
      t.padEnd('Time', 10) +
      t.padEnd('Side', 6) +
      t.padEnd('Price', 14) +
      'Size'
    ));

    trades.slice(0, maxRows).forEach((trade, i) => {
      if (i >= maxRows) return;
      const time = new Date(trade.time).toLocaleTimeString('en-US', { hour12: false });
      const side = trade.side === 'B' ? c.profit('BUY ') : c.loss('SELL');
      const price = trade.side === 'B'
        ? c.profit(t.padEnd(`$${parseFloat(trade.px).toFixed(2)}`, 14))
        : c.loss(t.padEnd(`$${parseFloat(trade.px).toFixed(2)}`, 14));
      const size = c.dim(parseFloat(trade.sz).toFixed(3));

      t.writeAt(x + 2, y + 2 + i, `${c.gray(t.padEnd(time, 10))}${t.padEnd(side, 6)}${price}${size}`);
    });
  },

  /**
   * Render portfolio summary
   */
  portfolio: (x, y, width, height, userState) => {
    if (!userState || !userState.marginSummary) return;

    const ms = userState.marginSummary;
    const innerW = width - 4;

    // Account summary
    const accValue = parseFloat(ms.accountValue || 0);
    const totalPos = parseFloat(ms.totalNtlPos || 0);
    const freeMargin = parseFloat(ms.totalRawUsd || 0);
    const usedMargin = parseFloat(ms.totalMarginUsed || 0);
    const marginUsagePct = usedMargin / (usedMargin + freeMargin) * 100 || 0;

    t.writeAt(x + 2, y + 1, c.gray('Account Value:  ') + c.bold(c.gold(`$${accValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)));
    t.writeAt(x + 2, y + 2, c.gray('Total Position: ') + c.accent(`$${totalPos.toLocaleString('en-US', { minimumFractionDigits: 2 })}`));
    t.writeAt(x + 2, y + 3, c.gray('Free Margin:    ') + c.dim(`$${freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}`));
    t.writeAt(x + 2, y + 4, c.gray('Margin Usage:   ') + t.progressBar(marginUsagePct, 100, 15) + ` ${marginUsagePct.toFixed(1)}%`);

    // Positions
    if (userState.assetPositions && userState.assetPositions.length > 0) {
      t.writeAt(x + 2, y + 6, c.header('Open Positions'));
      t.writeAt(x + 2, y + 7, c.gray(
        t.padEnd('Coin', 6) +
        t.padEnd('Side', 7) +
        t.padEnd('Size', 10) +
        t.padEnd('Entry', 12) +
        t.padEnd('PnL', 14) +
        'ROE'
      ));

      userState.assetPositions.slice(0, height - 10).forEach((ap, i) => {
        const pos = ap.position;
        const size = parseFloat(pos.szi);
        const pnl = parseFloat(pos.unrealizedPnl);
        const roe = parseFloat(pos.returnOnEquity) * 100;
        const isLong = size > 0;

        const coin = t.padEnd(pos.coin, 6);
        const side = isLong ? c.profit(t.padEnd('LONG', 7)) : c.loss(t.padEnd('SHORT', 7));
        const sizeStr = t.padEnd(Math.abs(size).toFixed(3), 10);
        const entry = t.padEnd(`$${parseFloat(pos.entryPx).toFixed(2)}`, 12);
        const pnlStr = pnl >= 0
          ? c.profit(t.padEnd(`+$${pnl.toFixed(2)}`, 14))
          : c.loss(t.padEnd(`-$${Math.abs(pnl).toFixed(2)}`, 14));
        const roeStr = roe >= 0
          ? c.profit(`+${roe.toFixed(2)}%`)
          : c.loss(`${roe.toFixed(2)}%`);

        t.writeAt(x + 2, y + 8 + i, `${coin}${side}${c.dim(sizeStr)}${c.dim(entry)}${pnlStr}${roeStr}`);
      });
    }
  },

  /**
   * Render mini chart using block characters
   */
  miniChart: (x, y, width, height, candles) => {
    if (!candles || candles.length === 0) return;

    const innerW = width - 4;
    const innerH = height - 3;
    const slice = candles.slice(-innerW);

    const closes = slice.map(c => parseFloat(c.c));
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;

    // Y-axis labels
    for (let i = 0; i <= 4; i++) {
      const val = max - (range * i / 4);
      t.writeAt(x + 2, y + 1 + Math.floor(i * innerH / 4), c.gray(val.toFixed(1).padStart(8)));
    }

    // Chart area
    const chartX = x + 12;
    const chartW = innerW - 12;

    slice.slice(-chartW).forEach((candle, i) => {
      const close = parseFloat(candle.c);
      const open = parseFloat(candle.o);
      const normalized = Math.round(((close - min) / range) * (innerH - 1));
      const row = y + 1 + (innerH - 1 - normalized);
      
      const char = close >= open ? '█' : '▓';
      const color = close >= open ? c.profit : c.loss;
      t.writeAt(chartX + i, row, color(char));
    });

    // Price label
    const lastPrice = closes[closes.length - 1];
    const priceNorm = Math.round(((lastPrice - min) / range) * (innerH - 1));
    const priceRow = y + 1 + (innerH - 1 - priceNorm);
    t.writeAt(chartX + Math.min(slice.length, chartW), priceRow, c.gold(` ◄ $${lastPrice.toFixed(2)}`));
  },

  /**
   * Status bar at the bottom
   */
  statusBar: (y, width, info) => {
    const {
      selectedCoin = 'BTC',
      refreshInterval = 5,
      countdown = 5,
      mode = 'LIVE',
      lastUpdate = new Date()
    } = info;

    const bar = c.bgBlue(c.brightWhite(
      ' ' +
      t.padEnd(`${mode}`, 6) +
      '│ ' +
      t.padEnd(`Selected: ${selectedCoin}`, 18) +
      '│ ' +
      t.padEnd(`Refresh: ${countdown}s`, 14) +
      '│ ' +
      t.padEnd(`Updated: ${lastUpdate.toLocaleTimeString('en-US', { hour12: false })}`, 22) +
      '│ ' +
      'q:Quit  Tab:Switch  ↑↓:Scroll  1-5:Panels  r:Refresh' +
      ' '.repeat(Math.max(0, width - 110))
    ));

    t.writeAt(0, y, bar);
  },

  /**
   * Header/title bar
   */
  headerBar: (width, info) => {
    const { version = '1.0.0' } = info;
    const title = '  HYPERLIQUID TERMINAL  ';
    const subtitle = `v${version}`;
    
    const logo = c.bgBlue(c.bold(c.brightWhite(
      ' '.repeat(2) +
      '◆ ' + title +
      ' '.repeat(Math.max(0, width - title.length - subtitle.length - 8)) +
      c.dim(subtitle) +
      ' '.repeat(2)
    )));

    t.writeAt(0, 0, logo);
  }
};

module.exports = components;
