# Hyperliquid CLI Dashboard

A professional, **zero-dependency** terminal dashboard for monitoring Hyperliquid perpetual futures in real-time. Pure Node.js with WebSocket streaming, candlestick charts, price alerts, portfolio tracking, and more.

```
 ◆  HYPERLIQUID TERMINAL                                                     v2.0.0
╭── Orderbook · BTC ──────────────────╮╭── Markets ────────────────────────────────╮
│ Price        Size       Total       ││ Coin   Price        24h Δ     Vol    Chart│
│ 67,483.1    9.5530    55.52       ▐ ││ ▶ BTC  $68,047.2   +2.00%   $56M  ▅▆▇▅▄▁▂▁│
│ 67,476.3    4.6800    45.97      ▐  ││ ETH    $3,552.66   +0.40%   $570M ▁█▇▅▂▅▂▁│
│ 67,469.6    6.8710    41.29     ▐   ││ SOL    $179.16     +0.17%   $532M ▃▆▃▇▅▃▄▅│
│ ◆ Mid: 67,432.5 spread 6.74 (0.010%)││ DOGE   $0.1578     +5.20%   $802M █▆▃█▂▁▅▇│
│ 67,429.1    8.8190     8.82  ▐      │╰───────────────────────────────────────────╯
│ 67,422.4    1.4320    10.25   ▐     │╭── Funding & OI ───────────────────────────╮
│ 67,415.6    5.3840    15.64    ▐    ││ Asset  Fund/h    OI       24h Vol  APR    │
│ Imbalance 42.4% ████████ ███████ 57%││ DOGE   +0.0659%  $496M   $802M     +577%  │
╰─────────────────────────────────────╯╰───────────────────────────────────────────╯
╭── BTC/USD · 1h ─────────────────────╮╭── Trades · BTC · live ────────────────────╮
│ O:65,409  H:66,141  L:64,156  -1.26%││ Time      Side  Price       Size   USD   │
│      │  │                            ││ 21:42:35  BUY   $67,425   4.88   $329K 🐋│
│   █─█▓█ │                            ││ 21:42:32  SELL  $67,427   4.28   $288K 🐋│
│   █│█▓█▓│       ◄ $64,586.0         ││ 21:42:29  SELL  $67,429   1.79   $121K 🐋│
╰─────────────────────────────────────╯╰───────────────────────────────────────────╯
 LIVE·WS │ BTC 1h │ refresh 3s │ api 123ms │ updated 21:42:35 │ 🔔 2 │   ? help · q quit
```

## Features

### Real-time data
- **WebSocket streaming** — live orderbook, trades, and prices with automatic HTTP fallback
- **Multi-market ticker** with live sparklines and 24h change
- **L2 orderbook** with cumulative depth bars and bid/ask imbalance meter
- **Candlestick chart** with wicks, configurable timeframes (1m / 5m / 15m / 1h / 4h / 1d)
- **OHLCV header** on the chart (open / high / low / close / volume / change)
- **Funding rate** table sorted by magnitude, with annualized APR
- **Whale trade highlighting** — large trades flagged with a purple tag and terminal bell

### Views
- **Dashboard** — orderbook + chart + ticker + funding + trades
- **Heatmap** — market-wide grid colored by 24h change, sized by volume
- **Portfolio** — account balance, margin usage, open positions with live PnL
- **Alerts** — manage price-triggered notifications

### Productivity
- **Price alerts** — set triggers like `BTC > 70000`, saved to disk, fires terminal bell
- **Quick jump** — press `g` to type any coin symbol and navigate instantly
- **Filter** — press `/` to filter the market list
- **Sort** — cycle ticker by default / price / change / volume
- **CSV export** — dump recent trades to CSV with `e`
- **Config persistence** — settings saved to `~/.hyperliquid/config.json`
- **Help overlay** — press `?` anywhere to see all keybindings
- **API health indicator** — live latency and WS connection status in the status bar

### Quality of life
- **Zero npm dependencies** — works everywhere Node.js does, no `npm install`
- **Double-buffered rendering** — no flicker, no tearing
- **Alternate screen buffer** — clean exit like `vim`, terminal restored perfectly
- **Responsive layout** — adapts to any terminal size (minimum 80×20)
- **Demo mode** — run fully functional without any internet connection

