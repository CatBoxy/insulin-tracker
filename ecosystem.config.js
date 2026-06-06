// Non-secret config only. Secrets are in /home/deploy/apps/glycofit/.env on the server.
// This file is NOT synced during deploy — the server copy is the source of truth.
module.exports = {
  apps: [
    {
      name: "glycofit",
      script: "server.js",
      cwd: "/home/deploy/apps/glycofit",
      env: {
        NODE_ENV: "production",
        PORT: 3008,
        HOSTNAME: "127.0.0.1",
      },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "500M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/home/deploy/logs/glycofit-error.log",
      out_file: "/home/deploy/logs/glycofit-out.log",
    },
  ],
};
