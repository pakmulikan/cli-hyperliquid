/**
 * CSV exporter for trades
 */

const fs = require('fs');
const path = require('path');

function toCsv(rows, headers) {
  const escape = (v) => {
    const s = String(v ?? '');
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

function exportTrades(trades, coin, outDir = process.cwd()) {
  if (!trades || trades.length === 0) return null;
  const rows = trades.map(t => ({
    time: new Date(t.time).toISOString(),
    coin,
    side: t.side === 'B' ? 'BUY' : 'SELL',
    price: t.px,
    size: t.sz,
    hash: t.hash || '',
  }));
  const file = path.join(outDir, `trades-${coin}-${Date.now()}.csv`);
  fs.writeFileSync(file, toCsv(rows, ['time', 'coin', 'side', 'price', 'size', 'hash']));
  return file;
}

module.exports = { exportTrades, toCsv };
