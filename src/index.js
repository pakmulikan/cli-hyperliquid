#!/usr/bin/env node

/**
 * Hyperliquid CLI Dashboard
 * Professional terminal dashboard - zero npm dependencies
 */

const HyperliquidAPI = require('./api/hyperliquid');
const HyperliquidWS = require('./api/websocket');
const demo = require('./api/demo-data');
const cfg = require('./lib/config');
const alerts = require('./lib/alerts');
const exporter = require('./lib/exporter');
const c = require('./lib/colors');
const t = require('./lib/terminal');
const ui = require('./ui/components');

const VERSION = '2.0.0';

// ─── Configuration (load from disk, override with CLI) ───────────────────────

const persisted = cfg.load();
const CONFIG = {
  version: VERSION,
  ...persisted,
  selectedPanel: 0,
  coins: ['BTC', 'ETH', 'SOL', 'ARB', 'DOGE', 'AVAX', 'MATIC', 'LINK', 'UNI', 'OP'],
};

// View modes: 'dashboard' | 'heatmap' | 'portfolio' | 'help' | 'alerts'
CONFIG.view = 'dashboard';

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  mids: null,
  priceHistory: {},         // { coin: [p0, p1, ...] }
  orderbook: null,
  trades: null,
  allTrades: [],            // accumulated for export
  metaAndCtx: null,
  candles: null,
  userState: null,
  openOrders: null,
  countdown: CONFIG.refreshInterval,
  lastUpdate: null,
  running: true,
  error: null,
  fetchInFlight: false,
  prompt: null,             // { kind, label, value }
  message: null,            // { text, color, expiresAt }
  wsConnected: false,
};

// ─── API clients ─────────────────────────────────────────────────────────────

const api = new HyperliquidAPI();
let ws = null;

// ─── CLI args ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--demo':
      case '-d':
        CONFIG.demoMode = true;
        break;
      case '--address':
      case '-a':
        CONFIG.address = args[++i];
        break;
      case '--coin':
      case '-c':
        CONFIG.selectedCoin = (args[++i] || 'BTC').toUpperCase();
        break;
      case '--refresh':
      case '-r':
        CONFIG.refreshInterval = Math.max(1, parseInt(args[++i]) || 5);
        break;
      case '--timeframe':
      case '-t':
        CONFIG.timeframe = args[++i] || '1h';
        break;
      case '--no-ws':
        CONFIG.useWebsocket = false;
        break;
      case '--no-sound':
        CONFIG.enableSound = false;
        break;
      case '--reset-config':
        cfg.save(cfg.DEFAULT_CONFIG);
        console.log('Config reset.');
        process.exit(0);
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }
}

function printHelp() {
  const txt = `
${c.header('HYPERLIQUID CLI DASHBOARD')} ${c.dim('v' + VERSION)}

${c.bold('USAGE:')}
  node src/index.js [options]

${c.bold('OPTIONS:')}
  ${c.accent('-d, --demo')}              Use mock data (no internet required)
  ${c.accent('-a, --address ADDR')}      Wallet address for portfolio view
  ${c.accent('-c, --coin COIN')}         Initial coin (default: BTC)
  ${c.accent('-r, --refresh SEC')}       Refresh interval in seconds (default: 5)
  ${c.accent('-t, --timeframe TF')}      Candle interval: 1m|5m|15m|1h|4h|1d
  ${c.accent('    --no-ws')}             Disable WebSocket streaming (HTTP only)
  ${c.accent('    --no-sound')}          Disable terminal bell on alerts
  ${c.accent('    --reset-config')}      Reset ~/.hyperliquid/config.json
  ${c.accent('-h, --help')}              Show this help

${c.bold('KEYBOARD:')}
  ${c.accent('q / Ctrl+C')}   Quit                ${c.accent('r')}            Force refresh
  ${c.accent('↑ ↓ / j k')}   Change coin         ${c.accent('d')}            Toggle demo mode
  ${c.accent('Tab')}          Cycle view          ${c.accent('1-5')}          Jump to view
  ${c.accent('t')}            Cycle timeframe     ${c.accent('s')}            Cycle ticker sort
  ${c.accent('h')}            Toggle heatmap      ${c.accent('p')}            Toggle portfolio
  ${c.accent('/')}            Filter coins        ${c.accent('g')}            Go to coin (quick)
  ${c.accent('e')}            Export trades CSV   ${c.accent('a')}            Add price alert
  ${c.accent('A')}            View/clear alerts   ${c.accent('w')}            Set whale threshold
  ${c.accent('?')}            Toggle help         ${c.accent('S')}            Save config

${c.bold('VIEWS:')}
  ${c.gold('1')} Dashboard    ${c.gold('2')} Heatmap    ${c.gold('3')} Portfolio    ${c.gold('4')} Alerts

${c.bold('EXAMPLES:')}
  ${c.dim('$')} node src/index.js --demo
  ${c.dim('$')} node src/index.js --coin ETH --timeframe 15m
  ${c.dim('$')} node src/index.js --address 0xYourWallet

${c.dim('Data: api.hyperliquid.xyz · No API key needed · Config: ' + cfg.configPath())}
`;
  console.log(txt);
}

