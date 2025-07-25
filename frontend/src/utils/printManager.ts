/**
 * 前端浏览器打印管理器
 * 只支持浏览器原生打印功能
 */

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
    autoClose?: boolean;
}

export class PrintManager {
    constructor() {
        // 简化构造函数，只支持浏览器打印
    }

    /**
     * 检查浏览器打印可用性（始终返回true）
     */
    async checkPrintService(): Promise<boolean> {
        return true;
    }

    /**
     * 打印标签（只支持浏览器打印）
     */
    async printLabel(labelData: LabelData, options: PrintOptions = {}): Promise<boolean> {
        try {
            console.log('🖨️ 使用浏览器打印模式');
            return this.printViaBrowser(labelData, options);
        } catch (error) {
            console.error('打印失败:', error);
            throw error;
        }
    }

    /**
     * 通过浏览器打印
     */
    private async printViaBrowser(labelData: LabelData, options: PrintOptions = {}): Promise<boolean> {
        try {
            const htmlContent = this.generateLabelHTML(labelData);
            
            // 打开全屏新窗口进行打印
            const printWindow = window.open('', '_blank', 'fullscreen=yes,scrollbars=no,resizable=yes,toolbar=no,menubar=no,location=no,status=no');
            
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
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`打印失败 - ${labelData.recordId}:`, error);
                failed++;
            }
        }

        return { success, failed };
    }

    /**
     * 在一个页面中打印多个标签
     */
    async printMultipleLabels(labelDataList: LabelData[], options: PrintOptions = {}): Promise<boolean> {
        try {
            const multiLabelHTML = this.generateMultiLabelHTML(labelDataList);
            
            const printWindow = window.open('', '_blank', 'width=600,height=800');
            if (!printWindow) {
                console.error('无法打开打印窗口');
                return false;
            }

            printWindow.document.write(multiLabelHTML);
            printWindow.document.close();

            // 等待内容加载完成后打印
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.print();
                    if (options.autoClose !== false) {
                        setTimeout(() => {
                            printWindow.close();
                        }, 500);
                    }
                }, 500);
            };

            console.log(`✅ 已打开包含 ${labelDataList.length} 个标签的打印窗口`);
            return true;
        } catch (error) {
            console.error('批量打印失败:', error);
            return false;
        }
    }

    /**
     * 测试打印
     */
    async testPrint(): Promise<boolean> {
        try {
            const testLabel: LabelData = {
                recordId: 'TEST' + Date.now(),
                sku: 'TEST-SKU',
                quantity: 1,
                boxes: 1,
                country: 'US',
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
            font-size: 12px;
            text-align: center;
        }
        
        .sku-item {
            margin-bottom: 0.5mm;
            word-break: break-all;
            text-align: center;
            font-weight: bold;
            color: black;
        }
        
        /* 控制按钮 - 屏幕居中 */
        .controls {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #f0f0f0;
            padding: 15px;
            border: 2px solid #ccc;
            border-radius: 8px;
            z-index: 1000;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            text-align: center;
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
        🖨️ 浏览器打印模式：请使用浏览器打印功能（Ctrl+P）<br/>建议设置为实际尺寸打印
    </div>
    
    <div class="controls no-print">
        <button onclick="window.print()" style="margin-right: 8px; padding: 8px 16px; font-size: 14px;">🖨️ 打印</button>
        <button onclick="window.close()" style="padding: 8px 16px; font-size: 14px;">❌ 关闭</button>
        <br><small style="color: #666; margin-top: 8px; display: block;">60x40mm热敏纸</small>
    </div>
    
    <!-- 目的国 - 最上方加粗显示 -->
    <div class="country">${labelData.country}</div>
    
    <!-- SKU及数量信息 -->
    <div class="sku-section">
        ${skuContent}
    </div>
    
    <script>
        console.log('🖨️ 浏览器打印模式：建议使用 Ctrl+P 快捷键打印');
        console.log('📏 打印尺寸：60x40mm热敏纸');
        
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
     * 生成包含多个标签的HTML页面
     */
    private generateMultiLabelHTML(labelDataList: LabelData[]): string {
        // 生成所有标签的内容
        const labelContents = labelDataList.map(labelData => {
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
                <div class="label-container">
                    <!-- 目的国 - 最上方加粗显示 -->
                    <div class="country">${labelData.country}</div>
                    
                    <!-- SKU及数量信息 -->
                    <div class="sku-section">
                        ${skuContent}
                    </div>
                </div>
            `;
        }).join('');

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>物流标签批量打印 - ${labelDataList.length}张</title>
    <style>
        @page { 
            size: auto;
            margin: 5mm; 
        }
        @media print {
            body { 
                font-family: 'Microsoft YaHei', 'SimHei', Arial, sans-serif; 
                margin: 0;
                padding: 0;
                color: black;
                background: white;
            }
            .no-print { display: none; }
        }
        body { 
            font-family: 'Microsoft YaHei', 'SimHei', Arial, sans-serif; 
            margin: 10px;
            padding: 0;
            line-height: 1.2;
        }
        
        .label-container {
            width: 60mm;
            height: 40mm;
            border: 1px solid #ccc;
            margin-bottom: 5mm;
            padding: 2mm;
            box-sizing: border-box;
            page-break-inside: avoid;
            display: inline-block;
            vertical-align: top;
            margin-right: 5mm;
        }
        
        .country {
            font-size: 12px;
            font-weight: bold;
            text-align: center;
            border-bottom: 1px solid #000;
            padding-bottom: 2px;
            margin-bottom: 4px;
        }
        
        .sku-section {
            font-size: 10px;
            text-align: center;
        }
        
        .sku-item {
            margin: 2px 0;
            font-weight: bold;
        }
        
        /* 每行显示3个标签 */
        .label-container:nth-child(3n) {
            margin-right: 0;
        }
        
        /* 每3个标签后换行 */
        .label-container:nth-child(3n):after {
            content: "";
            display: block;
            width: 100%;
            height: 0;
        }
    </style>
</head>
<body>
    <div class="no-print" style="text-align: center; margin-bottom: 10px; padding: 10px; background: #f0f0f0;">
        <h3>物流标签批量打印</h3>
        <p>共 ${labelDataList.length} 张标签，建议使用热敏纸打印机</p>
        <button onclick="window.print()" style="padding: 5px 15px; margin-right: 10px;">打印</button>
        <button onclick="window.close()" style="padding: 5px 15px;">关闭</button>
    </div>
    
    ${labelContents}
    
    <script>
        console.log('🖨️ 批量打印模式：共 ${labelDataList.length} 张标签');
        
        // 页面加载后自动调整
        window.onload = function() {
            console.log('📄 批量标签页面已加载');
        };
    </script>
</body>
</html>
        `.trim();
    }

    /**
     * 获取打印服务状态
     */
    async getServiceStatus(): Promise<{available: boolean, method: string}> {
        return {
            available: true,
            method: 'browser'
        };
    }
}

// 创建默认实例
export const printManager = new PrintManager();

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
    }
}; 