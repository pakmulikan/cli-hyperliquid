#!/usr/bin/env node

/**
 * Hyperliquid CLI Dashboard
 * Professional terminal-based trading dashboard
 * Zero dependencies - pure Node.js
 * 
 * Usage:
 *   node src/index.js              # Live mode (requires internet)
 *   node src/index.js --demo       # Demo mode with mock data
 *   node src/index.js --address 0x...  # Show portfolio for address
 */

const HyperliquidAPI = require('./api/hyperliquid');
const demo = require('./api/demo-data');
const c = require('./lib/colors');
const t = require('./lib/terminal');
const ui = require('./ui/components');

// ─── Configuration ───────────────────────────────────────────────────────────

const CONFIG = {
  version: '1.0.0',
  refreshInterval: 5,        // seconds
  selectedCoin: 'BTC',
  selectedPanel: 0,
  demoMode: false,
  address: null,
  coins: ['BTC', 'ETH', 'SOL', 'ARB', 'DOGE', 'AVAX', 'MATIC', 'LINK', 'UNI', 'OP'],
};

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  mids: null,
  prevMids: null,
  priceHistory: {},
  orderbook: null,
  trades: null,
  metaAndCtx: null,
  candles: null,
  userState: null,
  countdown: CONFIG.refreshInterval,
  lastUpdate: new Date(),
  running: true,
  error: null,
};

// ─── Parse CLI arguments ─────────────────────────────────────────────────────

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
        CONFIG.refreshInterval = parseInt(args[++i]) || 5;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }
}

function printHelp() {
  console.log(`
${c.header('HYPERLIQUID CLI DASHBOARD')} ${c.dim('v' + CONFIG.version)}

${c.bold('USAGE:')}
  node src/index.js [options]

${c.bold('OPTIONS:')}
  ${c.accent('--demo, -d')}          Run with demo/mock data (no internet needed)
  ${c.accent('--address, -a')}       Ethereum address to show portfolio
  ${c.accent('--coin, -c')}          Initial coin to display (default: BTC)
  ${c.accent('--refresh, -r')}       Refresh interval in seconds (default: 5)
  ${c.accent('--help, -h')}          Show this help message

${c.bold('KEYBOARD:')}
  ${c.accent('q / Ctrl+C')}          Quit
  ${c.accent('Tab')}                 Cycle active panel
  ${c.accent('1-5')}                 Jump to panel
  ${c.accent('↑ / ↓')}              Scroll / Change coin
  ${c.accent('r')}                   Force refresh
  ${c.accent('d')}                   Toggle demo mode

${c.bold('PANELS:')}
  ${c.gold('1')} Orderbook      ${c.gold('2')} Price Ticker     ${c.gold('3')} Funding Rates
  ${c.gold('4')} Recent Trades  ${c.gold('5')} Portfolio/Chart

${c.bold('EXAMPLES:')}
  ${c.dim('$')} node src/index.js --demo
  ${c.dim('$')} node src/index.js --coin ETH --refresh 3
  ${c.dim('$')} node src/index.js --address 0x1234...abcd

${c.dim('Free API - No API key required. Data from api.hyperliquid.xyz')}
`);
}

// ─── API Data Fetching ───────────────────────────────────────────────────────

const api = new HyperliquidAPI();

async function fetchData() {
  try {
    if (CONFIG.demoMode) {
      state.prevMids = state.mids;
      state.mids = demo.generateDemoMids();
      state.orderbook = demo.generateDemoOrderbook(CONFIG.selectedCoin);
      state.trades = demo.generateDemoTrades(CONFIG.selectedCoin);
      state.metaAndCtx = demo.generateDemoMetaAndAssetCtxs();
      state.candles = demo.generateDemoCandles(CONFIG.selectedCoin);
      if (CONFIG.address) {
        state.userState = demo.generateDemoUserState();
      }
    } else {
      // Fetch all data in parallel
      const promises = [
        api.getAllMids().catch(e => null),
        api.getL2Book(CONFIG.selectedCoin).catch(e => null),
        api.getRecentTrades(CONFIG.selectedCoin, 20).catch(e => null),
        api.getMetaAndAssetCtxs().catch(e => null),
        api.getCandles(CONFIG.selectedCoin, '1h').catch(e => null),
      ];

      if (CONFIG.address) {
        promises.push(api.getUserState(CONFIG.address).catch(e => null));
      }

      const results = await Promise.all(promises);

      state.prevMids = state.mids;
      state.mids = results[0];
      state.orderbook = results[1];
      state.trades = results[2];
      state.metaAndCtx = results[3];
      state.candles = results[4];
      if (results[5]) state.userState = results[5];
    }

    // Track price history for sparklines
    if (state.mids) {
      for (const [coin, price] of Object.entries(state.mids)) {
        if (!state.priceHistory[coin]) state.priceHistory[coin] = [];
        state.priceHistory[coin].push(parseFloat(price));
        if (state.priceHistory[coin].length > 30) {
          state.priceHistory[coin].shift();
        }
      }
    }

    state.lastUpdate = new Date();
    state.error = null;
  } catch (err) {
    state.error = err.message;
  }
}

// ─── Layout & Rendering ─────────────────────────────────────────────────────