// ─── WebSocket streaming ─────────────────────────────────────────────────────

function setupWebsocket() {
  if (CONFIG.demoMode || !CONFIG.useWebsocket) return;

  try {
    ws = new HyperliquidWS();
    ws.on('open', () => {
      state.wsConnected = true;
      ws.subscribe({ type: 'allMids' });
      ws.subscribe({ type: 'l2Book', coin: CONFIG.selectedCoin });
      ws.subscribe({ type: 'trades', coin: CONFIG.selectedCoin });
    });
    ws.on('close', () => { state.wsConnected = false; });
    ws.on('error', () => { state.wsConnected = false; });
    ws.on('message', (msg) => {
      if (!msg || !msg.channel) return;
      if (msg.channel === 'allMids' && msg.data && msg.data.mids) {
        state.mids = msg.data.mids;
        trackPriceHistory();
        checkAlerts();
      } else if (msg.channel === 'l2Book' && msg.data) {
        state.orderbook = msg.data;
      } else if (msg.channel === 'trades' && Array.isArray(msg.data)) {
        const newTrades = msg.data.reverse();
        state.trades = [...newTrades, ...(state.trades || [])].slice(0, 50);
        state.allTrades.push(...newTrades);
        if (state.allTrades.length > 1000) state.allTrades.splice(0, state.allTrades.length - 1000);
        // Whale alert - bell for large trades
        for (const trade of newTrades) {
          const notional = parseFloat(trade.px) * parseFloat(trade.sz);
          if (notional >= CONFIG.whaleThreshold && CONFIG.enableSound) t.bell();
        }
      }
      state.lastUpdate = new Date();
      render();
    });
    ws.connect();
  } catch (err) {
    state.wsConnected = false;
  }
}

function resubscribeCoin(oldCoin, newCoin) {
  if (!ws || !state.wsConnected) return;
  ws.unsubscribeAll();
  ws.subscribe({ type: 'allMids' });
  ws.subscribe({ type: 'l2Book', coin: newCoin });
  ws.subscribe({ type: 'trades', coin: newCoin });
}

function trackPriceHistory() {
  if (!state.mids) return;
  for (const [coin, price] of Object.entries(state.mids)) {
    if (!state.priceHistory[coin]) state.priceHistory[coin] = [];
    const hist = state.priceHistory[coin];
    const p = parseFloat(price);
    if (!isFinite(p)) continue;
    // Only append if changed (avoid flat sparklines from identical ticks)
    if (hist.length === 0 || hist[hist.length - 1] !== p) hist.push(p);
    if (hist.length > 40) hist.shift();
  }
}

