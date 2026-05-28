const COLOR_DIM = '\x1b[2m';
const COLOR_RESET = '\x1b[0m';
const COLOR_YELLOW = '\x1b[33m';
const COLOR_RED = '\x1b[31m';
const COLOR_GREEN = '\x1b[32m';

const log = (...args: unknown[]) => {
  console.debug(...args);
};

const info = (...args: unknown[]) => {
  log('▶️', ...args);
};

const success = (...args: unknown[]) => {
  const lines = ['✅', COLOR_GREEN, ...args, COLOR_RESET];
  log(...lines);
};

const warn = (...args: unknown[]) => {
  const lines = ['⚠️', COLOR_YELLOW, ...args, COLOR_RESET];
  log(...lines);
};

const note = (...args: unknown[]) => {
  const lines = [COLOR_DIM, ...args, COLOR_RESET];
  log(...lines);
};

const error = (...args: unknown[]) => {
  const lines = ['🔴', COLOR_RED, ...args, COLOR_RESET];
  log(...lines);
};

const errorDetail = (...args: unknown[]) => {
  const lines = [`   ${COLOR_RED}↳`, ...args, COLOR_RESET];
  log(...lines);
};

const formatLink = (name: string | number, url: string) =>
  `\x1b]8;;${url}\x1b\\${name}\x1b]8;;\x1b\\`;

export {log, info, warn, note, error, errorDetail, success, formatLink};
