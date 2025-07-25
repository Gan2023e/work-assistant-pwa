/**
 * 前端打印管理器
 * 支持本地打印服务和浏览器原生打印
 * 云端部署优化版本 - 智能选择打印方式
 */

import { printConfig, isCloudDeployment, getRecommendedPrintMethod } from '../config/print';

export interface LabelData {
    recordId: string;
    sku: string;
    quantity: number;
    boxes: number;
    country: string;
    operator: string;
    packer?: string;
    boxType: '整箱' | '混合箱';
    mixBoxNum?: string;
    createTime: string | Date;
    barcode: string;
    qrData?: string;
}

export interface PrintOptions {
    printType?: 'html' | 'zpl';
    printerName?: string;
    autoClose?: boolean;
    forceLocal?: boolean; // 强制使用本地服务
}

export class PrintManager {
    private printServiceUrl: string;
    private fallbackToBrowser: boolean;
    private isServiceAvailable: boolean | null = null;
    private isCloudDeployment: boolean;

    constructor(printServiceUrl?: string, fallbackToBrowser = true) {
        this.printServiceUrl = printServiceUrl || printConfig.serviceUrl;
        this.fallbackToBrowser = fallbackToBrowser;
        this.isCloudDeployment = printConfig.isCloud;
    }

    /**
     * 检查打印服务是否可用
     */
    async checkPrintService(): Promise<boolean> {
        // 云端部署且没有配置打印服务URL时，直接返回false
        if (this.isCloudDeployment && !this.printServiceUrl) {
            this.isServiceAvailable = false;
            return false;
        }

        // 云端部署时使用短超时
        if (this.isCloudDeployment) {
            try {
                const response = await fetch(`${this.printServiceUrl}/health`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    signal: AbortSignal.timeout(printConfig.healthCheckTimeout)
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.isServiceAvailable = data.status === 'OK';
                    return this.isServiceAvailable;
                }
            } catch (error) {
                // 云端部署时，连接失败是预期的
                console.log('本地打印服务不可用，这在云端部署中是正常的');
            }
            
            this.isServiceAvailable = false;
            return false;
        } else {
            // 本地部署，正常检查
            try {
                const response = await fetch(`${this.printServiceUrl}/health`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.isServiceAvailable = data.status === 'OK';
                    return this.isServiceAvailable;
                }
                
                this.isServiceAvailable = false;
                return false;
            } catch (error) {
                console.warn('打印服务不可用:', error);
                this.isServiceAvailable = false;
                return false;
            }
        }
    }

    /**
     * 获取可用的打印机列表
     */
    async getPrinters(): Promise<any[]> {
        try {
            const response = await fetch(`${this.printServiceUrl}/printers`);
            if (response.ok) {
                const data = await response.json();
                return data.data?.printers || [];
            }
            throw new Error('获取打印机列表失败');
        } catch (error) {
            console.error('获取打印机失败:', error);
            return [];
        }
    }

    /**
     * 打印标签（主要方法）- 云端优化版本
     */
    async printLabel(labelData: LabelData, options: PrintOptions = {}): Promise<boolean> {
        try {
            // 云端部署或强制不使用本地服务时，直接使用浏览器打印
            if (this.isCloudDeployment && !options.forceLocal) {
                console.log('云端部署，使用浏览器打印');
                return this.printViaBrowser(labelData, options);
            }

            // 检查本地服务状态
            if (this.isServiceAvailable === null) {
                await this.checkPrintService();
            }

            // 尝试本地打印服务
            if (this.isServiceAvailable && !this.isCloudDeployment) {
                try {
                    return await this.printViaService(labelData, options);
                } catch (error) {
                    console.warn('本地打印服务失败，切换到浏览器打印');
                    if (this.fallbackToBrowser) {
                        return this.printViaBrowser(labelData, options);
                    }
                    throw error;
                }
            } else {
                // 本地服务不可用，使用浏览器打印
                if (this.fallbackToBrowser) {
                    return this.printViaBrowser(labelData, options);
                } else {
                    throw new Error('打印服务不可用且未启用浏览器打印备用方案');
                }
            }
        } catch (error) {
            console.error('打印失败:', error);
            
            // 最后的备用方案：浏览器打印
            if (this.fallbackToBrowser) {
                console.warn('所有打印方式失败，尝试浏览器打印');
                return this.printViaBrowser(labelData, options);
            }
            
            throw error;
        }
    }