function checkAlerts() {
  const triggered = alerts.check(CONFIG.alerts, state.mids);
  if (triggered.length > 0) {
    if (CONFIG.enableSound) t.bell();
    const first = triggered[0];
    showMessage(
      `🔔 ALERT: ${first.coin} ${first.op} $${first.price} (now $${first.triggeredPrice.toFixed(2)})`,
      c.bgRgb(160, 100, 0)
    );
    cfg.save(CONFIG);
  }
}

// ─── HTTP fetch (polling backup / initial load) ──────────────────────────────

async function fetchData() {
  if (state.fetchInFlight) return;
  state.fetchInFlight = true;
  try {
    if (CONFIG.demoMode) {
      state.mids = demo.generateDemoMids();
      state.orderbook = demo.generateDemoOrderbook(CONFIG.selectedCoin);
      state.trades = demo.generateDemoTrades(CONFIG.selectedCoin);
      state.metaAndCtx = demo.generateDemoMetaAndAssetCtxs();
      state.candles = demo.generateDemoCandles(CONFIG.selectedCoin);
      state.userState = CONFIG.address ? demo.generateDemoUserState() : null;
      state.openOrders = CONFIG.address ? [] : null;
    } else {
      const requests = [
        api.getAllMids().catch(() => null),
        api.getMetaAndAssetCtxs().catch(() => null),
        api.getCandles(CONFIG.selectedCoin, CONFIG.timeframe).catch(() => null),
      ];
      // Only fetch orderbook/trades via HTTP when WS is not connected
      if (!state.wsConnected) {
        requests.push(api.getL2Book(CONFIG.selectedCoin).catch(() => null));
        requests.push(api.getRecentTrades(CONFIG.selectedCoin).catch(() => null));
      }
      if (CONFIG.address) {
        requests.push(api.getUserState(CONFIG.address).catch(() => null));
        requests.push(api.getUserOpenOrders(CONFIG.address).catch(() => null));
      }

      const results = await Promise.all(requests);
      let idx = 0;
      if (results[idx]) state.mids = results[idx]; idx++;
      if (results[idx]) state.metaAndCtx = results[idx]; idx++;
      if (results[idx]) state.candles = results[idx]; idx++;
      if (!state.wsConnected) {
        if (results[idx] !== undefined) { if (results[idx]) state.orderbook = results[idx]; idx++; }
        if (results[idx] !== undefined) { if (results[idx]) state.trades = results[idx]; idx++; }
      }
      if (CONFIG.address) {
        if (results[idx] !== undefined) { if (results[idx]) state.userState = results[idx]; idx++; }
        if (results[idx] !== undefined) { if (results[idx]) state.openOrders = results[idx]; idx++; }
      }
    }

    trackPriceHistory();
    checkAlerts();
    state.lastUpdate = new Date();
    state.error = null;
  } catch (err) {
    state.error = err.message;
  } finally {
    state.fetchInFlight = false;
  }
}

// ─── Rendering (double-buffered) ─────────────────────────────────────────────

