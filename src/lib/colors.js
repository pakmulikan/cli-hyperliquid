/**
 * ANSI color utilities - zero dependency terminal colors
 * FIX: supports color chaining without premature reset
 */

const ESC = '\x1b[';
const RESET = `${ESC}0m`;

// Strip trailing reset so outer style remains applied
const strip = (s) => String(s).replace(/\x1b\[0m$/, '');

const wrap = (code) => (s) => `${ESC}${code}m${strip(s)}${RESET}`;

const colors = {
  reset: RESET,

  // Styles
  bold: wrap('1'),
  dim: wrap('2'),
  italic: wrap('3'),
  underline: wrap('4'),
  blink: wrap('5'),
  inverse: wrap('7'),

  // Foreground colors
  black: wrap('30'),
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  blue: wrap('34'),
  magenta: wrap('35'),
  cyan: wrap('36'),
  white: wrap('37'),
  gray: wrap('90'),

  // Bright colors
  brightRed: wrap('91'),
  brightGreen: wrap('92'),
  brightYellow: wrap('93'),
  brightBlue: wrap('94'),
  brightMagenta: wrap('95'),
  brightCyan: wrap('96'),
  brightWhite: wrap('97'),

  // Background colors
  bgBlack: wrap('40'),
  bgRed: wrap('41'),
  bgGreen: wrap('42'),
  bgYellow: wrap('43'),
  bgBlue: wrap('44'),
  bgMagenta: wrap('45'),
  bgCyan: wrap('46'),
  bgWhite: wrap('47'),

  // 24-bit RGB
  rgb: (r, g, b) => wrap(`38;2;${r};${g};${b}`),
  bgRgb: (r, g, b) => wrap(`48;2;${r};${g};${b}`),

  // Trading theme
  profit:  wrap('38;2;0;255;136'),    // bright green
  loss:    wrap('38;2;255;82;82'),    // bright red
  neutral: wrap('38;2;180;180;180'),  // gray
  accent:  wrap('38;2;99;179;237'),   // light blue
  gold:    wrap('38;2;255;215;0'),    // gold
  purple:  wrap('38;2;178;102;255'),  // purple (whale)
  orange:  wrap('38;2;255;165;0'),    // orange (warning)

  // Backgrounds for status rows
  bgHeader: wrap('48;2;20;40;80'),    // dark blue bg
  bgRowA:   wrap('48;2;18;18;22'),    // subtle alt
  bgRowB:   wrap('48;2;24;24;30'),

  // Composite (bold + color) - single escape sequence
  header:  wrap('1;38;2;99;179;237'),
  warn:    wrap('1;38;2;255;165;0'),
  danger:  wrap('1;38;2;255;82;82'),

  // Strip ANSI (public)
  strip: (s) => String(s).replace(/\x1b\[[0-9;]*m/g, ''),
};

module.exports = colors;
