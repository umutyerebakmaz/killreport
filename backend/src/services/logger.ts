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
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'white',
  http: 'magenta',
  debug: 'cyan', // indigo benzeri
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => {
    const message = info.message;
    const meta = info.metadata ? JSON.stringify(info.metadata) : '';
    return `${info.timestamp} ${info.level}: ${message}${meta ? ' ' + meta : ''}`;
  }),
  winston.format.colorize({ all: true }),
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
