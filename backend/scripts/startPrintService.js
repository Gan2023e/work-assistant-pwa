#!/usr/bin/env node

/**
 * 打印服务启动脚本
 * 使用方法：node startPrintService.js [端口号]
 */

const PrintService = require('../utils/printService');

// 从命令行参数获取端口号，默认3001
const port = process.argv[2] ? parseInt(process.argv[2]) : 3001;

console.log('🚀 启动本地打印服务...');
console.log(`📍 服务端口: ${port}`);
console.log('🔧 确保此服务在需要打印的电脑上运行');
console.log('');

try {
    const printService = new PrintService(port);
    printService.start();
    
    // 优雅退出处理
    process.on('SIGINT', () => {
        console.log('\n🛑 收到退出信号，正在关闭打印服务...');
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n🛑 收到终止信号，正在关闭打印服务...');
        process.exit(0);
    });
    
} catch (error) {
    console.error('❌ 启动打印服务失败:', error.message);
    process.exit(1);
} 