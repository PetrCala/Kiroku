/* eslint-disable no-console */

/**
 * Mocks a console method to suppress output during tests.
 * @param method The console method to mock (e.g., 'log', 'warn', 'error').
 */
const mockConsoleMethod = (method: 'log' | 'warn' | 'error') => {
  const original = console[method];
  console[method] = (...args) => {
    if (process.env.JEST_SUPPRESS_LOGS !== 'false') {
      return; // Suppress output
    }
    original(...args); // Output if explicitly allowed
  };
};

/**
 * Mocks multiple console methods at once.
 * By default, it mocks 'log', 'warn', and 'error'.
 * @param methods Optional array of console methods to mock.
 */
const mockConsole = (
  methods: Array<'log' | 'warn' | 'error'> = ['log', 'warn', 'error'],
) => {
  methods.forEach(mockConsoleMethod);
};

export default mockConsole;
