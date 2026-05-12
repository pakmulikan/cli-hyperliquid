/**
 * UI Components - all render into a FrameBuffer (no direct stdout writes)
 * Fixes: no double title, color chaining works, no overflow, proper clipping
 */

const c = require('../lib/colors');
const t = require('../lib/terminal');

/**
 * Panel: rounded box + colored title inside the top border
 * x,y = top-left; width,height = total size (including borders)
 */
function panel(fb, x, y, width, height, title, opts = {}) {
  t.box(fb, x, y, width, height, opts.style || 'rounded');
  if (title) {
    const t1 = ` ${c.header(title)} `;
    const maxTitleLen = Math.max(0, width - 4);
    const plain = c.strip(t1);
    const rendered = plain.length > maxTitleLen ? ` ${title.slice(0, maxTitleLen - 2)} ` : t1;
    fb.at(x + 2, y, rendered);
  }
  if (opts.focused) {
    // Focus indicator: small marker at top-right
    fb.at(x + width - 4, y, c.gold('◆'));
  }
}

/**
 * Orderbook with depth bars + imbalance meter
 */
function orderbook(fb, x, y, width, height, data, opts = {}) {
  const innerX = x + 2;
  const innerW = width - 4;
  const availableRows = height - 4;           // room above spread + imbalance
  const halfH = Math.max(1, Math.floor((availableRows - 2) / 2));

  // Column widths
  const priceW = Math.max(10, Math.floor(innerW * 0.38));
  const sizeW = Math.max(9, Math.floor(innerW * 0.30));
  const totalW = Math.max(8, innerW - priceW - sizeW);

  // Header
  fb.at(innerX, y + 1, c.gray(
    t.padEnd('Price', priceW) +
    t.padEnd('Size', sizeW) +
    t.padEnd('Total', totalW)
  ));

  if (!data || !data.levels || data.levels.length !== 2) {
    fb.at(innerX, y + 2, c.dim('  Loading orderbook...'));
    return;
  }

  const [bids, asks] = data.levels;
  if (!bids || !asks || bids.length === 0 || asks.length === 0) {
    fb.at(innerX, y + 2, c.dim('  No orderbook data'));
    return;
  }

  // Take only what fits
  const visibleAsks = asks.slice(0, halfH);
  const visibleBids = bids.slice(0, halfH);

  // Compute cumulative totals
  let askCum = 0;
  const askRows = visibleAsks.map(a => ({ px: +a.px, sz: +a.sz, cum: askCum += +a.sz }));
  let bidCum = 0;
  const bidRows = visibleBids.map(b => ({ px: +b.px, sz: +b.sz, cum: bidCum += +b.sz }));

  const maxCum = Math.max(askCum, bidCum, 1);

  // Render asks (top, reversed so worst price at top)
  // Depth bar is rendered on the RIGHT side (after the text) so it doesn't overwrite
  askRows.slice().reverse().forEach((a, i) => {
    const textLine =
      c.loss(t.padEnd(t.formatPrice(a.px), priceW)) +
      c.neutral(t.padEnd(a.sz.toFixed(4), sizeW)) +
      c.gray(t.padEnd(a.cum.toFixed(2), totalW));
    const textLen = t.visLen(textLine);
    const barSpace = Math.max(0, innerW - textLen);
    const depthW = Math.max(0, Math.min(barSpace, Math.round((a.cum / maxCum) * barSpace)));
    const bar = c.bgRgb(60, 20, 25)(' '.repeat(depthW));
    fb.at(innerX, y + 2 + i, textLine + bar);
  });

  // Spread line
  const bestBid = bidRows[0].px;
  const bestAsk = askRows[0].px;
  const spread = bestAsk - bestBid;
  const spreadPct = (spread / bestAsk) * 100;
  const mid = (bestBid + bestAsk) / 2;
  const spreadLine = y + 2 + halfH;
  fb.at(innerX, spreadLine, c.gold(
    `◆ Mid: ${t.formatPrice(mid)} ` +
    c.dim(`spread ${spread.toFixed(2)} (${spreadPct.toFixed(3)}%)`)
  ));

  // Render bids (bottom)
  bidRows.forEach((b, i) => {
    const textLine =
      c.profit(t.padEnd(t.formatPrice(b.px), priceW)) +
      c.neutral(t.padEnd(b.sz.toFixed(4), sizeW)) +
      c.gray(t.padEnd(b.cum.toFixed(2), totalW));
    const textLen = t.visLen(textLine);
    const barSpace = Math.max(0, innerW - textLen);
    const depthW = Math.max(0, Math.min(barSpace, Math.round((b.cum / maxCum) * barSpace)));
    const bar = c.bgRgb(15, 55, 35)(' '.repeat(depthW));
    fb.at(innerX, spreadLine + 1 + i, textLine + bar);
  });

  // Imbalance meter at the bottom
  const imbalanceY = y + height - 2;
  const m = t.meter(bidCum, askCum, innerW - 18);
  const leftPct = (m.leftPct * 100).toFixed(1);
  const rightPct = (100 - m.leftPct * 100).toFixed(1);
  fb.at(innerX, imbalanceY,
    c.gray('Imbalance ') +
    c.profit(`${leftPct}% `) +
    c.profit(m.left) +
    c.loss(m.right) +
    c.loss(` ${rightPct}%`)
  );
}