    /**
     * 通过本地服务打印
     */
    private async printViaService(labelData: LabelData, options: PrintOptions): Promise<boolean> {
        try {
            const response = await fetch(`${this.printServiceUrl}/print-label`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    labelData: labelData,
                    printerName: options.printerName,
                    printType: options.printType || 'html'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '打印服务调用失败');
            }

            const result = await response.json();
            console.log('✅ 本地打印服务成功:', result.data);
            return true;
        } catch (error) {
            console.error('本地打印服务失败:', error);
            throw error;
        }
    }

    /**
     * 通过浏览器打印（云端部署的主要方式）
     */
    private printViaBrowser(labelData: LabelData, options: PrintOptions = {}): boolean {
        try {
            const htmlContent = this.generateLabelHTML(labelData);
            const printWindow = window.open('', '_blank', 'width=800,height=600');
            
            if (!printWindow) {
                throw new Error('无法打开打印窗口，请检查浏览器弹窗拦截设置');
            }

            printWindow.document.write(htmlContent);
            printWindow.document.close();

            // 等待内容加载后打印
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.print();
                    if (options.autoClose !== false) {
                        setTimeout(() => {
                            try {
                                printWindow.close();
                            } catch (e) {
                                // 忽略关闭窗口的错误
                            }
                        }, 1000);
                    }
                }, 500);
            };

            console.log('✅ 浏览器打印窗口已打开');
            return true;
        } catch (error) {
            console.error('浏览器打印失败:', error);
            return false;
        }
    }

    /**
     * 批量打印标签
     */
    async printBatch(labelDataList: LabelData[], options: PrintOptions = {}): Promise<{success: number, failed: number}> {
        let success = 0;
        let failed = 0;

        for (const labelData of labelDataList) {
            try {
                await this.printLabel(labelData, options);
                success++;
                
                // 添加延迟避免打印冲突
                await new Promise(resolve => setTimeout(resolve, printConfig.batchPrintDelay));
            } catch (error) {
                console.error(`打印失败 - ${labelData.recordId}:`, error);
                failed++;
            }
        }

        return { success, failed };
    }

    /**
     * 测试打印
     */
    async testPrint(printerName?: string): Promise<boolean> {
        try {
            // 云端部署时，优先使用浏览器测试
            if (this.isCloudDeployment) {
                const testLabel: LabelData = {
                    recordId: 'TEST' + Date.now(),
                    sku: 'TEST-SKU',
                    quantity: 1,
                    boxes: 1,
                    country: 'TEST',
                    operator: '测试',
                    boxType: '整箱',
                    createTime: new Date(),
                    barcode: 'TEST' + Date.now()
                };

                return this.printViaBrowser(testLabel, { autoClose: false });
            }

            // 本地部署时，尝试本地服务
            if (this.isServiceAvailable === null) {
                await this.checkPrintService();
            }

            if (this.isServiceAvailable) {
                const response = await fetch(`${this.printServiceUrl}/test-print`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ printerName })
                });

                if (response.ok) {
                    console.log('✅ 本地打印测试成功');
                    return true;
                }
            }

            // 备用测试打印
            const testLabel: LabelData = {
                recordId: 'TEST' + Date.now(),
                sku: 'TEST-SKU',
                quantity: 1,
                boxes: 1,
                country: 'TEST',
                operator: '测试',
                boxType: '整箱',
                createTime: new Date(),
                barcode: 'TEST' + Date.now()
            };

            return this.printViaBrowser(testLabel, { autoClose: false });
        } catch (error) {
            console.error('测试打印失败:', error);
            return false;
        }
    }

    /**
     * 生成打印用的HTML内容（60x40mm热敏纸优化版）
     */
    private generateLabelHTML(labelData: LabelData): string {
        // 处理混合箱显示逻辑
        const isMultipleSku = labelData.boxType === '混合箱';
        
        // 生成SKU和数量信息
        let skuContent = '';
        if (isMultipleSku && labelData.qrData) {
            try {
                const qrObj = JSON.parse(labelData.qrData);
                if (qrObj.skus && Array.isArray(qrObj.skus)) {
                    // 混合箱：显示所有SKU
                    skuContent = qrObj.skus.map((item: any) => 
                        `<div class="sku-item">${item.sku}: ${item.quantity}件</div>`
                    ).join('');
                } else {
                    // 备用显示
                    skuContent = `<div class="sku-item">${labelData.sku}: ${labelData.quantity}件</div>`;
                }
            } catch (error) {
                // 解析失败时的备用显示
                skuContent = `<div class="sku-item">${labelData.sku}: ${labelData.quantity}件</div>`;
            }
        } else {
            // 整箱：显示单个SKU
            const boxInfo = labelData.boxes > 1 ? `/${labelData.boxes}箱` : '';
            skuContent = `<div class="sku-item">${labelData.sku}: ${labelData.quantity}件${boxInfo}</div>`;
        }

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>物流标签 - ${labelData.recordId}</title>
    <style>
        @page { 
            size: 60mm 40mm; 
            margin: 0; 
        }
        @media print {
            body { 
                font-family: 'Microsoft YaHei', 'SimHei', Arial, sans-serif; 
                font-size: 8px; 
                margin: 0;
                padding: 1mm;
                color: black;
                background: white;
                line-height: 1.1;
                width: 58mm;
                height: 38mm;
                overflow: hidden;
            }
            .no-print { display: none; }
        }
        body { 
            font-family: 'Microsoft YaHei', 'SimHei', Arial, sans-serif; 
            font-size: 8px; 
            margin: 0;
            padding: 1mm;
            line-height: 1.1;
            width: 58mm;
            height: 38mm;
            overflow: hidden;
        }
        
        /* 目的国显示 - 顶部加粗 */
        .country { 
            text-align: center; 
            font-weight: bold; 
            font-size: 16px;
            color: black;
            margin-bottom: 2mm; 
            border-bottom: 1px solid #000;
            padding-bottom: 1mm;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        /* SKU信息区域 */
        .sku-section { 
            line-height: 1.2;
            font-size: 7px;
        }
        
        .sku-item {
            margin-bottom: 0.5mm;
            word-break: break-all;
            text-align: left;
        }
        
        /* 混合箱标识 */
        .mixed-box-info {
            text-align: center;
            font-size: 6px;
            margin-top: 1mm;
            padding: 0.5mm;
            background: #f0f0f0;
            border: 1px solid #ccc;
        }
        
        /* 控制按钮 */
        .controls {
            position: fixed;
            top: 10px;
            right: 10px;
            background: #f0f0f0;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 5px;
            z-index: 1000;
            font-size: 12px;
        }
        @media print {
            .controls { display: none; }
        }
        
        .cloud-notice {
            position: fixed;
            top: 10px;
            left: 10px;
            background: #e6f7ff;
            padding: 8px;
            border: 1px solid #91d5ff;
            border-radius: 4px;
            font-size: 12px;
            max-width: 300px;
        }
        @media print {
            .cloud-notice { display: none; }
        }
        
        /* 确保内容不超出页面 */
        * {
            box-sizing: border-box;
        }
    </style>
</head>
<body>
    <div class="cloud-notice no-print">
        ${this.isCloudDeployment ? 
            '🌐 云端打印模式：请使用浏览器打印功能（Ctrl+P）<br/>建议设置为实际尺寸打印' : 
            '🖥️ 本地打印模式 - 60x40mm热敏纸'}
    </div>
    
    <div class="controls no-print">
        <button onclick="window.print()" style="margin-right: 8px;">🖨️ 打印</button>
        <button onclick="window.close()">❌ 关闭</button>
        <br><small>60x40mm热敏纸</small>
    </div>
    
    <!-- 目的国 - 最上方加粗显示 -->
    <div class="country">${labelData.country}</div>
    
    <!-- SKU及数量信息 -->
    <div class="sku-section">
        ${skuContent}
    </div>
    
    <!-- 混合箱信息（如果适用） -->
    ${isMultipleSku ? `<div class="mixed-box-info">混合箱: ${labelData.mixBoxNum}</div>` : ''}
    
    <script>
        // 云端部署时的自动提示
        if (${this.isCloudDeployment}) {
            console.log('🌐 云端打印模式：建议使用 Ctrl+P 快捷键打印');
            console.log('📏 打印尺寸：60x40mm热敏纸');
        }
        
        // 页面加载后自动调整
        window.onload = function() {
            console.log('📄 标签页面已加载 - 60x40mm格式');
        };
    </script>
</body>
</html>
        `.trim();
    }

    /**
     * 获取打印服务状态
     */
    async getServiceStatus(): Promise<{available: boolean, url: string, version?: string, isCloudDeployment: boolean}> {
        const available = await this.checkPrintService();
        return {
            available,
            url: this.printServiceUrl,
            version: available ? '1.0.0' : undefined,
            isCloudDeployment: this.isCloudDeployment
        };
    }

    /**
     * 获取推荐的打印方式
     */
    getRecommendedPrintMethod(): 'browser' | 'local' {
        return this.isCloudDeployment ? 'browser' : 'local';
    }
}

// 创建默认实例 - 智能配置
export const printManager = new PrintManager(printConfig.serviceUrl, true);

// 导出工具函数
export const printUtils = {
    // 格式化记录号为条码格式
    formatBarcode: (recordId: string): string => {
        return recordId.replace(/[^0-9A-Z]/g, '');
    },
    
    // 生成QR码数据
    generateQRData: (labelData: LabelData): string => {
        return JSON.stringify({
            id: labelData.recordId,
            sku: labelData.sku,
            qty: labelData.quantity,
            country: labelData.country,
            type: labelData.boxType
        });
    },
    
    // 验证标签数据
    validateLabelData: (labelData: LabelData): string[] => {
        const errors: string[] = [];
        
        if (!labelData.recordId) errors.push('记录号不能为空');
        if (!labelData.sku) errors.push('SKU不能为空');
        if (!labelData.quantity || labelData.quantity <= 0) errors.push('数量必须大于0');
        if (!labelData.boxes || labelData.boxes <= 0) errors.push('箱数必须大于0');
        if (!labelData.country) errors.push('目的地不能为空');
        if (!labelData.operator) errors.push('操作员不能为空');
        
        return errors;
    },

    // 检测是否为云端部署
    isCloudDeployment: (): boolean => {
        return !window.location.hostname.includes('localhost') 
            && !window.location.hostname.includes('127.0.0.1')
            && !window.location.hostname.includes('192.168.');
    }
}; 