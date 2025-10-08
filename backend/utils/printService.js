const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const os = require('os');

/**
 * 本地打印服务 - 运行在本地3001端口
 * 用于网页调用本地打印机
 */
class PrintService {
    constructor(port = 3001) {
        this.port = port;
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors({
            origin: ['http://localhost:3000', process.env.FRONTEND_URL || 'https://work-assistant-pwa.netlify.app'],
            methods: ['GET', 'POST'],
            credentials: true
        }));
        this.app.use(express.json());
    }

    setupRoutes() {
        // 健康检查
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'OK', 
                service: '打印服务',
                platform: os.platform(),
                timestamp: new Date().toISOString()
            });
        });

        // 获取可用打印机列表
        this.app.get('/printers', this.getPrinters.bind(this));
        
        // 打印标签
        this.app.post('/print-label', this.printLabel.bind(this));
        
        // 测试打印
        this.app.post('/test-print', this.testPrint.bind(this));
    }

    // 获取系统打印机列表
    async getPrinters(req, res) {
        try {
            const platform = os.platform();
            let command;
            
            if (platform === 'win32') {
                command = 'wmic printer get name,status /format:csv';
            } else if (platform === 'darwin') {
                command = 'lpstat -p';
            } else {
                command = 'lpstat -p';
            }
            
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error('获取打印机列表失败:', error);
                    return res.status(500).json({
                        code: 1,
                        message: '获取打印机列表失败',
                        error: error.message
                    });
                }
                
                const printers = this.parsePrinters(stdout, platform);
                res.json({
                    code: 0,
                    message: '获取成功',
                    data: {
                        platform: platform,
                        printers: printers
                    }
                });
            });
        } catch (error) {
            res.status(500).json({
                code: 1,
                message: '获取打印机失败',
                error: error.message
            });
        }
    }

    // 解析打印机列表
    parsePrinters(output, platform) {
        const printers = [];
        
        if (platform === 'win32') {
            const lines = output.split('\n');
            for (const line of lines) {
                if (line.includes(',') && !line.includes('Name,Status')) {
                    const parts = line.split(',');
                    if (parts.length >= 2 && parts[1].trim()) {
                        printers.push({
                            name: parts[1].trim(),
                            status: parts[2] ? parts[2].trim() : 'Unknown'
                        });
                    }
                }
            }
        } else {
            // Linux/macOS
            const lines = output.split('\n');
            for (const line of lines) {
                if (line.includes('printer')) {
                    const match = line.match(/printer\s+(\S+)/);
                    if (match) {
                        printers.push({
                            name: match[1],
                            status: line.includes('disabled') ? 'Disabled' : 'Ready'
                        });
                    }
                }
            }
        }
        
        return printers;
    }

    // 打印标签
    async printLabel(req, res) {
        try {
            const { labelData, printerName, printType = 'html' } = req.body;
            
            if (!labelData) {
                return res.status(400).json({
                    code: 1,
                    message: '打印数据不能为空'
                });
            }
            
            console.log('🖨️ 收到打印请求:', {
                printer: printerName,
                type: printType,
                recordId: labelData.recordId
            });
            
            let printCommand;
            
            if (printType === 'zpl') {
                // ZPL格式 - 适用于斑马打印机
                const zplCode = this.generateZPL(labelData);
                printCommand = this.createZPLPrintCommand(zplCode, printerName);
            } else {
                // HTML格式 - 适用于普通打印机
                const htmlContent = this.generateHTML(labelData);
                printCommand = this.createHTMLPrintCommand(htmlContent, printerName);
            }
            
            exec(printCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error('打印失败:', error);
                    return res.status(500).json({
                        code: 1,
                        message: '打印失败',
                        error: error.message
                    });
                }
                
                console.log('✅ 打印成功:', labelData.recordId);
                res.json({
                    code: 0,
                    message: '打印成功',
                    data: {
                        recordId: labelData.recordId,
                        printer: printerName,
                        type: printType
                    }
                });
            });
            
        } catch (error) {
            console.error('打印服务错误:', error);
            res.status(500).json({
                code: 1,
                message: '打印服务错误',
                error: error.message
            });
        }
    }

    // 生成ZPL代码
    generateZPL(labelData) {
        return `
^XA
^LH30,30
^FO50,50^ADN,36,20^FD外箱单^FS
^FO50,100^ADN,18,10^FD记录号: ${labelData.recordId}^FS
^FO50,130^ADN,18,10^FDSKU: ${labelData.sku}^FS
^FO50,160^ADN,18,10^FD数量: ${labelData.quantity}件/${labelData.boxes}箱^FS
^FO50,190^ADN,18,10^FD目的地: ${labelData.country}^FS
^FO50,220^ADN,18,10^FD操作员: ${labelData.operator}^FS
^FO50,250^ADN,18,10^FD打包员: ${labelData.packer || ''}^FS
^FO50,280^ADN,18,10^FD时间: ${new Date(labelData.createTime).toLocaleString()}^FS
${labelData.boxType === '混合箱' ? `^FO50,310^ADN,18,10^FD混合箱: ${labelData.mixBoxNum}^FS` : ''}
^FO50,350^BY3^BCN,100,Y,N,N^FD${labelData.barcode}^FS
^XZ
        `.trim();
    }

    // 生成HTML内容
    generateHTML(labelData) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>外箱单 - ${labelData.recordId}</title>
    <style>
        @page { 
            size: 10cm 7cm; 
            margin: 0; 
        }
        @media print {
            body { 
                font-family: Arial, sans-serif; 
                font-size: 12px; 
                margin: 5mm; 
                color: black;
                background: white;
            }
            .no-print { display: none; }
        }
        body { 
            font-family: Arial, sans-serif; 
            font-size: 12px; 
            margin: 5mm; 
        }
        .header { 
            text-align: center; 
            font-weight: bold; 
            font-size: 16px;
            margin-bottom: 3mm; 
            border-bottom: 2px solid #000;
            padding-bottom: 2mm;
        }
        .content { 
            line-height: 1.6; 
        }
        .content div {
            margin-bottom: 1mm;
        }
        .barcode { 
            font-family: 'Libre Barcode 128', monospace; 
            font-size: 24px; 
            text-align: center; 
            margin-top: 3mm;
            padding: 2mm;
            border: 1px solid #000;
        }
        .qr-placeholder {
            text-align: center;
            font-size: 10px;
            margin-top: 2mm;
        }
    </style>
