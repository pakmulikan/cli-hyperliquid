# Hyperliquid CLI Dashboard

A professional, zero-dependency terminal dashboard for monitoring Hyperliquid perpetual futures markets in real-time.

```
╭── Orderbook: BTC ──────────────╮╭── Market Prices ──────────────────────╮
│ Price        Size     Total     ││ Coin   Price        Change   Chart    │
│ 67,503.30    7.019    7.02   ▐  ││ BTC    $67,432.50   +1.23%  ▁▃▅▆▇█▅▃│
│ 67,496.56    3.381   10.40   ▐  ││ ETH    $3,521.80    -0.45%  ▇▅▃▂▁▃▅▄│
│ 67,489.82    8.587   18.99   ▐  ││ SOL    $178.45      +3.21%  ▁▂▃▅▆▇█▇│
│   Spread: $6.74 (0.010%)       │╰───────────────────────────────────────╯
│ 67,429.13    9.538    9.54   ▐  │╭── Funding Rates ───────────────────────╮
│ 67,422.39    5.266   14.80   ▐  ││ Asset  Funding/h  OI ($M)  8h APR     │
│ 67,415.64    3.195   18.00   ▐  ││ BTC    +0.0045%   $486M    +13.1%     │
╰─────────────────────────────────╯╰────────────────────────────────────────╯
 DEMO │ Selected: BTC │ Refresh: 4s │ q:Quit  Tab:Switch  ↑↓:Scroll
```

## Features

- **Real-time Orderbook** — L2 depth with bid/ask spread visualization
- **Price Ticker** — All markets with sparkline mini-charts
- **Funding Rates** — Sorted by magnitude with annualized APR
- **Recent Trades** — Live trade feed with color-coded buy/sell
- **Mini Chart** — 1-hour candlestick visualization
- **Portfolio View** — Account balance, positions, PnL (with wallet address)
- **Zero Dependencies** — Pure Node.js, no npm install needed
- **Demo Mode** — Fully functional offline with realistic mock data

## Quick Start

```bash
# Live mode (requires internet)
node src/index.js

# Demo mode (no internet needed)
node src/index.js --demo

# With specific coin
node src/index.js --coin ETH

# With portfolio tracking
node src/index.js --address 0xYourAddress

# Custom refresh rate
node src/index.js --refresh 3
```

## Keyboard Controls

| Key | Action |
|-----|--------|
| `q` / `Ctrl+C` | Quit |
| `Tab` | Cycle active panel |
| `1-5` | Jump to specific panel |
| `↑` / `↓` or `k` / `j` | Change selected coin |
| `r` | Force refresh |
| `d` | Toggle demo/live mode |

## Panels

1. **Orderbook** — Real-time L2 order book depth
2. **Price Ticker** — Market overview with sparklines
3. **Funding Rates** — Perpetual funding with OI and volume
4. **Recent Trades** — Latest trade execution feed
5. **Portfolio/Chart** — Account positions or price chart

## API Endpoints Used (Free, No Key Required)

All data comes from Hyperliquid's public API (`api.hyperliquid.xyz`):

- `meta` — Asset metadata
- `allMids` — Mid prices for all markets
- `l2Book` — Level 2 orderbook
- `recentTrades` — Recent executions
- `fundingHistory` — Historical funding rates
- `metaAndAssetCtxs` — Market context (OI, volume, funding)
- `candleSnapshot` — OHLCV candle data
- `clearinghouseState` — User portfolio (public, read-only)

## Requirements

- Node.js >= 18.0.0
- Terminal with ANSI color support (most modern terminals)
- Minimum terminal size: 100×30 (recommended: 120×40)

## Architecture

```
src/
├── index.js           # Main entry point & orchestration
├── api/
│   ├── hyperliquid.js # API client (HTTPS, zero deps)
│   └── demo-data.js   # Realistic mock data generator
├── lib/
│   ├── colors.js      # ANSI color utilities
│   └── terminal.js    # Terminal manipulation (cursor, box drawing)
└── ui/
    └── components.js  # Reusable UI components
```

## License

MIT