function render() {
  const { width, height } = t.getSize();
  if (width < 80 || height < 20) {
    t.clearScreen();
    console.log(c.warn(`\n Terminal too small: ${width}x${height}. Need at least 80x20.`));
    return;
  }

  const fb = new t.FrameBuffer();
  // Move cursor home without clearing - we redraw every cell
  fb.write('\x1b[H');

  ui.headerBar(fb, width, { version: VERSION });

  const topY = 1;
  const bottomY = height - 1;
  const contentH = bottomY - topY - 1;

  if (CONFIG.view === 'heatmap') {
    ui.panel(fb, 0, topY, width, contentH + 1, ' Market Heatmap ');
    ui.heatmap(fb, 0, topY, width, contentH + 1, state.mids, state.metaAndCtx);
  } else if (CONFIG.view === 'portfolio') {
    renderPortfolioView(fb, width, topY, contentH);
  } else if (CONFIG.view === 'alerts') {
    renderAlertsView(fb, width, topY, contentH);
  } else {
    renderDashboard(fb, width, topY, contentH);
  }

  // Status bar
  ui.statusBar(fb, bottomY, width, {
    selectedCoin: CONFIG.selectedCoin,
    timeframe: CONFIG.timeframe,
    refreshInterval: CONFIG.refreshInterval,
    countdown: state.countdown,
    mode: CONFIG.demoMode ? 'DEMO' : 'LIVE',
    lastUpdate: state.lastUpdate,
    latency: api.lastLatencyMs,
    wsConnected: state.wsConnected,
    alertCount: CONFIG.alerts.filter(a => !a.triggered).length,
    activeView: CONFIG.view,
  });

  // Overlays (drawn last so they win)
  if (state.error) {
    const msg = ` ⚠ ${state.error.slice(0, 60)} `;
    fb.at(Math.floor((width - msg.length) / 2), Math.floor(height / 2),
      c.bgRed(c.brightWhite(msg)));
  }
  if (state.message && Date.now() < state.message.expiresAt) {
    const msg = ` ${state.message.text} `;
    fb.at(Math.floor((width - c.strip(msg).length) / 2), 1,
      state.message.color(c.brightWhite(msg)));
  }
  if (state.prompt) {
    ui.promptBar(fb, height - 2, width, state.prompt.label, state.prompt.value);
  }
  if (CONFIG.view === 'help' || state.showHelp) {
    ui.modal(fb, width, height, buildHelpContent());
  }

  fb.flush();
}

function renderDashboard(fb, width, topY, contentH) {
  const leftW = Math.floor(width * 0.42);
  const rightW = width - leftW;

  const obH = Math.floor(contentH * 0.62);
  const chartH = contentH - obH + 1;
  ui.panel(fb, 0, topY, leftW, obH, ` Orderbook · ${CONFIG.selectedCoin} `);
  ui.orderbook(fb, 0, topY, leftW, obH, state.orderbook);

  ui.panel(fb, 0, topY + obH, leftW, chartH, ` ${CONFIG.selectedCoin}/USD · ${CONFIG.timeframe} `);
  ui.candleChart(fb, 0, topY + obH, leftW, chartH, state.candles, CONFIG.selectedCoin, CONFIG.timeframe);

  // Right column: ticker, funding, trades
  const tickerH = Math.min(13, Math.floor(contentH * 0.38));
  ui.panel(fb, leftW, topY, rightW, tickerH, ' Markets ');
  ui.ticker(fb, leftW, topY, rightW, tickerH, state.mids, state.priceHistory, state.metaAndCtx, {
    selected: CONFIG.selectedCoin,
    sort: CONFIG.tickerSort,
  });

  const midRightH = Math.floor(contentH * 0.30);
  ui.panel(fb, leftW, topY + tickerH, rightW, midRightH, ' Funding & OI ');
  ui.fundingRates(fb, leftW, topY + tickerH, rightW, midRightH, state.metaAndCtx);

  const tradesH = contentH - tickerH - midRightH + 1;
  ui.panel(fb, leftW, topY + tickerH + midRightH, rightW, tradesH,
    ` Trades · ${CONFIG.selectedCoin} ${state.wsConnected ? '· live' : ''} `);
  ui.trades(fb, leftW, topY + tickerH + midRightH, rightW, tradesH,
    state.trades, CONFIG.selectedCoin, CONFIG.whaleThreshold);
}

function renderPortfolioView(fb, width, topY, contentH) {
  const leftW = Math.floor(width * 0.55);
  const rightW = width - leftW;

  ui.panel(fb, 0, topY, leftW, contentH + 1, ' Portfolio ');
  ui.portfolio(fb, 0, topY, leftW, contentH + 1, state.userState, state.mids);

  ui.panel(fb, leftW, topY, rightW, contentH + 1, ' Markets ');
  ui.ticker(fb, leftW, topY, rightW, contentH + 1, state.mids, state.priceHistory, state.metaAndCtx, {
    selected: CONFIG.selectedCoin,
    sort: CONFIG.tickerSort,
  });
}