/**
 * Price ticker with 24h change + sparklines
 * metaAndCtx used for prevDayPx (true 24h change)
 */
function ticker(fb, x, y, width, height, mids, priceHistory, metaAndCtx, opts = {}) {
  const innerX = x + 2;
  const innerW = width - 4;
  const maxRows = Math.max(0, height - 3);

  const coinW = 7;
  const priceW = 14;
  const changeW = 10;
  const volW = 10;
  const sparkW = Math.max(5, innerW - coinW - priceW - changeW - volW);

  fb.at(innerX, y + 1, c.gray(
    t.padEnd('Coin', coinW) +
    t.padEnd('Price', priceW) +
    t.padEnd('24h Δ', changeW) +
    t.padEnd('Vol', volW) +
    'Chart'
  ));

  if (!mids) {
    fb.at(innerX, y + 2, c.dim('  Loading markets...'));
    return;
  }

  // Build a lookup for 24h baseline + volume
  const ctxByCoin = {};
  if (metaAndCtx && metaAndCtx[0] && metaAndCtx[1]) {
    const names = (metaAndCtx[0].universe || []).map(u => u.name);
    metaAndCtx[1].forEach((ctx, i) => {
      if (names[i]) ctxByCoin[names[i]] = ctx;
    });
  }

  // Sort by configured criterion
  let coins = Object.keys(mids);
  const sort = opts.sort || 'default';
  if (sort === 'price') {
    coins.sort((a, b) => +mids[b] - +mids[a]);
  } else if (sort === 'change') {
    coins.sort((a, b) => {
      const ca = ctxByCoin[a], cb = ctxByCoin[b];
      const chgA = ca ? (+mids[a] - +ca.prevDayPx) / +ca.prevDayPx : 0;
      const chgB = cb ? (+mids[b] - +cb.prevDayPx) / +cb.prevDayPx : 0;
      return chgB - chgA;
    });
  } else if (sort === 'volume') {
    coins.sort((a, b) => (+((ctxByCoin[b] || {}).dayNtlVlm || 0)) - (+((ctxByCoin[a] || {}).dayNtlVlm || 0)));
  } else {
    // Default priority: popular coins first
    const priority = ['BTC', 'ETH', 'SOL', 'ARB', 'DOGE', 'AVAX', 'MATIC', 'LINK', 'UNI', 'OP'];
    coins.sort((a, b) => {
      const ia = priority.indexOf(a); const ib = priority.indexOf(b);
      if (ia < 0 && ib < 0) return a.localeCompare(b);
      if (ia < 0) return 1;
      if (ib < 0) return -1;
      return ia - ib;
    });
  }

  if (opts.filter) {
    const f = opts.filter.toUpperCase();
    coins = coins.filter(c => c.includes(f));
  }

  coins.slice(0, maxRows).forEach((coin, i) => {
    const price = parseFloat(mids[coin]);
    if (!isFinite(price)) return;

    const ctx = ctxByCoin[coin];
    const prevDay = ctx ? parseFloat(ctx.prevDayPx) : price;
    const changePct = prevDay > 0 ? ((price - prevDay) / prevDay) * 100 : 0;
    const vol = ctx ? parseFloat(ctx.dayNtlVlm) : 0;

    const selected = coin === opts.selected;
    const coinStr = selected
      ? c.gold(t.padEnd('▶ ' + coin, coinW))
      : c.bold(t.padEnd(coin, coinW));
    const priceStr = t.padEnd(`$${t.formatPrice(price)}`, priceW);
    const changeFmt = `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`;
    const changeStr = changePct >= 0
      ? c.profit(t.padEnd(changeFmt, changeW))
      : c.loss(t.padEnd(changeFmt, changeW));
    const volStr = c.dim(t.padEnd(`$${t.formatCompact(vol)}`, volW));

    const history = priceHistory[coin] || [];
    const spark = history.length >= 2 ? t.sparkline(history, sparkW) : '';
    const sparkColored = changePct >= 0 ? c.profit(spark) : c.loss(spark);

    fb.at(innerX, y + 2 + i, `${coinStr}${priceStr}${changeStr}${volStr}${sparkColored}`);
  });
}

