/**
 * PM2 process file for TaraWorld (Next.js production).
 * Usage: pm2 start ecosystem.config.js
 */
module.exports = {
  apps: [
    {
      name: "taraworld",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Load secrets from .env.local on the host (do not commit).
      // PM2 does not auto-load dotenv; export vars in the shell or use:
      //   require('dotenv').config({ path: '.env.local' })
      // Prefer exporting via systemd EnvironmentFile or `pm2 ecosystem` + env_file tooling.
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
