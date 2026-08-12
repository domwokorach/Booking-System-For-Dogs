module.exports = {
  testEnvironment: 'node',
  watchman: false,
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  roots: ['<rootDir>/tests'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          esModuleInterop: true,
          isolatedModules: true,
          types: ['jest', 'vite/client'],
        },
      },
    ],
  },
};
