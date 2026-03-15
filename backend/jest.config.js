/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/controllers/postController.ts',
    'src/controllers/authController.ts',
    'src/controllers/userController.ts',
    'src/controllers/chatController.ts',
    'src/controllers/voiceController.ts',
    'src/controllers/notificationController.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    },
  },
  coveragePathIgnorePatterns: [],
};
