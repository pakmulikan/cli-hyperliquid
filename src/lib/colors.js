/**
 * ANSI color utilities - zero dependency terminal colors
 */

const ESC = '\x1b[';

const colors = {
  // Reset
  reset: `${ESC}0m`,

  // Styles
  bold: (str) => `${ESC}1m${str}${ESC}0m`,
  dim: (str) => `${ESC}2m${str}${ESC}0m`,
  italic: (str) => `${ESC}3m${str}${ESC}0m`,
  underline: (str) => `${ESC}4m${str}${ESC}0m`,
  blink: (str) => `${ESC}5m${str}${ESC}0m`,
  inverse: (str) => `${ESC}7m${str}${ESC}0m`,

  // Foreground colors
  black: (str) => `${ESC}30m${str}${ESC}0m`,
  red: (str) => `${ESC}31m${str}${ESC}0m`,
  green: (str) => `${ESC}32m${str}${ESC}0m`,
  yellow: (str) => `${ESC}33m${str}${ESC}0m`,
  blue: (str) => `${ESC}34m${str}${ESC}0m`,
  magenta: (str) => `${ESC}35m${str}${ESC}0m`,
  cyan: (str) => `${ESC}36m${str}${ESC}0m`,
  white: (str) => `${ESC}37m${str}${ESC}0m`,
  gray: (str) => `${ESC}90m${str}${ESC}0m`,

  // Bright colors
  brightRed: (str) => `${ESC}91m${str}${ESC}0m`,
  brightGreen: (str) => `${ESC}92m${str}${ESC}0m`,
  brightYellow: (str) => `${ESC}93m${str}${ESC}0m`,
  brightBlue: (str) => `${ESC}94m${str}${ESC}0m`,
  brightMagenta: (str) => `${ESC}95m${str}${ESC}0m`,
  brightCyan: (str) => `${ESC}96m${str}${ESC}0m`,
  brightWhite: (str) => `${ESC}97m${str}${ESC}0m`,

  // Background colors
  bgBlack: (str) => `${ESC}40m${str}${ESC}0m`,
  bgRed: (str) => `${ESC}41m${str}${ESC}0m`,
  bgGreen: (str) => `${ESC}42m${str}${ESC}0m`,
  bgYellow: (str) => `${ESC}43m${str}${ESC}0m`,
  bgBlue: (str) => `${ESC}44m${str}${ESC}0m`,
  bgMagenta: (str) => `${ESC}45m${str}${ESC}0m`,
  bgCyan: (str) => `${ESC}46m${str}${ESC}0m`,
  bgWhite: (str) => `${ESC}47m${str}${ESC}0m`,

  // 256 color
  rgb: (r, g, b) => (str) => `${ESC}38;2;${r};${g};${b}m${str}${ESC}0m`,
  bgRgb: (r, g, b) => (str) => `${ESC}48;2;${r};${g};${b}m${str}${ESC}0m`,

  // Trading specific
  profit: (str) => `${ESC}38;2;0;255;136m${str}${ESC}0m`,   // Bright green
  loss: (str) => `${ESC}38;2;255;82;82m${str}${ESC}0m`,     // Bright red
  neutral: (str) => `${ESC}38;2;180;180;180m${str}${ESC}0m`, // Gray
  accent: (str) => `${ESC}38;2;99;179;237m${str}${ESC}0m`,   // Light blue
  gold: (str) => `${ESC}38;2;255;215;0m${str}${ESC}0m`,      // Gold
  header: (str) => `${ESC}1m${ESC}38;2;99;179;237m${str}${ESC}0m`, // Bold blue
};

module.exports = colors;
