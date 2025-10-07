// Global test setup

// Mock heavy native modules that are not needed in unit tests
jest.mock('canvas', () => ({
  createCanvas: () => ({
    getContext: () => ({
      drawImage: () => {},
      getImageData: () => ({ data: [] }),
      putImageData: () => {},
      fillRect: () => {},
      clearRect: () => {}
    })
  }),
  loadImage: () => Promise.resolve({})
}), { virtual: true });

// Extend Jest matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});
