const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8099',
    channel: process.env.PW_CHANNEL || 'chrome',
    acceptDownloads: true,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo'
  },
  webServer: process.env.BASE_URL ? undefined : {
    command: 'node tests/server.js',
    env: { PORT: '8099' },
    url: 'http://localhost:8099',
    reuseExistingServer: true
  }
});
