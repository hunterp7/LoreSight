module.exports = {
  apps: [
    {
      name: 'loresight-server',
      cwd: '/Users/Hunter/Documents/Codex/StoryFrame',
      script: '/opt/homebrew/bin/npm',
      args: 'run dev',
      interpreter: 'none',
      autorestart: true,
      restart_delay: 1000,
      max_restarts: 20,
      watch: false,
      env: {
        PORT: '8787',
        PATH: '/opt/homebrew/bin:/usr/bin:/bin'
      }
    }
  ]
};