function renderAlertsView(fb, width, topY, contentH) {
  ui.panel(fb, 0, topY, width, contentH + 1, ' Price Alerts ');
  const innerX = 2;
  fb.at(innerX, topY + 1, c.gray(
    t.padEnd('#', 4) +
    t.padEnd('Coin', 8) +
    t.padEnd('Trigger', 14) +
    t.padEnd('Current', 14) +
    t.padEnd('Status', 12) +
    'Created'
  ));

  if (CONFIG.alerts.length === 0) {
    fb.at(innerX, topY + 3, c.dim('  No alerts. Press "a" to add one (e.g., "BTC > 70000").'));
    return;
  }

  CONFIG.alerts.forEach((alert, i) => {
    const current = state.mids && state.mids[alert.coin]
      ? parseFloat(state.mids[alert.coin]) : null;
    const statusStr = alert.triggered
      ? c.orange('TRIGGERED')
      : c.profit('ACTIVE');
    const created = new Date(alert.createdAt).toLocaleString('en-US', { hour12: false });
    const trigStr = `${alert.op} $${alert.price}`;
    const currStr = current ? `$${t.formatPrice(current)}` : '—';

    fb.at(innerX, topY + 3 + i,
      c.dim(t.padEnd(String(i + 1), 4)) +
      c.bold(t.padEnd(alert.coin, 8)) +
      c.gold(t.padEnd(trigStr, 14)) +
      c.accent(t.padEnd(currStr, 14)) +
      t.padEnd(statusStr, 12) +
      c.dim(created)
    );
  });

  fb.at(innerX, topY + contentH - 1,
    c.dim('Press "a" to add · "A" to clear triggered · number to delete'));
}

function buildHelpContent() {
  return [
    c.header('HYPERLIQUID CLI DASHBOARD · Keybindings'),
    '',
    c.gold('Navigation'),
    `  ${c.accent('q / Ctrl+C')}    Quit application`,
    `  ${c.accent('Tab / 1-4')}    Cycle / jump to view`,
    `  ${c.accent('↑ ↓ / j k')}    Select previous / next coin`,
    `  ${c.accent('g')}             Prompt: type a coin symbol`,
    '',
    c.gold('Views'),
    `  ${c.accent('1')} Dashboard    ${c.accent('2')} Heatmap    ${c.accent('3')} Portfolio    ${c.accent('4')} Alerts`,
    `  ${c.accent('h')} Toggle heatmap view`,
    `  ${c.accent('p')} Toggle portfolio view`,
    '',
    c.gold('Data'),
    `  ${c.accent('r')}   Force refresh from API`,
    `  ${c.accent('d')}   Toggle demo/live data mode`,
    `  ${c.accent('t')}   Cycle candle timeframe (1m→5m→15m→1h→4h→1d)`,
    `  ${c.accent('s')}   Cycle ticker sort (default → price → change → volume)`,
    `  ${c.accent('/')}   Filter ticker by symbol prefix`,
    '',
    c.gold('Trading tools'),
    `  ${c.accent('a')}   Add price alert (e.g., "BTC > 70000")`,
    `  ${c.accent('A')}   Clear triggered alerts`,
    `  ${c.accent('w')}   Set whale trade threshold (USD)`,
    `  ${c.accent('e')}   Export recent trades to CSV`,
    '',
    c.gold('Preferences'),
    `  ${c.accent('S')}   Save current settings as default`,
    `  ${c.accent('?')}   Show/hide this help`,
    '',
    c.dim(`Config file: ${cfg.configPath()}`),
  ].join('\n');
}

// ─── Messages ────────────────────────────────────────────────────────────────

function showMessage(text, colorFn = c.bgBlue, durationMs = 3000) {
  state.message = { text, color: colorFn, expiresAt: Date.now() + durationMs };
  render();
}

// ─── Input handling ──────────────────────────────────────────────────────────

function setupInput() {
  if (!process.stdin.isTTY) return;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', handleKey);
}