</head>
<body>
    <div class="header">外箱单</div>
    <div class="content">
        <div><strong>记录号:</strong> ${labelData.recordId}</div>
        <div><strong>SKU:</strong> ${labelData.sku}</div>
        <div><strong>数量:</strong> ${labelData.quantity}件/${labelData.boxes}箱</div>
        <div><strong>目的地:</strong> ${labelData.country}</div>
        <div><strong>操作员:</strong> ${labelData.operator}</div>
        ${labelData.packer ? `<div><strong>打包员:</strong> ${labelData.packer}</div>` : ''}
        <div><strong>时间:</strong> ${new Date(labelData.createTime).toLocaleString()}</div>
        ${labelData.boxType === '混合箱' ? `<div><strong>混合箱:</strong> ${labelData.mixBoxNum}</div>` : ''}
    </div>
    <div class="barcode">${labelData.barcode}</div>
    <div class="qr-placeholder">
        QR: ${labelData.recordId}
    </div>
    
    <script>
        // 自动打印
        window.onload = function() {
            setTimeout(function() {
                window.print();
                window.close();
            }, 500);
        };
    </script>
</body>
</html>
        `.trim();
    }

    // 创建ZPL打印命令
    createZPLPrintCommand(zplCode, printerName) {
        const platform = os.platform();
        
        if (platform === 'win32') {
            // Windows - 发送到打印机
            const tempFile = `temp_label_${Date.now()}.zpl`;
            require('fs').writeFileSync(tempFile, zplCode);
            return `copy /B "${tempFile}" "${printerName}:" && del "${tempFile}"`;
        } else {
            // Linux/macOS
            return `echo '${zplCode}' | lpr -P ${printerName}`;
        }
    }

    // 创建HTML打印命令
    createHTMLPrintCommand(htmlContent, printerName) {
        const platform = os.platform();
        const tempFile = `temp_label_${Date.now()}.html`;
        
        require('fs').writeFileSync(tempFile, htmlContent);
        
        if (platform === 'win32') {
            // Windows - 使用默认浏览器打印
            return `start "" "${tempFile}"`;
        } else if (platform === 'darwin') {
            // macOS
            return `open "${tempFile}"`;
        } else {
            // Linux
            return `xdg-open "${tempFile}"`;
        }
    }

    // 测试打印
    async testPrint(req, res) {
        try {
            const { printerName } = req.body;
            
            const testLabelData = {
                recordId: 'TEST202501031430001',
                sku: 'TEST-SKU-001',
                quantity: 10,
                boxes: 1,
                country: 'US',
                operator: '测试员',
                packer: '测试打包员',
                boxType: '整箱',
                createTime: new Date(),
                barcode: 'TEST202501031430001'
            };
            
            const htmlContent = this.generateHTML(testLabelData);
            const printCommand = this.createHTMLPrintCommand(htmlContent, printerName);
            
            exec(printCommand, (error, stdout, stderr) => {
                if (error) {
                    return res.status(500).json({
                        code: 1,
                        message: '测试打印失败',
                        error: error.message
                    });
                }
                
                res.json({
                    code: 0,
                    message: '测试打印成功',
                    data: { printer: printerName }
                });
            });
            
        } catch (error) {
            res.status(500).json({
                code: 1,
                message: '测试打印失败',
                error: error.message
            });
        }
    }

    // 启动服务
    start() {
        this.app.listen(this.port, () => {
            console.log(`🖨️ 打印服务已启动，端口: ${this.port}`);
            console.log(`   健康检查: http://localhost:${this.port}/health`);
            console.log(`   打印机列表: http://localhost:${this.port}/printers`);
        });
    }
}

// 如果直接运行此文件，启动服务
if (require.main === module) {
    const printService = new PrintService();
    printService.start();
}

module.exports = PrintService; 