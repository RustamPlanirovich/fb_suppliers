// pm2-конфиг. Именно .cjs: пакет с "type": "module" не даст pm2 прочитать .js-конфиг.
module.exports = {
  apps: [
    {
      name: 'fpsuppliers',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      kill_timeout: 12000,
      env: { NODE_ENV: 'development', LOG_LEVEL: 'debug' },
      env_production: { NODE_ENV: 'production', LOG_LEVEL: 'info' },
    },
  ],
};