/**
 * Funding rates table
 */
function fundingRates(fb, x, y, width, height, metaAndCtx) {
  const innerX = x + 2;
  const maxRows = Math.max(0, height - 3);

  fb.at(innerX, y + 1, c.gray(
    t.padEnd('Asset', 8) +
    t.padEnd('Fund/h', 11) +
    t.padEnd('OI', 10) +
    t.padEnd('24h Vol', 10) +
    'Ann. APR'
  ));

  if (!metaAndCtx || !metaAndCtx[0] || !metaAndCtx[1]) {
    fb.at(innerX, y + 2, c.dim('  Loading funding...'));
    return;
  }

  const [meta, ctxs] = metaAndCtx;
  const assets = meta.universe || [];

  const rows = ctxs
    .map((ctx, i) => ({ name: (assets[i] || {}).name || '?', ctx }))
    .filter(r => r.ctx && r.name !== '?')
    .sort((a, b) => Math.abs(parseFloat(b.ctx.funding || 0)) - Math.abs(parseFloat(a.ctx.funding || 0)))
    .slice(0, maxRows);

  rows.forEach(({ name, ctx }, i) => {
    const funding = parseFloat(ctx.funding || 0);
    const oi = parseFloat(ctx.openInterest || 0);
    const vol = parseFloat(ctx.dayNtlVlm || 0);
    const apr = funding * 24 * 365 * 100;

    const fundFmt = `${funding >= 0 ? '+' : ''}${(funding * 100).toFixed(4)}%`;
    const fundStr = funding >= 0
      ? c.profit(t.padEnd(fundFmt, 11))
      : c.loss(t.padEnd(fundFmt, 11));
    const aprFmt = `${apr >= 0 ? '+' : ''}${apr.toFixed(1)}%`;
    const aprStr = apr >= 0 ? c.profit(aprFmt) : c.loss(aprFmt);

    fb.at(innerX, y + 2 + i,
      c.bold(t.padEnd(name, 8)) +
      fundStr +
      c.dim(t.padEnd(`$${t.formatCompact(oi)}`, 10)) +
      c.dim(t.padEnd(`$${t.formatCompact(vol)}`, 10)) +
      aprStr
    );
  });
}

/**
 * Trades - highlights whales
 */