function render() {
  const { width, height } = t.getSize();

  // Clear screen
  t.clearScreen();

  // Header
  ui.headerBar(width, { version: CONFIG.version });

  // Calculate layout
  const topY = 1;
  const bottomY = height - 1;
  const contentH = bottomY - topY - 1;

  // Left column (orderbook) - 40% width
  const leftW = Math.floor(width * 0.38);
  const rightW = width - leftW;

  // Left panel: Orderbook
  const obH = Math.floor(contentH * 0.65);
  ui.panel(0, topY, leftW, obH, ` Orderbook: ${CONFIG.selectedCoin} `);
  ui.orderbook(0, topY, leftW, obH, state.orderbook);

  // Bottom-left: Mini Chart
  const chartH = contentH - obH + 1;
  ui.panel(0, topY + obH, leftW, chartH, ` ${CONFIG.selectedCoin}/USD 1H `);
  ui.miniChart(0, topY + obH, leftW, chartH, state.candles);

  // Top-right: Price Ticker
  const tickerH = Math.min(CONFIG.coins.length + 3, Math.floor(contentH * 0.35));
  ui.panel(leftW, topY, rightW, tickerH, ' Market Prices ');
  ui.ticker(leftW, topY, rightW, tickerH, state.mids, state.prevMids, state.priceHistory);

  // Middle-right: Funding Rates or Portfolio
  const midRightH = Math.floor(contentH * 0.35);
  if (state.userState && CONFIG.address) {
    ui.panel(leftW, topY + tickerH, rightW, midRightH, ' Portfolio ');
    ui.portfolio(leftW, topY + tickerH, rightW, midRightH, state.userState);
  } else {
    ui.panel(leftW, topY + tickerH, rightW, midRightH, ' Funding Rates ');
    ui.fundingRates(leftW, topY + tickerH, rightW, midRightH, state.metaAndCtx);
  }

  // Bottom-right: Recent Trades
  const tradesH = contentH - tickerH - midRightH + 1;
  ui.panel(leftW, topY + tickerH + midRightH, rightW, tradesH, ` Trades: ${CONFIG.selectedCoin} `);
  ui.trades(leftW, topY + tickerH + midRightH, rightW, tradesH, state.trades, CONFIG.selectedCoin);

  // Status bar
  ui.statusBar(bottomY, width, {
    selectedCoin: CONFIG.selectedCoin,
    refreshInterval: CONFIG.refreshInterval,
    countdown: state.countdown,
    mode: CONFIG.demoMode ? 'DEMO' : 'LIVE',
    lastUpdate: state.lastUpdate,
  });

  // Error overlay
  if (state.error) {
    const errMsg = ` Error: ${state.error.slice(0, 60)} `;
    t.writeAt(Math.floor((width - errMsg.length) / 2), Math.floor(height / 2), c.bgRed(c.brightWhite(errMsg)));
  }
}

// ─── Input Handling ──────────────────────────────────────────────────────────

function setupInput() {
  if (!process.stdin.isTTY) return;

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (key) => {
    switch (key) {
      case 'q':
      case '\u0003': // Ctrl+C
        shutdown();
        break;

      case 'r':
        fetchData().then(render);
        break;

      case 'd':
        CONFIG.demoMode = !CONFIG.demoMode;
        fetchData().then(render);
        break;

      case '\t': // Tab
        CONFIG.selectedPanel = (CONFIG.selectedPanel + 1) % 5;
        render();
        break;

      case '1': case '2': case '3': case '4': case '5':
        CONFIG.selectedPanel = parseInt(key) - 1;
        render();
        break;

      case '\x1b[A': // Up arrow
      case 'k':
        changeCoin(-1);
        break;

      case '\x1b[B': // Down arrow
      case 'j':
        changeCoin(1);
        break;

      default:
        // Handle escape sequences for arrows
        if (key === '\x1b') return; // ignore bare escape
        if (key.startsWith('\x1b[')) {
          if (key === '\x1b[A') changeCoin(-1);
          if (key === '\x1b[B') changeCoin(1);
        }
        break;
    }
  });
}

function changeCoin(direction) {
  const idx = CONFIG.coins.indexOf(CONFIG.selectedCoin);
  const newIdx = (idx + direction + CONFIG.coins.length) % CONFIG.coins.length;
  CONFIG.selectedCoin = CONFIG.coins[newIdx];
  fetchData().then(render);
}

// ─── Main Loop ───────────────────────────────────────────────────────────────

let refreshTimer;
let countdownTimer;

async function start() {
  parseArgs();

  // Enter alternate screen buffer
  t.enterAltScreen();
  t.cursorHide();

  // Setup cleanup
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', cleanup);

  // Handle terminal resize
  process.stdout.on('resize', () => {
    render();
  });

  // Setup keyboard input
  setupInput();

  // Initial data fetch
  await fetchData();
  render();

  // Refresh timer
  state.countdown = CONFIG.refreshInterval;
  
  countdownTimer = setInterval(() => {
    state.countdown--;
    if (state.countdown <= 0) {
      state.countdown = CONFIG.refreshInterval;
      fetchData().then(render);
    } else {
      // Just update the status bar countdown
      const { width, height } = t.getSize();
      ui.statusBar(height - 1, width, {
        selectedCoin: CONFIG.selectedCoin,
        refreshInterval: CONFIG.refreshInterval,
        countdown: state.countdown,
        mode: CONFIG.demoMode ? 'DEMO' : 'LIVE',
        lastUpdate: state.lastUpdate,
      });
    }
  }, 1000);
}

function cleanup() {
  t.cursorShow();
  t.exitAltScreen();
}

function shutdown() {
  state.running = false;
  clearInterval(countdownTimer);
  clearInterval(refreshTimer);
  cleanup();
  process.exit(0);
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

start().catch(err => {
  cleanup();
  console.error(c.red(`Fatal error: ${err.message}`));
  process.exit(1);
});
