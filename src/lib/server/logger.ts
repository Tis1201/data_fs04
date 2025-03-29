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
    const winstonLogger = winston.createLogger({
        level: dev ? 'debug' : 'info',
        format: winston.format.combine(
            winston.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss'
            }),
            winston.format.printf(({ level, message, timestamp, filePath, lineNumber, ...rest }) => {
                // Use provided file path or default
                const fileInfo = filePath ? `${filePath}${lineNumber ? `:${lineNumber}` : ''}` : defaultFilePath;
                
                // Format: date | time | file | level : message
                let logMessage = `${timestamp} | ${fileInfo} | ${level.toUpperCase()} : ${message}`;
                
                // Add any additional data as a simple string if present
                if (Object.keys(rest).length > 0) {
                    const details = Object.entries(rest)
                        .map(([key, value]) => {
                            if (value && typeof value === 'object') {
                                return `${key}=${JSON.stringify(value)}`;
                            }
                            return `${key}=${value}`;
                        })
                        .join(' ');
                    
                    if (details) {
                        logMessage += ` | ${details}`;
                    }
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

    // Return enhanced logger with automatic caller detection and direct console output
    return {
        debug: (message: string, meta: Record<string, any> = {}) => {
            const callerInfo = getCallerInfo();
            winstonLogger.debug(message, { ...callerInfo, ...meta });
            // Log Guru style formatting
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
            const fileInfo = callerInfo.filePath + (callerInfo.lineNumber ? `:${callerInfo.lineNumber}` : '');
            consoleLog(`${colors.gray}${timestamp}${colors.reset} ${colors.darkBlue}[DEBUG]${colors.reset} ${colors.darkCyan}[${fileInfo}]${colors.reset} ${message}`);
        },
        info: (message: string, meta: Record<string, any> = {}) => {
            const callerInfo = getCallerInfo();
            winstonLogger.info(message, { ...callerInfo, ...meta });
            // Log Guru style formatting
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
            const fileInfo = callerInfo.filePath + (callerInfo.lineNumber ? `:${callerInfo.lineNumber}` : '');
            consoleInfo(`${colors.gray}${timestamp}${colors.reset} ${colors.darkGreen}[INFO]${colors.reset} ${colors.darkCyan}[${fileInfo}]${colors.reset} ${message}`);
        },
        warn: (message: string, meta: Record<string, any> = {}) => {
            const callerInfo = getCallerInfo();
            winstonLogger.warn(message, { ...callerInfo, ...meta });
            // Log Guru style formatting
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
            const fileInfo = callerInfo.filePath + (callerInfo.lineNumber ? `:${callerInfo.lineNumber}` : '');
            consoleWarn(`${colors.gray}${timestamp}${colors.reset} ${colors.yellow}[WARN]${colors.reset} ${colors.darkCyan}[${fileInfo}]${colors.reset} ${message}`);
        },
        error: (message: string, meta: Record<string, any> = {}) => {
            const callerInfo = getCallerInfo();
            winstonLogger.error(message, { ...callerInfo, ...meta });
            // Log Guru style formatting
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
            const fileInfo = callerInfo.filePath + (callerInfo.lineNumber ? `:${callerInfo.lineNumber}` : '');
            consoleError(`${colors.gray}${timestamp}${colors.reset} ${colors.darkRed}[ERROR]${colors.reset} ${colors.darkCyan}[${fileInfo}]${colors.reset} ${message}`);
        }
    };
};

// Create default logger instance
const logger = createLogger('src/lib/server/logger.ts');

export { logger, createLogger };