function trades(fb, x, y, width, height, trades, coin, whaleThreshold = 100000) {
  const innerX = x + 2;
  const innerW = width - 4;
  const maxRows = Math.max(0, height - 3);

  fb.at(innerX, y + 1, c.gray(
    t.padEnd('Time', 10) +
    t.padEnd('Side', 6) +
    t.padEnd('Price', 13) +
    t.padEnd('Size', 11) +
    'USD Value'
  ));

  if (!trades || trades.length === 0) {
    fb.at(innerX, y + 2, c.dim('  No trades yet...'));
    return;
  }

  trades.slice(0, maxRows).forEach((trade, i) => {
    const time = new Date(trade.time).toLocaleTimeString('en-US', { hour12: false });
    const price = parseFloat(trade.px);
    const size = parseFloat(trade.sz);
    const notional = price * size;
    const isBuy = trade.side === 'B';
    const isWhale = notional >= whaleThreshold;

    const timeStr = c.gray(t.padEnd(time, 10));
    const sideStr = isBuy ? c.profit(t.padEnd('BUY', 6)) : c.loss(t.padEnd('SELL', 6));
    const priceFmt = t.padEnd(`$${t.formatPrice(price)}`, 13);
    const priceStr = isBuy ? c.profit(priceFmt) : c.loss(priceFmt);
    const sizeStr = c.neutral(t.padEnd(size.toFixed(4), 11));
    const whaleMark = isWhale ? c.purple(' 🐋') : '';
    const valStr = isWhale
      ? c.purple(`$${t.formatCompact(notional)}${whaleMark}`)
      : c.dim(`$${t.formatCompact(notional)}`);

    fb.at(innerX, y + 2 + i, `${timeStr}${sideStr}${priceStr}${sizeStr}${valStr}`);
  });
}

/**
 * Portfolio with positions
 */