function handleKey(key) {
  // Prompt mode: all input flows into the prompt until Enter/Esc
  if (state.prompt) return handlePromptKey(key);

  // Dismiss transient help modal on any key
  if (state.showHelp) { state.showHelp = false; render(); return; }

  switch (key) {
    case 'q':
    case '\u0003':
      return shutdown();

    case 'r':
      return fetchData().then(render);

    case 'd':
      CONFIG.demoMode = !CONFIG.demoMode;
      if (CONFIG.demoMode && ws) ws.close();
      if (!CONFIG.demoMode && !ws) setupWebsocket();
      return fetchData().then(render);

    case '\t':
      cycleView();
      return render();

    case '1': CONFIG.view = 'dashboard'; return render();
    case '2': CONFIG.view = 'heatmap'; return render();
    case '3': CONFIG.view = 'portfolio'; return render();
    case '4': CONFIG.view = 'alerts'; return render();

    case 'h':
      CONFIG.view = CONFIG.view === 'heatmap' ? 'dashboard' : 'heatmap';
      return render();
    case 'p':
      CONFIG.view = CONFIG.view === 'portfolio' ? 'dashboard' : 'portfolio';
      return render();

    case 't':
      return cycleTimeframe();
    case 's':
      return cycleSort();

    case '\x1b[A': case 'k':
      return changeCoin(-1);
    case '\x1b[B': case 'j':
      return changeCoin(1);

    case 'g':
      state.prompt = { kind: 'goto', label: 'Go to coin:', value: '' };
      return render();
    case '/':
      state.prompt = { kind: 'filter', label: 'Filter:', value: CONFIG.filter || '' };
      return render();
    case 'a':
      state.prompt = { kind: 'alert', label: 'Add alert (e.g. BTC > 70000):', value: '' };
      return render();
    case 'A':
      CONFIG.alerts = CONFIG.alerts.filter(a => !a.triggered);
      cfg.save(CONFIG);
      showMessage('Triggered alerts cleared', c.bgGreen);
      return render();
    case 'w':
      state.prompt = { kind: 'whale', label: `Whale threshold USD (now ${CONFIG.whaleThreshold}):`, value: '' };
      return render();

    case 'e':
      return exportNow();

    case 'S':
      if (cfg.save(CONFIG)) showMessage('✓ Config saved to ' + cfg.configPath(), c.bgGreen);
      else showMessage('Failed to save config', c.bgRed);
      return;

    case '?':
      state.showHelp = !state.showHelp;
      return render();

    case '\x1b':
      // Bare Escape - clear modal / prompts
      state.showHelp = false;
      return render();
  }
}

function handlePromptKey(key) {
  const p = state.prompt;
  if (key === '\r' || key === '\n') {
    submitPrompt(p);
    state.prompt = null;
    return render();
  }
  if (key === '\x1b') {
    state.prompt = null;
    return render();
  }
  if (key === '\x7f' || key === '\b') { // Backspace
    p.value = p.value.slice(0, -1);
    return render();
  }
  // Filter out escape sequences
  if (key.length === 1 && key.charCodeAt(0) >= 32) {
    p.value += key;
    return render();
  }
}

function submitPrompt(p) {
  const val = p.value.trim();
  if (!val && p.kind !== 'filter') return;

  switch (p.kind) {
    case 'goto': {
      const coin = val.toUpperCase();
      if (state.mids && state.mids[coin]) {
        const old = CONFIG.selectedCoin;
        CONFIG.selectedCoin = coin;
        resubscribeCoin(old, coin);
        fetchData().then(render);
      } else {
        showMessage(`Unknown coin: ${coin}`, c.bgRed);
      }
      break;
    }
    case 'filter':
      CONFIG.filter = val || null;
      break;
    case 'alert': {
      const parsed = alerts.parseExpression(val);
      if (!parsed) { showMessage('Invalid format. Use "BTC > 70000"', c.bgRed); return; }
      alerts.add(CONFIG.alerts, parsed.coin, parsed.op, parsed.price);
      cfg.save(CONFIG);
      showMessage(`Alert added: ${parsed.coin} ${parsed.op} $${parsed.price}`, c.bgGreen);
      break;
    }
    case 'whale': {
      const n = parseFloat(val);
      if (isFinite(n) && n > 0) {
        CONFIG.whaleThreshold = n;
        cfg.save(CONFIG);
        showMessage(`Whale threshold: $${n.toLocaleString()}`, c.bgGreen);
      }
      break;
    }
  }
}

