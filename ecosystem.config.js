// Non-secret config only. Secrets are in /home/deploy/apps/nivelo/.env on the server.
// This file is NOT synced during deploy — the server copy is the source of truth.
module.exports = {
  apps: [
    {
      name: "nivelo",
      script: "server.js",
      cwd: "/home/deploy/apps/nivelo",
      env: {
        NODE_ENV: "production",
        PORT: 3008,
        HOSTNAME: "127.0.0.1",
      },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "500M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/home/deploy/logs/nivelo-error.log",
      out_file: "/home/deploy/logs/nivelo-out.log",
    },
  ],
};
