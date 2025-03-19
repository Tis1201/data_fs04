import winston from 'winston';

const dev = process.env.NODE_ENV !== 'production';

const logger = winston.createLogger({
    level: dev ? 'debug' : 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(({ level, message, timestamp, ...rest }) => {
            let logMessage = `${timestamp} ${level.toUpperCase()} [src/lib/server/logger.ts]: ${message}`;
            
            if (Object.keys(rest).length > 0) {
                // Convert objects to detailed string representation
                const details = Object.entries(rest).reduce((acc, [key, value]) => {
                    if (value && typeof value === 'object') {
                        // Handle nested objects and arrays
                        acc[key] = JSON.stringify(value, null, 2);
                    } else {
                        acc[key] = value;
                    }
                    return acc;
                }, {});
                
                logMessage += '\n' + JSON.stringify(details, null, 2);
            }
            
            return logMessage;
        })
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

export { logger };