function cycleView() {
  const order = ['dashboard', 'heatmap', 'portfolio', 'alerts'];
  const idx = order.indexOf(CONFIG.view);
  CONFIG.view = order[(idx + 1) % order.length];
}

function cycleTimeframe() {
  const frames = ['1m', '5m', '15m', '1h', '4h', '1d'];
  const idx = frames.indexOf(CONFIG.timeframe);
  CONFIG.timeframe = frames[(idx + 1) % frames.length];
  fetchData().then(render);
}

function cycleSort() {
  const order = ['default', 'price', 'change', 'volume'];
  const idx = order.indexOf(CONFIG.tickerSort);
  CONFIG.tickerSort = order[(idx + 1) % order.length];
  showMessage(`Sort: ${CONFIG.tickerSort}`, c.bgBlue);
}

function changeCoin(direction) {
  // Use live markets if available, else fall back to curated list
  const available = state.mids ? Object.keys(state.mids).sort() : CONFIG.coins;
  const idx = available.indexOf(CONFIG.selectedCoin);
  const newIdx = (idx + direction + available.length) % available.length;
  const old = CONFIG.selectedCoin;
  CONFIG.selectedCoin = available[newIdx];
  resubscribeCoin(old, CONFIG.selectedCoin);
  fetchData().then(render);
}

function exportNow() {
  const data = state.allTrades.length ? state.allTrades : (state.trades || []);
  if (!data.length) {
    showMessage('No trades to export', c.bgYellow);
    return;
  }
  const file = exporter.exportTrades(data, CONFIG.selectedCoin);
  if (file) showMessage(`✓ Exported ${data.length} trades to ${file}`, c.bgGreen);
}

// ─── Main loop ───────────────────────────────────────────────────────────────

let countdownTimer;

async function start() {
  parseArgs();

  t.enterAltScreen();
  t.clearScreen();
  t.cursorHide();

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('uncaughtException', (err) => {
    cleanup();
    console.error(c.red(`\nFatal: ${err.message}`));
    console.error(err.stack);
    process.exit(1);
  });
  process.stdout.on('resize', render);

  setupInput();
  setupWebsocket();

  await fetchData();
  render();

  state.countdown = CONFIG.refreshInterval;
  countdownTimer = setInterval(() => {
    // Expire transient messages
    if (state.message && Date.now() > state.message.expiresAt) {
      state.message = null;
    }

    state.countdown--;
    if (state.countdown <= 0) {
      state.countdown = CONFIG.refreshInterval;
      fetchData().then(render);
    } else {
      // Only redraw status bar for the countdown (cheap)
      const { width, height } = t.getSize();
      const fb = new t.FrameBuffer();
      ui.statusBar(fb, height - 1, width, {
        selectedCoin: CONFIG.selectedCoin,
        timeframe: CONFIG.timeframe,
        refreshInterval: CONFIG.refreshInterval,
        countdown: state.countdown,
        mode: CONFIG.demoMode ? 'DEMO' : 'LIVE',
        lastUpdate: state.lastUpdate,
        latency: api.lastLatencyMs,
        wsConnected: state.wsConnected,
        alertCount: CONFIG.alerts.filter(a => !a.triggered).length,
        activeView: CONFIG.view,
      });
      fb.flush();
    }
  }, 1000);
}

function cleanup() {
  clearInterval(countdownTimer);
  if (ws) try { ws.close(); } catch (_) {}
  t.cursorShow();
  t.exitAltScreen();
}

function shutdown() {
  state.running = false;
  cleanup();
  process.exit(0);
}

start().catch(err => {
  cleanup();
  console.error(c.red(`Startup error: ${err.message}`));
  process.exit(1);
});