## Quick Start

```bash
# Live mode (WebSocket + REST, requires internet)
node src/index.js

# Demo mode (realistic mock data, no internet)
node src/index.js --demo

# Start with a specific coin + timeframe
node src/index.js --coin ETH --timeframe 15m

# Track a wallet's positions
node src/index.js --address 0xYourAddress

# Disable WebSocket (HTTP polling only)
node src/index.js --no-ws
```

## CLI Flags

| Flag | Description |
|------|-------------|
| `-d, --demo` | Use mock data, no internet required |
| `-a, --address ADDR` | Wallet address for portfolio view |
| `-c, --coin COIN` | Initial coin (default: BTC) |
| `-r, --refresh SEC` | HTTP refresh interval (default: 5) |
| `-t, --timeframe TF` | Candle interval: `1m` \| `5m` \| `15m` \| `1h` \| `4h` \| `1d` |
| `--no-ws` | Disable WebSocket streaming (HTTP only) |
| `--no-sound` | Disable terminal bell on alerts |
| `--reset-config` | Reset config file |
| `-h, --help` | Show help |

## Keyboard

| Key | Action |
|-----|--------|
| `q` / `Ctrl+C` | Quit |
| `r` | Force refresh |
| `d` | Toggle demo / live mode |
| `↑` `↓` / `j` `k` | Previous / next coin |
| `Tab` | Cycle view |
| `1` – `4` | Jump to view |
| `t` | Cycle candle timeframe |
| `s` | Cycle ticker sort (default → price → change → volume) |
| `h` | Toggle heatmap view |
| `p` | Toggle portfolio view |
| `/` | Filter markets by prefix |
| `g` | Go to coin (type symbol) |
| `a` | Add price alert (e.g. `BTC > 70000`) |
| `A` | Clear triggered alerts |
| `w` | Set whale trade threshold |
| `e` | Export recent trades to CSV |
| `S` | Save current settings as default |
| `?` | Show help overlay |

## Architecture

```
src/
├── index.js               Entry point · orchestration, input, rendering loop
├── api/
│   ├── hyperliquid.js     REST client (retries, timeouts, latency tracking)
│   ├── websocket.js       Raw WebSocket client (RFC 6455, auto-reconnect)
│   └── demo-data.js       Mock data generator for offline mode
├── lib/
│   ├── colors.js          ANSI colors with proper chaining
│   ├── terminal.js        FrameBuffer + cursor / box drawing / formatting
│   ├── config.js          Config persistence (~/.hyperliquid/config.json)
│   ├── alerts.js          Price alert engine
│   └── exporter.js        CSV export utilities
└── ui/
    └── components.js      Reusable UI components (panel / orderbook / chart / etc)
```

## API Endpoints Used

All data comes from Hyperliquid's **free public API** at `api.hyperliquid.xyz` — no API key required.

**REST (`/info`):**
- `allMids` — prices for every market
- `l2Book` — L2 orderbook
- `recentTrades` — recent executions
- `metaAndAssetCtxs` — funding, OI, 24h volume, prevDayPx
- `candleSnapshot` — OHLCV candles
- `clearinghouseState` — user account / positions (read-only)
- `openOrders` — user open orders

**WebSocket (`/ws`):**
- `allMids` subscription — live price ticks
- `l2Book` subscription — live orderbook updates
- `trades` subscription — live trade feed

## Requirements

- Node.js >= 18.0.0
- Terminal with 24-bit (truecolor) ANSI support — any modern terminal works
- Minimum terminal size: 80×20 (recommended 120×40+)

## Bug Fixes in v2.0

- Fixed color chaining — `bold(gold(x))` now correctly preserves both styles
- Fixed double-rendering of panel titles
- Fixed orderbook rows overflowing panel height
- Fixed race condition from rapid keypresses during fetches
- Fixed screen flicker (now using frame-buffered single-flush rendering)
- Fixed fake "24h change" — now uses real `prevDayPx` from the API
- Fixed NaN crashes when the API returns unexpected shapes
- Fixed status bar padding overflowing narrow terminals
- Fixed spurious escape-key handling for arrow sequences
- Fixed depth bars on orderbook rows being overwritten by text

## License

MIT
