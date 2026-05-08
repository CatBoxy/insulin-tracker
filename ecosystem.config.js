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
        DATABASE_URL: "postgresql://insulin_tracker:whdJFH760XtEdQAENCXShqMLMS3n42D0@localhost:5432/insulin_tracker",
        JWT_SECRET: "znbnNSHQ3ug6L93ym+jXt1KSmT4/sTsYGvt4ktQMl1Y=",
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
