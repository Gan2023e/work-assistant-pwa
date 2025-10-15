// 日志管理工具
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// 日志级别
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// 当前日志级别（生产环境只显示WARN和ERROR）
const currentLogLevel = isProduction ? LogLevel.WARN : LogLevel.DEBUG;

class Logger {
  private shouldLog(level: LogLevel): boolean {
    return level >= currentLogLevel;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(`🔍 [DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(`ℹ️ [INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`⚠️ [WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`❌ [ERROR] ${message}`, ...args);
    }
  }

  // 成功日志
  success(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(`✅ [SUCCESS] ${message}`, ...args);
    }
  }

  // 网络请求日志
  network(message: string, ...args: any[]): void {
    if (isDevelopment && this.shouldLog(LogLevel.DEBUG)) {
      console.log(`🌐 [NETWORK] ${message}`, ...args);
    }
  }

  // 模板相关日志
  template(message: string, ...args: any[]): void {
    if (isDevelopment && this.shouldLog(LogLevel.DEBUG)) {
      console.log(`📋 [TEMPLATE] ${message}`, ...args);
    }
  }

  // 数据库相关日志
  database(message: string, ...args: any[]): void {
    if (isDevelopment && this.shouldLog(LogLevel.DEBUG)) {
      console.log(`🗄️ [DATABASE] ${message}`, ...args);
    }
  }

  // 用户操作日志
  user(message: string, ...args: any[]): void {
    if (isDevelopment && this.shouldLog(LogLevel.INFO)) {
      console.log(`👤 [USER] ${message}`, ...args);
    }
  }
}

// 导出单例实例
export const logger = new Logger();

// 导出便捷方法
export const { debug, info, warn, error, success, network, template, database, user } = logger;

// 默认导出
export default logger;
