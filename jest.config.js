module.exports = {
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}'],
  coverageReporters: ['json', 'lcov', 'text'],
  verbose: true,
  coverageThreshold: {
    global: {
      statements: 96,
      branches: 87,
      functions: 97,
      lines: 96
    }
  }
};