function portfolio(fb, x, y, width, height, userState, mids) {
  const innerX = x + 2;

  if (!userState || !userState.marginSummary) {
    fb.at(innerX, y + 1, c.dim('  No account data. Set --address to view.'));
    return;
  }

  const ms = userState.marginSummary;
  const accValue = parseFloat(ms.accountValue || 0);
  const totalPos = parseFloat(ms.totalNtlPos || 0);
  const freeMargin = parseFloat(ms.totalRawUsd || 0);
  const usedMargin = parseFloat(ms.totalMarginUsed || 0);
  const denom = usedMargin + freeMargin;
  const marginPct = denom > 0 ? (usedMargin / denom) * 100 : 0;

  fb.at(innerX, y + 1, c.gray('Account:  ') + c.gold(c.bold(`$${accValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)));
  fb.at(innerX, y + 2, c.gray('Exposure: ') + c.accent(`$${totalPos.toLocaleString('en-US', { minimumFractionDigits: 2 })}`));
  fb.at(innerX, y + 3, c.gray('Free:     ') + c.dim(`$${freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}`));

  const barColor = marginPct > 80 ? c.danger : marginPct > 50 ? c.warn : c.profit;
  fb.at(innerX, y + 4,
    c.gray('Margin:   ') +
    barColor(t.progressBar(marginPct, 100, 15)) +
    ` ${marginPct.toFixed(1)}%`
  );

  if (!userState.assetPositions || userState.assetPositions.length === 0) {
    fb.at(innerX, y + 6, c.dim('  No open positions.'));
    return;
  }

  fb.at(innerX, y + 6, c.header('Open Positions'));
  fb.at(innerX, y + 7, c.gray(
    t.padEnd('Coin', 6) +
    t.padEnd('Side', 7) +
    t.padEnd('Size', 10) +
    t.padEnd('Entry', 11) +
    t.padEnd('Mark', 11) +
    t.padEnd('PnL', 14) +
    'ROE'
  ));

  const maxPosRows = Math.max(0, height - 10);
  userState.assetPositions.slice(0, maxPosRows).forEach((ap, i) => {
    const p = ap.position;
    const size = parseFloat(p.szi);
    const pnl = parseFloat(p.unrealizedPnl);
    const roe = parseFloat(p.returnOnEquity) * 100;
    const markPx = mids && mids[p.coin] ? parseFloat(mids[p.coin]) : parseFloat(p.entryPx);

    const coinStr = c.bold(t.padEnd(p.coin, 6));
    const sideStr = size > 0 ? c.profit(t.padEnd('LONG', 7)) : c.loss(t.padEnd('SHORT', 7));
    const sizeStr = c.neutral(t.padEnd(Math.abs(size).toFixed(4), 10));
    const entryStr = c.dim(t.padEnd(`$${t.formatPrice(+p.entryPx)}`, 11));
    const markStr = c.dim(t.padEnd(`$${t.formatPrice(markPx)}`, 11));
    const pnlFmt = `${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}`;
    const pnlStr = pnl >= 0 ? c.profit(t.padEnd(pnlFmt, 14)) : c.loss(t.padEnd(pnlFmt, 14));
    const roeStr = roe >= 0 ? c.profit(`+${roe.toFixed(2)}%`) : c.loss(`${roe.toFixed(2)}%`);

    fb.at(innerX, y + 8 + i, `${coinStr}${sideStr}${sizeStr}${entryStr}${markStr}${pnlStr}${roeStr}`);
  });
}

/**
 * Proper candlestick chart with wicks + stats header
 */
function candleChart(fb, x, y, width, height, candles, coin, interval) {
  const innerX = x + 2;
  const innerW = width - 4;
  const innerH = Math.max(3, height - 4);

  // Header stats
  if (candles && candles.length > 0) {
    const first = candles[0];
    const last = candles[candles.length - 1];
    const highs = candles.map(k => +k.h);
    const lows = candles.map(k => +k.l);
    const high = Math.max(...highs);
    const low = Math.min(...lows);
    const open = +first.o;
    const close = +last.c;
    const vol = candles.reduce((s, k) => s + parseFloat(k.v || 0), 0);
    const changePct = ((close - open) / open) * 100;
    const changeStr = changePct >= 0
      ? c.profit(`${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`)
      : c.loss(`${changePct.toFixed(2)}%`);

    fb.at(innerX, y + 1, c.gray(
      `${coin} ${interval}  ` +
      `O:${c.neutral(t.formatPrice(open))}  ` +
      `H:${c.profit(t.formatPrice(high))}  ` +
      `L:${c.loss(t.formatPrice(low))}  ` +
      `C:${c.gold(t.formatPrice(close))}  `
    ) + changeStr + c.dim(`  V:${t.formatCompact(vol)}`));
  } else {
    fb.at(innerX, y + 1, c.dim('  Loading candles...'));
    return;
  }

  const labelW = 8;
  const chartX = innerX + labelW + 1;
  const chartW = Math.max(4, innerW - labelW - 1);
  const chartY = y + 2;

  // Fit candles to width (one column per candle)
  const slice = candles.slice(-chartW);
  const highs = slice.map(k => +k.h);
  const lows = slice.map(k => +k.l);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = (max - min) || 1;

  // Y-axis labels (5 evenly spaced)
  for (let i = 0; i < 5; i++) {
    const row = Math.round((i * (innerH - 1)) / 4);
    const val = max - (range * i) / 4;
    fb.at(innerX, chartY + row, c.gray(t.padStart(t.formatPrice(val), labelW)));
  }

  // Build character grid
  const grid = Array.from({ length: innerH }, () => Array(chartW).fill({ ch: ' ', col: null }));

  const yFor = (price) => {
    const r = Math.round(((max - price) / range) * (innerH - 1));
    return Math.max(0, Math.min(innerH - 1, r));
  };

  slice.forEach((k, colIdx) => {
    const o = +k.o, cl = +k.c, h = +k.h, l = +k.l;
    const yO = yFor(o);
    const yC = yFor(cl);
    const yH = yFor(h);
    const yL = yFor(l);
    const isGreen = cl >= o;
    const color = isGreen ? c.profit : c.loss;

    // Wick
    for (let r = yH; r <= yL; r++) grid[r][colIdx] = { ch: '│', col: color };
    // Body
    const bodyTop = Math.min(yO, yC);
    const bodyBottom = Math.max(yO, yC);
    for (let r = bodyTop; r <= bodyBottom; r++) {
      grid[r][colIdx] = { ch: isGreen ? '█' : '█', col: color };
    }
    // Thin body (same open/close)
    if (bodyTop === bodyBottom) grid[bodyTop][colIdx] = { ch: '─', col: color };
  });

  // Render grid - consolidate same-color runs for efficiency and clean output
  for (let r = 0; r < innerH; r++) {
    let line = '';
    let runChars = '';
    let runCol = null;
    const flush = () => {
      if (runChars.length > 0) {
        line += runCol ? runCol(runChars) : runChars;
        runChars = '';
      }
    };
    for (let col = 0; col < chartW; col++) {
      const cell = grid[r][col];
      if (cell.col === runCol) {
        runChars += cell.ch;
      } else {
        flush();
        runCol = cell.col;
        runChars = cell.ch;
      }
    }
    flush();
    fb.at(chartX, chartY + r, line);
  }

  // Current price line marker
  const lastClose = +slice[slice.length - 1].c;
  const priceRow = chartY + yFor(lastClose);
  fb.at(chartX + chartW, priceRow, c.gold(`◄ $${t.formatPrice(lastClose)}`));
}

/**
 * Market heatmap - color grid of all markets
 */
function heatmap(fb, x, y, width, height, mids, metaAndCtx) {
  const innerX = x + 2;
  const innerW = width - 4;
  const innerH = height - 3;

  fb.at(innerX, y + 1, c.header('Market Heatmap (24h change, sized by volume)'));

  if (!mids || !metaAndCtx || !metaAndCtx[0] || !metaAndCtx[1]) {
    fb.at(innerX, y + 3, c.dim('  Loading heatmap...'));
    return;
  }

  const names = metaAndCtx[0].universe.map(u => u.name);
  const ctxs = metaAndCtx[1];
  const tiles = names.map((name, i) => {
    const price = parseFloat(mids[name]);
    const ctx = ctxs[i] || {};
    const prev = parseFloat(ctx.prevDayPx) || price;
    const chg = prev > 0 ? (price - prev) / prev * 100 : 0;
    const vol = parseFloat(ctx.dayNtlVlm) || 0;
    return { name, chg, vol };
  }).filter(t => isFinite(t.chg));

  tiles.sort((a, b) => b.vol - a.vol);

  // Fixed tile size
  const tileW = 14;
  const tileH = 3;
  const cols = Math.max(1, Math.floor(innerW / tileW));
  const rows = Math.max(1, Math.floor(innerH / tileH));
  const visible = tiles.slice(0, cols * rows);

  const colorForChg = (chg) => {
    const clamped = Math.max(-10, Math.min(10, chg)) / 10;
    if (clamped >= 0) {
      const g = Math.round(60 + clamped * 120);
      return c.bgRgb(0, g, 40);
    } else {
      const r = Math.round(60 + Math.abs(clamped) * 120);
      return c.bgRgb(r, 10, 20);
    }
  };

  visible.forEach((tile, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const tx = innerX + col * tileW;
    const ty = y + 3 + row * tileH;
    const bg = colorForChg(tile.chg);

    const line1 = bg(c.bold(c.brightWhite(t.center(tile.name, tileW))));
    const chgFmt = `${tile.chg >= 0 ? '+' : ''}${tile.chg.toFixed(2)}%`;
    const line2 = bg(c.brightWhite(t.center(chgFmt, tileW)));
    const line3 = bg(c.brightWhite(t.center('$' + t.formatCompact(tile.vol), tileW)));

    fb.at(tx, ty, line1);
    fb.at(tx, ty + 1, line2);
    fb.at(tx, ty + 2, line3);
  });
}

/**
 * Status bar with API health + alerts
 */
function statusBar(fb, y, width, info) {
  const {
    selectedCoin, timeframe, refreshInterval, countdown, mode, lastUpdate,
    latency, wsConnected, alertCount, activeView
  } = info;

  const modeTag = mode === 'DEMO'
    ? c.bgYellow(c.black(' DEMO '))
    : wsConnected
      ? c.bgGreen(c.black(' LIVE·WS '))
      : c.bgBlue(c.brightWhite(' LIVE·HTTP '));

  const latencyColor = latency < 200 ? c.profit : latency < 500 ? c.warn : c.loss;
  const latencyStr = latency ? latencyColor(`${latency}ms`) : c.dim('---');

  const updatedStr = lastUpdate
    ? lastUpdate.toLocaleTimeString('en-US', { hour12: false })
    : '--:--:--';

  const alertsStr = alertCount > 0
    ? c.orange(`🔔 ${alertCount}`)
    : c.dim('🔕 0');

  const left = ` ${modeTag} ${c.dim('│')} ${c.bold(selectedCoin)} ${c.dim(timeframe)} ${c.dim('│')} ` +
               `${c.gray('refresh')} ${countdown}s ${c.dim('│')} ` +
               `${c.gray('api')} ${latencyStr} ${c.dim('│')} ` +
               `${c.gray('updated')} ${updatedStr} ${c.dim('│')} ${alertsStr} ${c.dim('│')} ${c.gray('view:')}${c.accent(activeView)}`;

  const right = c.dim('? help · q quit ');

  const leftLen = c.strip(left).length;
  const rightLen = c.strip(right).length;
  const padding = Math.max(1, width - leftLen - rightLen);

  fb.at(0, y, left + ' '.repeat(padding) + right);
}

/**
 * Header bar
 */
function headerBar(fb, width, info) {
  const title = '  ◆  HYPERLIQUID TERMINAL  ';
  const sub = `  v${info.version}`;
  const padLen = Math.max(1, width - c.strip(title).length - c.strip(sub).length);
  const bar = c.bgRgb(15, 25, 45)(
    c.brightWhite(c.bold(title)) +
    ' '.repeat(padLen) +
    c.dim(sub)
  );
  fb.at(0, 0, bar);
}

/**
 * Modal overlay for help / input prompts
 */
function modal(fb, width, height, content) {
  const lines = content.split('\n');
  const boxW = Math.min(width - 4, Math.max(40, Math.max(...lines.map(l => c.strip(l).length)) + 4));
  const boxH = Math.min(height - 4, lines.length + 4);
  const boxX = Math.floor((width - boxW) / 2);
  const boxY = Math.floor((height - boxH) / 2);

  // Darken background by overdrawing (limited without full buffer) - just draw box
  t.clearRect(fb, boxX, boxY, boxW, boxH);
  t.box(fb, boxX, boxY, boxW, boxH, 'double');

  lines.slice(0, boxH - 4).forEach((line, i) => {
    fb.at(boxX + 2, boxY + 2 + i, line);
  });

  fb.at(boxX + 2, boxY + boxH - 2, c.dim('Press any key to dismiss'));
}

/**
 * Inline input prompt bar (bottom overlay)
 */
function promptBar(fb, y, width, label, value) {
  const text = ` ${c.header(label)} ${c.gold(value)}${c.blink('_')}${c.dim('  (enter=submit, esc=cancel)')}`;
  const pad = Math.max(0, width - c.strip(text).length);
  fb.at(0, y, c.bgRgb(40, 40, 80)(c.brightWhite(text + ' '.repeat(pad))));
}

module.exports = {
  panel,
  orderbook,
  ticker,
  fundingRates,
  trades,
  portfolio,
  candleChart,
  heatmap,
  statusBar,
  headerBar,
  modal,
  promptBar,
};
