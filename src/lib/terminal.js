/**
 * Terminal utilities with double-buffered rendering to eliminate flicker
 */

const ESC = '\x1b[';

// In-memory frame buffer batches writes and flushes as a single stdout call
class FrameBuffer {
  constructor() {
    this.chunks = [];
  }
  write(text) { this.chunks.push(text); }
  at(x, y, text) {
    this.chunks.push(`${ESC}${y + 1};${x + 1}H${text}`);
  }
  flush() {
    if (this.chunks.length === 0) return;
    process.stdout.write(this.chunks.join(''));
    this.chunks = [];
  }
}

const terminal = {
  FrameBuffer,

  // Cursor control
  cursorTo: (x, y) => process.stdout.write(`${ESC}${y + 1};${x + 1}H`),
  cursorHide: () => process.stdout.write(`${ESC}?25l`),
  cursorShow: () => process.stdout.write(`${ESC}?25h`),

  // Screen control
  clearScreen: () => process.stdout.write(`${ESC}2J${ESC}H`),
  clearLine: () => process.stdout.write(`${ESC}2K`),

  // Alternate screen buffer (like vim/less)
  enterAltScreen: () => process.stdout.write(`${ESC}?1049h`),
  exitAltScreen: () => process.stdout.write(`${ESC}?1049l`),

  // Terminal bell (for alerts)
  bell: () => process.stdout.write('\x07'),

  // Mouse support (optional)
  enableMouse: () => process.stdout.write(`${ESC}?1000h${ESC}?1006h`),
  disableMouse: () => process.stdout.write(`${ESC}?1000l${ESC}?1006l`),

  getSize: () => ({
    width: process.stdout.columns || 120,
    height: process.stdout.rows || 40
  }),

  // Single-character write (legacy direct-to-stdout path)
  writeAt: (x, y, text) => {
    process.stdout.write(`${ESC}${y + 1};${x + 1}H${text}`);
  },

  // Draw a box - returns string for buffer, or writes to buffer if provided
  box: (fb, x, y, width, height, style = 'rounded') => {
    if (width < 2 || height < 2) return;
    const chars = style === 'double'
      ? { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' }
      : style === 'single'
      ? { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' }
      : style === 'thick'
      ? { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' }
      : { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' };

    fb.at(x, y, chars.tl + chars.h.repeat(width - 2) + chars.tr);
    for (let i = 1; i < height - 1; i++) {
      fb.at(x, y + i, chars.v);
      fb.at(x + width - 1, y + i, chars.v);
    }
    fb.at(x, y + height - 1, chars.bl + chars.h.repeat(width - 2) + chars.br);
  },

  // Clear a rectangular region (fill with spaces)
  clearRect: (fb, x, y, width, height) => {
    const blank = ' '.repeat(Math.max(0, width));
    for (let i = 0; i < height; i++) fb.at(x, y + i, blank);
  },

  // Progress bar
  progressBar: (value, max, width, opts = {}) => {
    const pct = Math.min(1, Math.max(0, value / max));
    const filled = Math.round(pct * width);
    const fillChar = opts.fillChar || '█';
    const emptyChar = opts.emptyChar || '░';
    return fillChar.repeat(filled) + emptyChar.repeat(Math.max(0, width - filled));
  },

  // Dual-sided meter (e.g., bid/ask imbalance)
  meter: (leftVal, rightVal, width) => {
    const total = leftVal + rightVal;
    if (total === 0) return '─'.repeat(width);
    const leftW = Math.round((leftVal / total) * width);
    const rightW = width - leftW;
    return { left: '█'.repeat(leftW), right: '█'.repeat(rightW), leftPct: leftVal / total };
  },

  // Sparkline
  sparkline: (data, width = 20) => {
    const chars = '▁▂▃▄▅▆▇█';
    if (!data || data.length === 0) return '';
    const slice = data.slice(-width);
    const min = Math.min(...slice);
    const max = Math.max(...slice);
    const range = max - min || 1;
    return slice.map(v => {
      const idx = Math.round(((v - min) / range) * (chars.length - 1));
      return chars[idx];
    }).join('');
  },

  // Strip ANSI for length calculation
  stripAnsi: (str) => String(str).replace(/\x1b\[[0-9;]*m/g, ''),

  // Visible length (accounting for ANSI)
  visLen: (str) => terminal.stripAnsi(str).length,

  // Pad considering ANSI codes
  padEnd: (str, len, char = ' ') => {
    const visLen = terminal.visLen(str);
    return str + char.repeat(Math.max(0, len - visLen));
  },

  padStart: (str, len, char = ' ') => {
    const visLen = terminal.visLen(str);
    return char.repeat(Math.max(0, len - visLen)) + str;
  },

  center: (str, len, char = ' ') => {
    const visLen = terminal.visLen(str);
    const pad = Math.max(0, len - visLen);
    const left = Math.floor(pad / 2);
    const right = pad - left;
    return char.repeat(left) + str + char.repeat(right);
  },

  // Truncate visible text to width (preserves ANSI)
  truncate: (str, width) => {
    if (terminal.visLen(str) <= width) return str;
    const plain = terminal.stripAnsi(str);
    return plain.slice(0, Math.max(0, width - 1)) + '…';
  },

  // Format large numbers: 1.2M, 3.4K, etc.
  formatCompact: (n) => {
    const abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toFixed(2);
  },

  // Format price with dynamic decimals
  formatPrice: (n) => {
    if (!isFinite(n) || n === 0) return '—';
    const abs = Math.abs(n);
    if (abs >= 10000) return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    if (abs >= 100) return n.toFixed(2);
    if (abs >= 1) return n.toFixed(3);
    if (abs >= 0.01) return n.toFixed(4);
    return n.toFixed(6);
  },
};

module.exports = terminal;
