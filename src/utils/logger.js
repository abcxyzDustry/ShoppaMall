const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define log level based on environment
const level = () => {
    const env = process.env.NODE_ENV || 'development';
    return env === 'development' ? 'debug' : 'info';
};

// Define colors for each level
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Define log format
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`,
    ),
);

// Define log file path
const logDir = process.env.LOG_FILE 
    ? path.dirname(process.env.LOG_FILE)
    : 'logs';

const errorLogDir = process.env.ERROR_LOG_FILE
    ? path.dirname(process.env.ERROR_LOG_FILE)
    : 'logs';

// Ensure log directory exists
const fs = require('fs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}
if (!fs.existsSync(errorLogDir)) {
    fs.mkdirSync(errorLogDir, { recursive: true });
}

// Define transports
const transports = [
    // Console transport
    new winston.transports.Console(),
    
    // General log file transport
    new winston.transports.File({
        filename: process.env.LOG_FILE || 'logs/app.log',
        level: 'info',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }),
    
    // Error log file transport
    new winston.transports.File({
        filename: process.env.ERROR_LOG_FILE || 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }),
];

// Create logger instance
const logger = winston.createLogger({
    level: level(),
    levels,
    format,
    transports,
    exceptionHandlers: [
        new winston.transports.File({
            filename: 'logs/exceptions.log',
        }),
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: 'logs/rejections.log',
        }),
    ],
});

// Create a stream object for morgan
logger.stream = {
    write: (message) => logger.http(message.trim()),
};

module.exports = logger;
