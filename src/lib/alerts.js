/**
 * Price alert engine
 * Alert shape: { id, coin, op: '>' | '<', price, triggered, createdAt }
 */

function check(alerts, mids) {
  const triggered = [];
  if (!alerts || !mids) return triggered;
  for (const a of alerts) {
    if (a.triggered) continue;
    const price = parseFloat(mids[a.coin]);
    if (!isFinite(price)) continue;
    if ((a.op === '>' && price >= a.price) || (a.op === '<' && price <= a.price)) {
      a.triggered = true;
      a.triggeredAt = Date.now();
      a.triggeredPrice = price;
      triggered.push(a);
    }
  }
  return triggered;
}

function add(alerts, coin, op, price) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  alerts.push({ id, coin: coin.toUpperCase(), op, price: parseFloat(price), triggered: false, createdAt: Date.now() });
  return id;
}

function remove(alerts, id) {
  const idx = alerts.findIndex(a => a.id === id);
  if (idx >= 0) alerts.splice(idx, 1);
}

function parseExpression(expr) {
  // "BTC > 70000" or "ETH<3000"
  const m = expr.match(/^\s*([A-Za-z0-9]+)\s*(>|<)\s*([0-9.]+)\s*$/);
  if (!m) return null;
  return { coin: m[1].toUpperCase(), op: m[2], price: parseFloat(m[3]) };
}

module.exports = { check, add, remove, parseExpression };
