module.exports = {
    apps: [{
        name: 'shoppamall',
        script: 'server.js',
        instances: 'max',
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'development',
            PORT: 3000
        },
        env_production: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        watch: false,
        max_memory_restart: '1G',
        error_file: 'logs/pm2/error.log',
        out_file: 'logs/pm2/out.log',
        log_file: 'logs/pm2/combined.log',
        time: true,
        merge_logs: true,
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        kill_timeout: 5000,
        listen_timeout: 5000,
        shutdown_with_message: true,
        wait_ready: true,
        max_restarts: 10,
        restart_delay: 5000,
        autorestart: true
    }]
};
