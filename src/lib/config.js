/**
 * Config file persistence: ~/.hyperliquid/config.json
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.hyperliquid');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG = {
  selectedCoin: 'BTC',
  refreshInterval: 5,
  timeframe: '1h',
  address: null,
  demoMode: false,
  alerts: [],           // [{ coin, op: '>' | '<', price, triggered }]
  whaleThreshold: 100000, // USD notional to highlight as whale trade
  tickerSort: 'default',  // 'default' | 'price' | 'change' | 'volume'
  useWebsocket: true,
  enableSound: true,
};

function ensureDir() {
  try {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  } catch (_) {}
}

function load() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return { ...DEFAULT_CONFIG };
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (_) {
    return { ...DEFAULT_CONFIG };
  }
}

function save(config) {
  try {
    ensureDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (_) {
    return false;
  }
}

function configPath() { return CONFIG_FILE; }

module.exports = { load, save, configPath, DEFAULT_CONFIG };
