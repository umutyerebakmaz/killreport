import winston from 'winston';

// Log levels: error, warn, info, http, verbose, debug, silly
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

const level = () => {
    // Use LOG_LEVEL if set, otherwise fallback to NODE_ENV logic
    if (process.env.LOG_LEVEL) {
        return process.env.LOG_LEVEL;
    }

    const env = process.env.NODE_ENV || 'development';
    const isDevelopment = env === 'development';
    return isDevelopment ? 'debug' : 'info';
};

const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'cyan',
};

winston.addColors(colors);

const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf((info) => {
        const { timestamp, level, message, ...meta } = info;
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level}: ${message}${metaStr}`;
    })
);

// Console her zaman, file sadece production'da
const transports: winston.transport[] = [
    new winston.transports.Console(),
];

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
    transports.push(
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/all.log' })
    );
}

const logger = winston.createLogger({
    level: level(),
    levels,
    format,
    transports,
});

export default logger;
