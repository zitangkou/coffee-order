module.exports = {
  apps: [
    {
      name: "coffee-os-server",
      script: "node --import tsx src/index.ts",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
