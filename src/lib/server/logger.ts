import winston from 'winston';
import path from 'path';

const dev = process.env.NODE_ENV !== 'production';

// ANSI color codes optimized for light theme visibility
const colors = {
  // Text styles
  reset: '\x1b[0m',
  bright: '\x1b[1m',  // Bold
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  reverse: '\x1b[7m',
  
  // Darker, more saturated colors for better light theme visibility
  black: '\x1b[30m',
  red: '\x1b[31;1m',       // Bright red
  green: '\x1b[32;1m',     // Bright green
  yellow: '\x1b[33;1m',    // Bright yellow
  blue: '\x1b[34;1m',      // Bright blue
  magenta: '\x1b[35;1m',   // Bright magenta
  cyan: '\x1b[36;1m',      // Bright cyan
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Darker shades for better contrast
  darkRed: '\x1b[31m',     // Standard red
  darkGreen: '\x1b[32m',   // Standard green
  darkBlue: '\x1b[34m',    // Standard blue
  darkCyan: '\x1b[36m',    // Standard cyan
  
  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
};

// Force enable console logging
const consoleLog = console.log;
const consoleError = console.error;
const consoleWarn = console.warn;
const consoleInfo = console.info;

// Create a custom logger function that includes the calling file information
const createLogger = (defaultFilePath: string = 'unknown') => {
    // Helper to extract caller information
    const getCallerInfo = () => {
        const err = new Error();
        const stack = err.stack?.split('\n');
        if (!stack || stack.length < 4) return { filePath: defaultFilePath };
        
        // The 4th line of the stack trace should be the caller of our logger method
        const callerLine = stack[3];
        const match = callerLine.match(/\s+at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
        
        if (match) {
            const [, , filePath, lineNumber] = match;
            // Convert absolute path to relative project path if possible
            const projectPath = filePath.includes('/src/') 
                ? 'src/' + filePath.split('/src/')[1]
                : path.basename(filePath);
            
            return { filePath: projectPath, lineNumber };
        }
        
        return { filePath: defaultFilePath };
    };

    // Create a custom format for the Winston logger
    const customFormat = winston.format.printf(({ level, message, timestamp, meta }) => {
        const callerInfo = meta || {};
        const fileInfo = callerInfo.filePath ? `${callerInfo.filePath}${callerInfo.lineNumber ? `:${callerInfo.lineNumber}` : ''}` : defaultFilePath;
        
        // Format based on log level
        let formattedMessage = '';
        const ts = timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19);
        
        switch(level) {
            case 'debug':
                formattedMessage = `${colors.gray}${ts}${colors.reset} ${colors.darkBlue}[DEBUG]${colors.reset} ${colors.darkCyan}[${fileInfo}]${colors.reset} ${message}`;
                break;
            case 'info':
                formattedMessage = `${colors.gray}${ts}${colors.reset} ${colors.darkGreen}[INFO]${colors.reset} ${colors.darkCyan}[${fileInfo}]${colors.reset} ${message}`;
                break;
            case 'warn':
                formattedMessage = `${colors.gray}${ts}${colors.reset} ${colors.yellow}[WARN]${colors.reset} ${colors.darkCyan}[${fileInfo}]${colors.reset} ${message}`;
                break;
            case 'error':
                formattedMessage = `${colors.gray}${ts}${colors.reset} ${colors.darkRed}[ERROR]${colors.reset} ${colors.darkCyan}[${fileInfo}]${colors.reset} ${message}`;
                break;
            default:
                formattedMessage = `${colors.gray}${ts}${colors.reset} ${colors.darkGreen}[${level.toUpperCase()}]${colors.reset} ${colors.darkCyan}[${fileInfo}]${colors.reset} ${message}`;
        }
        
        return formattedMessage;
    });

    // Create Winston logger with custom format
    const winstonLogger = winston.createLogger({
        level: process.env.LOG_LEVEL || (dev ? 'debug' : 'info'),
        format: winston.format.combine(
            winston.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss'
            }),
            customFormat
        ),
        transports: [
            new winston.transports.Console()
        ]
    });

    // Return enhanced logger with automatic caller detection
    return {
        debug: (message: string, meta: Record<string, any> = {}) => {
            const callerInfo = getCallerInfo();
            winstonLogger.debug(message, { meta: { ...callerInfo, ...meta } });
        },
        info: (message: string, meta: Record<string, any> = {}) => {
            const callerInfo = getCallerInfo();
            winstonLogger.info(message, { meta: { ...callerInfo, ...meta } });
        },
        warn: (message: string, meta: Record<string, any> = {}) => {
            const callerInfo = getCallerInfo();
            winstonLogger.warn(message, { meta: { ...callerInfo, ...meta } });
        },
        error: (message: string, meta: Record<string, any> = {}) => {
            const callerInfo = getCallerInfo();
            winstonLogger.error(message, { meta: { ...callerInfo, ...meta } });
        }
    };
};

// Create default logger instance
const logger = createLogger('src/lib/server/logger.ts');

export { logger, createLogger };
