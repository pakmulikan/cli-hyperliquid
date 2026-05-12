/**
 * Terminal utilities - raw terminal manipulation
 */

const ESC = '\x1b[';

const terminal = {
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
  
  // Get terminal size
  getSize: () => ({
    width: process.stdout.columns || 120,
    height: process.stdout.rows || 40
  }),

  // Write at position
  writeAt: (x, y, text) => {
    process.stdout.write(`${ESC}${y + 1};${x + 1}H${text}`);
  },

  // Draw horizontal line
  hLine: (x, y, width, char = '─') => {
    terminal.writeAt(x, y, char.repeat(width));
  },

  // Draw vertical line
  vLine: (x, y, height, char = '│') => {
    for (let i = 0; i < height; i++) {
      terminal.writeAt(x, y + i, char);
    }
  },

  // Draw a box
  box: (x, y, width, height, title = '', style = 'single') => {
    const chars = style === 'double' 
      ? { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' }
      : style === 'rounded'
      ? { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' }
      : { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' };

    // Top border
    let top = chars.tl + chars.h.repeat(width - 2) + chars.tr;
    if (title) {
      const titleStr = ` ${title} `;
      const pos = 2;
      top = chars.tl + chars.h.repeat(pos) + titleStr + chars.h.repeat(width - 2 - pos - titleStr.length) + chars.tr;
    }
    terminal.writeAt(x, y, top);

    // Sides
    for (let i = 1; i < height - 1; i++) {
      terminal.writeAt(x, y + i, chars.v + ' '.repeat(width - 2) + chars.v);
    }

    // Bottom border
    terminal.writeAt(x, y + height - 1, chars.bl + chars.h.repeat(width - 2) + chars.br);
  },

  // Progress bar
  progressBar: (value, max, width, filledChar = '█', emptyChar = '░') => {
    const pct = Math.min(1, Math.max(0, value / max));
    const filled = Math.round(pct * width);
    return filledChar.repeat(filled) + emptyChar.repeat(width - filled);
  },

  // Sparkline mini chart
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

  // Strip ANSI codes for length calculation
  stripAnsi: (str) => str.replace(/\x1b\[[0-9;]*m/g, ''),

  // Pad string considering ANSI codes
  padEnd: (str, len, char = ' ') => {
    const visLen = terminal.stripAnsi(str).length;
    return str + char.repeat(Math.max(0, len - visLen));
  },

  padStart: (str, len, char = ' ') => {
    const visLen = terminal.stripAnsi(str).length;
    return char.repeat(Math.max(0, len - visLen)) + str;
  },

  center: (str, len, char = ' ') => {
    const visLen = terminal.stripAnsi(str).length;
    const pad = Math.max(0, len - visLen);
    const left = Math.floor(pad / 2);
    const right = pad - left;
    return char.repeat(left) + str + char.repeat(right);
  }
};

module.exports = terminal;
