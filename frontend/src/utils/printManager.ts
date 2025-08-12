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

// 需求单详情打印数据接口
export interface OrderDetailsData {
    order_summary: {
        need_num: string;
        total_items: number;
        total_quantity: number;
        create_time: string;
        country?: string;
        status?: string;
        completion_rate?: number;
    };
    order_items: Array<{
        record_num: string;
        sku: string;
        local_sku?: string;
        quantity: number;
        shipped_quantity?: number;
        remaining_quantity?: number;
        total_available?: number;
        shortage?: number;
        country: string;
        create_time: string;
        status?: string;
    }>;
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
     * 通过浏览器打印标签
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
     * 打印需求单详情
     */
    async printOrderDetails(orderData: OrderDetailsData, options: PrintOptions = {}): Promise<boolean> {
        try {
            console.log('🖨️ 开始打印需求单详情');
            return this.printOrderDetailsViaBrowser(orderData, options);
        } catch (error) {
            console.error('打印需求单详情失败:', error);
            throw error;
        }
    }

    /**
     * 通过浏览器打印需求单详情
     */
    private printOrderDetailsViaBrowser(orderData: OrderDetailsData, options: PrintOptions = {}): boolean {
        const html = this.generateOrderDetailsHTML(orderData);
        const printWindow = window.open('', '_blank', 'fullscreen=yes,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no');
        
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.print();
                    if (options.autoClose !== false) {
                        printWindow.close();
                    }
                }, 100);
            };
            
            return true;
        }
        
        return false;
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
            
            const printWindow = window.open('', '_blank', 'fullscreen=yes,scrollbars=no,resizable=yes,toolbar=no,menubar=no,location=no,status=no');
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
     * 混合箱标签分页打印（每页最多16个SKU：8行×2列，SKU≤8时单列，>8时双列，>16时分页）
     */
    async printMultipleMixedBoxLabelsWithPagination(labelDataList: LabelData[], options: PrintOptions = {}): Promise<boolean> {
        try {
            const paginatedHTML = this.generatePaginatedMixedBoxHTML(labelDataList);
            
            const printWindow = window.open('', '_blank', 'fullscreen=yes,scrollbars=no,resizable=yes,toolbar=no,menubar=no,location=no,status=no');
            if (!printWindow) {
                console.error('无法打开打印窗口');
                return false;
            }

            printWindow.document.write(paginatedHTML);
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

                         // 计算分页数量（每页最多16个SKU）
             const totalPages = Math.ceil(labelDataList.length / 16);

             console.log(`✅ 已打开混合箱分页打印窗口，共 ${labelDataList.length} 个SKU，分 ${totalPages} 页打印`);
            return true;
        } catch (error) {
            console.error('混合箱分页打印失败:', error);
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

        return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>物流标签 - ${labelData.recordId}</title><style>@page{size:60mm 40mm;margin:0}*{margin:0 !important;padding:0 !important;box-sizing:border-box !important}html{margin:0 !important;padding:0 !important;width:60mm !important;height:40mm !important}body{font-family:'Microsoft YaHei','SimHei',Arial,sans-serif !important;font-size:8px !important;line-height:1.1 !important;color:black !important;background:white !important;margin:0 !important;padding:0 !important;width:60mm !important;height:40mm !important;overflow:hidden !important}.no-print{display:none !important;position:absolute !important;left:-9999px !important;width:0 !important;height:0 !important}.country{font-size:18px !important;font-weight:bold !important;text-align:center !important;border-bottom:1px solid #000 !important;padding:1mm 1mm 1mm 1mm !important;margin:0 !important;line-height:1.0 !important;text-transform:uppercase;letter-spacing:1px}.sku-section{font-size:14px !important;text-align:center !important;font-weight:bold !important;margin:1mm 1mm 0 1mm !important;padding:0 !important}.sku-item{margin:0.5mm 0 !important;padding:0 !important;line-height:1.1 !important;word-break:break-all;text-align:center;font-weight:bold;color:black}@media print{*{margin:0 !important;padding:0 !important}body{width:60mm !important;height:40mm !important}.no-print{display:none !important}}</style></head><body><div class="no-print" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;text-align:center;padding:20px;background:rgba(224,224,224,0.95);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3)"><h3 style="margin:0 0 10px 0;color:#333">🏷️ 60×40mm热敏纸打印</h3><button onclick="window.print()" style="padding:10px 20px;margin-right:10px;background:#28a745;color:white;border:none;border-radius:3px;cursor:pointer;font-size:14px">🖨️ 打印</button><button onclick="window.close()" style="padding:10px 20px;background:#6c757d;color:white;border:none;border-radius:3px;cursor:pointer;font-size:14px">❌ 关闭</button></div><div class="country">${labelData.country}</div><div class="sku-section">${skuContent}</div><script class="no-print">console.log('🖨️ 浏览器打印模式');window.onload=function(){console.log('📄 标签页面已加载')}</script></body></html>`.trim();
    }

    /**
     * 生成热敏纸直接打印页面（每张60x40mm热敏纸打印一个标签）
     */
    private generateMultiLabelHTML(labelDataList: LabelData[]): string {
        // 为每个标签生成单独的页面
        const labelPages = labelDataList.map((labelData, index) => {
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
                // 整箱：显示单个SKU，不显示箱数信息（因为每个标签代表一箱）
                skuContent = `<div class="sku-item">${labelData.sku}: ${labelData.quantity}件</div>`;
            }

            return `<div class="thermal-page${index > 0 ? ' page-break' : ''}"><div class="country">${labelData.country}</div><div class="sku-section">${skuContent}</div></div>`;
        }).join('');

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>热敏纸直接打印 - ${labelDataList.length}张标签</title>
    <style>
        /* 设置页面为60x40mm热敏纸规格 */
        @page { 
            size: 60mm 40mm; 
            margin: 0; 
        }
        
        @media print {
            * {
                margin: 0 !important;
                padding: 0 !important;
                box-sizing: border-box !important;
            }
            
            html {
                margin: 0 !important;
                padding: 0 !important;
                width: 60mm !important;
                height: 40mm !important;
            }
            
            body { 
                font-family: 'Microsoft YaHei', 'SimHei', Arial, sans-serif !important; 
                font-size: 8px !important;
                line-height: 1.1 !important;
                color: black !important;
                background: white !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 60mm !important;
                height: auto !important;
                overflow: visible !important;
            }
            
            .no-print { 
                display: none !important;
                position: absolute !important;
                left: -9999px !important;
                width: 0 !important;
                height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            
            .thermal-page {
                width: 60mm !important;
                height: 40mm !important;
                margin: 0 !important;
                padding: 0 !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
                position: relative !important;
                border: none !important;
                page-break-inside: avoid !important;
            }
            
            .thermal-page:first-child {
                margin-top: 0 !important;
                padding-top: 0 !important;
            }
            
            .page-break {
                page-break-before: always !important;
                margin-top: 0 !important;
                padding-top: 0 !important;
            }
        }
        
        /* 屏幕预览样式 */
        body { 
            font-family: 'Microsoft YaHei', 'SimHei', Arial, sans-serif; 
            margin: 0;
            padding: 20px 10px;
            line-height: 1.1;
            background: #f0f0f0;
        }
        
        .thermal-page {
            width: 60mm;
            height: 40mm;
            margin: 10mm auto;
            padding: 0;
            box-sizing: border-box;
            background: white;
            position: relative;
            overflow: hidden;
            display: block;
            box-shadow: 0 0 0 2px #333, 0 2px 4px rgba(0,0,0,0.2); /* 使用阴影替代边框 */
        }
        
        .country {
            font-size: 18px;
            font-weight: bold;
            text-align: center;
            border-bottom: 1px solid #000;
            padding-bottom: 1mm;
            margin: 1mm 1mm 2mm 1mm;
            line-height: 1.2;
        }
        
        .sku-section {
            font-size: 14px;
            text-align: center;
            font-weight: bold;
            margin: 2mm 1mm 0 1mm;
        }
        
        .sku-item {
            margin: 1mm 0;
            line-height: 1.3;
        }
        
        /* 打印时的精确控制 */
        @media print {
            .country {
                font-size: 18px !important;
                font-weight: bold !important;
                text-align: center !important;
                border-bottom: 1px solid #000 !important;
                padding: 1mm 1mm 1mm 1mm !important;
                margin: 0 !important;
                line-height: 1.0 !important;
            }
            
            .sku-section {
                font-size: 14px !important;
                text-align: center !important;
                font-weight: bold !important;
                margin: 1mm 1mm 0 1mm !important;
                padding: 0 !important;
            }
            
            .sku-item {
                margin: 0.5mm 0 !important;
                padding: 0 !important;
                line-height: 1.1 !important;
            }
        }
    </style>
</head>
<body>
    <div class="no-print" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999; text-align: center; padding: 20px; background: rgba(224, 224, 224, 0.95); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
        <h3 style="margin: 0 0 10px 0; color: #333;">🏷️ 60×40mm热敏纸直接打印</h3>
        <p style="margin: 0 0 10px 0; color: #666;">共 ${labelDataList.length} 张标签，每张热敏纸打印一个外箱单</p>
        <button onclick="window.print()" style="padding: 10px 20px; margin-right: 10px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 14px;">🖨️ 开始打印</button>
        <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 14px;">❌ 关闭</button>
        <div style="margin-top: 10px; font-size: 12px; color: #888;">
            ⚠️ 请确保打印机设置为60×40mm热敏纸规格
        </div>
    </div>${labelPages}<script class="no-print">console.log('🖨️ 热敏纸直接打印：共 ${labelDataList.length} 张 60×40mm 标签');console.log('📄 每张热敏纸打印一个外箱单标签');window.onload=function(){console.log('📄 热敏标签页面已加载 - 60×40mm 直接打印模式');}</script></body></html>`.trim();
    }

    /**
     * 生成混合箱分页打印HTML（每页最多16个SKU：8行×2列，SKU≤8时单列，>8时双列，>16时分页）
     */
    private generatePaginatedMixedBoxHTML(labelDataList: LabelData[]): string {
        if (labelDataList.length === 0) {
            return '';
        }

        // 获取第一个标签的基本信息
        const firstLabel = labelDataList[0];
        
        // 解析混合箱数据
        let allSkus: Array<{sku: string, quantity: number}> = [];
        
        // 处理多个混合箱的情况
        for (const labelData of labelDataList) {
            if (labelData.qrData) {
                try {
                    const qrObj = JSON.parse(labelData.qrData);
                    if (qrObj.skus && Array.isArray(qrObj.skus)) {
                        allSkus.push(...qrObj.skus);
                    }
                } catch (error) {
                    console.error('解析QR数据失败:', error);
                    // 备用方案
                    allSkus.push({
                        sku: labelData.sku.replace('混合箱-', ''),
                        quantity: labelData.quantity
                    });
                }
            } else {
                // 备用方案
                allSkus.push({
                    sku: labelData.sku,
                    quantity: labelData.quantity
                });
            }
        }

                          // 新分页逻辑：每页最多16个SKU（8行×2列），超过16个时分页
         const pages: Array<{skus: Array<{sku: string, quantity: number}>, pageNumber: number, useDoubleColumn: boolean}> = [];
         
         let currentIndex = 0;
         let pageNumber = 1;
         
         while (currentIndex < allSkus.length) {
             // 每页最多16个SKU
             const maxSkusForThisPage = 16;
             const endIndex = Math.min(currentIndex + maxSkusForThisPage, allSkus.length);
             const pageSkus = allSkus.slice(currentIndex, endIndex);
             
             // 判断是否需要使用两列布局（超过8个SKU时使用两列）
             const useDoubleColumn = pageSkus.length > 8;
             
             pages.push({
                 skus: pageSkus,
                 pageNumber: pageNumber,
                 useDoubleColumn: useDoubleColumn
             });
             
             currentIndex = endIndex;
             pageNumber++;
         }

                 // 生成每一页的HTML
         const pageElements = pages.map((page, index) => {
             let skuContent = '';
             
             if (page.useDoubleColumn) {
                 // 两列布局：将SKU分成两列
                 const leftColumn: Array<{sku: string, quantity: number}> = [];
                 const rightColumn: Array<{sku: string, quantity: number}> = [];
                 
                 page.skus.forEach((item, idx) => {
                     if (idx < 8) {
                         leftColumn.push(item);
                     } else {
                         rightColumn.push(item);
                     }
                 });
                 
                 const leftContent = leftColumn.map(item => 
                     `<div class="sku-item">${item.sku}: ${item.quantity}件</div>`
                 ).join('');
                 
                 const rightContent = rightColumn.map(item => 
                     `<div class="sku-item">${item.sku}: ${item.quantity}件</div>`
                 ).join('');
                 
                 skuContent = `
                     <div class="two-column-layout">
                         <div class="left-column">${leftContent}</div>
                         <div class="right-column">${rightContent}</div>
                     </div>
                 `;
             } else {
                 // 单列布局
                 skuContent = page.skus.map(item => 
                     `<div class="sku-item">${item.sku}: ${item.quantity}件</div>`
                 ).join('');
             }

             const pageClass = index > 0 ? 'thermal-page page-break' : 'thermal-page';
             
             return `<div class="${pageClass}">
                 <div class="country">${firstLabel.country}</div>
                 <div class="sku-section ${page.useDoubleColumn ? 'double-column' : ''}">${skuContent}</div>
                 <div class="page-info">第${page.pageNumber}页/共${pages.length}页</div>
             </div>`;
         }).join('');

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>混合箱分页打印 - ${allSkus.length}个SKU，共${pages.length}页</title>
    <style>
        /* 设置页面为60x40mm热敏纸规格 */
        @page { 
            size: 60mm 40mm; 
            margin: 0; 
        }
        
        @media print {
            * {
                margin: 0 !important;
                padding: 0 !important;
                box-sizing: border-box !important;
            }
            
            html {
                margin: 0 !important;
                padding: 0 !important;
                width: 60mm !important;
                height: 40mm !important;
            }
            
            body { 
                font-family: 'Microsoft YaHei', 'SimHei', Arial, sans-serif !important; 
                font-size: 8px !important;
                line-height: 1.1 !important;
                color: black !important;
                background: white !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 60mm !important;
                height: auto !important;
                overflow: visible !important;
            }
            
            .no-print { 
                display: none !important;
                position: absolute !important;
                left: -9999px !important;
                width: 0 !important;
                height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            
            .thermal-page {
                width: 60mm !important;
                height: 40mm !important;
                margin: 0 !important;
                padding: 0 !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
                position: relative !important;
                border: none !important;
                page-break-inside: avoid !important;
            }
            
            .thermal-page:first-child {
                margin-top: 0 !important;
                padding-top: 0 !important;
            }
            
            .page-break {
                page-break-before: always !important;
                margin-top: 0 !important;
                padding-top: 0 !important;
            }
        }
        
        /* 屏幕预览样式 */
        body { 
            font-family: 'Microsoft YaHei', 'SimHei', Arial, sans-serif; 
            margin: 0;
            padding: 20px 10px;
            line-height: 1.1;
            background: #f0f0f0;
        }
        
        .thermal-page {
            width: 60mm;
            height: 40mm;
            margin: 10mm auto;
            padding: 0;
            box-sizing: border-box;
            background: white;
            position: relative;
            overflow: hidden;
            display: block;
            box-shadow: 0 0 0 2px #333, 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .country {
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            border-bottom: 1px solid #000;
            padding-bottom: 1mm;
            margin: 1mm 1mm 1mm 1mm;
            line-height: 1.1;
        }
        
        .sku-section {
            font-size: 11px;
            text-align: center;
            font-weight: bold;
            margin: 1mm 1mm 0 1mm;
            height: 25mm;
            overflow: hidden;
        }
        
        .sku-item {
            margin: 0.3mm 0;
            line-height: 1.1;
            word-break: break-all;
        }
        
                 .page-info {
             position: absolute;
             bottom: 5mm;
             left: 50%;
             transform: translateX(-50%);
             font-size: 12px;
             font-weight: bold;
             color: #333;
             text-align: center;
         }
         
         .two-column-layout {
             display: flex;
             justify-content: space-between;
             width: 100%;
         }
         
         .left-column,
         .right-column {
             width: 48%;
             flex-shrink: 0;
         }
         
         .sku-section.double-column {
             height: 20mm;
             overflow: hidden;
         }
        
        /* 打印时的精确控制 */
        @media print {
            .country {
                font-size: 16px !important;
                font-weight: bold !important;
                text-align: center !important;
                border-bottom: 1px solid #000 !important;
                padding: 0.5mm 1mm 0.5mm 1mm !important;
                margin: 0.5mm 1mm 0.5mm 1mm !important;
                line-height: 1.0 !important;
            }
            
            .sku-section {
                font-size: 11px !important;
                text-align: center !important;
                font-weight: bold !important;
                margin: 0.5mm 1mm 0 1mm !important;
                padding: 0 !important;
                height: 25mm !important;
                overflow: hidden !important;
            }
            
            .sku-item {
                margin: 0.2mm 0 !important;
                padding: 0 !important;
                line-height: 1.0 !important;
                word-break: break-all !important;
            }
            
                         .page-info {
                 position: absolute !important;
                 bottom: 4mm !important;
                 left: 50% !important;
                 transform: translateX(-50%) !important;
                 font-size: 10px !important;
                 font-weight: bold !important;
                 color: #333 !important;
                 text-align: center !important;
             }
             
             .two-column-layout {
                 display: flex !important;
                 justify-content: space-between !important;
                 width: 100% !important;
             }
             
             .left-column,
             .right-column {
                 width: 48% !important;
                 flex-shrink: 0 !important;
             }
             
             .sku-section.double-column {
                 height: 20mm !important;
                 overflow: hidden !important;
             }
        }
    </style>
</head>
<body>
    <div class="no-print" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999; text-align: center; padding: 20px; background: rgba(224, 224, 224, 0.95); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
        <h3 style="margin: 0 0 10px 0; color: #333;">🏷️ 混合箱分页打印</h3>
        <p style="margin: 0 0 10px 0; color: #666;">共 ${allSkus.length} 个SKU，分 ${pages.length} 页打印</p>
                 <p style="margin: 0 0 10px 0; color: #888; font-size: 12px;">每页最多16个SKU（8行×2列），超过8个SKU自动分两列显示</p>
        <button onclick="window.print()" style="padding: 10px 20px; margin-right: 10px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 14px;">🖨️ 开始打印</button>
        <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 14px;">❌ 关闭</button>
        <div style="margin-top: 10px; font-size: 12px; color: #888;">
            ⚠️ 请确保打印机设置为60×40mm热敏纸规格
        </div>
    </div>
    ${pageElements}
    <script class="no-print">
                 console.log('🖨️ 混合箱分页打印：共 ${allSkus.length} 个SKU，分 ${pages.length} 页');
         console.log('📄 每页最多16个SKU（8行×2列），超过8个SKU自动分两列显示');
        window.onload = function() {
            console.log('📄 混合箱分页打印页面已加载');
        };
    </script>
</body>
</html>`.trim();
    }

    /**
     * 生成需求单详情的HTML
     */
    private generateOrderDetailsHTML(orderData: OrderDetailsData): string {
        const { order_summary, order_items } = orderData;
        
        // 计算统计信息
        const totalShipped = order_items.reduce((sum, item) => sum + (item.shipped_quantity || 0), 0);
        const totalRemaining = order_items.reduce((sum, item) => sum + (item.remaining_quantity || 0), 0);
        const totalAvailable = order_items.reduce((sum, item) => sum + (item.total_available || 0), 0);
        const totalShortage = order_items.reduce((sum, item) => sum + (item.shortage || 0), 0);
        // 使用后端传来的库存完成度，保持一致性
        const completionRate = order_summary.completion_rate !== undefined ? 
            order_summary.completion_rate : 
            (order_summary.total_quantity > 0 ? Math.round((totalShipped / order_summary.total_quantity) * 100) : 0);
        
        const itemRows = order_items.map(item => `
            <tr>
                <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${item.record_num}</td>
                <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${item.local_sku || '-'}</td>
                <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${item.sku}</td>
                <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${item.quantity}</td>
                <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${item.shipped_quantity || 0}</td>
                <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${item.remaining_quantity || 0}</td>
                <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${item.total_available || 0}</td>
                <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 14px; font-weight: bold; color: ${(item.shortage || 0) > 0 ? '#ff4d4f' : '#333'};">${item.shortage || 0}</td>
                <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${item.country}</td>
                <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${new Date(item.create_time).toLocaleDateString('zh-CN')}</td>
                <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 12px;">
                    ${item.status === 'completed' ? '✅' : 
                      item.status === 'partial' ? '🔄' : 
                      '⏳'}
                </td>
            </tr>
        `).join('');

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>需求单详情 - ${order_summary.need_num}</title>
    <style>
        @media print {
            body { margin: 0; }
            .no-print { display: none !important; }
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 15px;
            color: #333;
            line-height: 1.3;
        }
        
        .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #1890ff;
            padding-bottom: 15px;
        }
        
        .title {
            font-size: 20px;
            font-weight: bold;
            color: #1890ff;
            margin: 0 0 8px 0;
        }
        
        .subtitle {
            font-size: 14px;
            color: #666;
            margin: 0;
        }
        
        .summary {
            display: flex;
            justify-content: space-around;
            margin-bottom: 20px;
            padding: 12px;
            background: #f5f5f5;
            border-radius: 6px;
        }
        
        .summary-item {
            text-align: center;
            flex: 1;
        }
        
        .summary-label {
            font-size: 11px;
            color: #666;
            margin-bottom: 4px;
        }
        
        .summary-value {
            font-size: 16px;
            font-weight: bold;
            color: #333;
        }
        
        .section {
            margin-bottom: 20px;
        }
        
        .section-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 12px;
            color: #333;
            border-left: 4px solid #1890ff;
            padding-left: 10px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 11px;
        }
        
        th {
            background: #f0f0f0;
            padding: 8px 4px;
            border: 1px solid #ddd;
            font-weight: bold;
            text-align: center;
            font-size: 11px;
        }
        
        th.shortage-header {
            background: #fff2f0;
            color: #ff4d4f;
            font-weight: bold !important;
            font-size: 12px;
            text-shadow: 0.5px 0.5px 0 #ff4d4f;
        }
        
        td {
            padding: 4px;
            border: 1px solid #ddd;
        }
        
        .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            font-size: 11px;
            color: #666;
            text-align: center;
        }
        
        .controls {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
        }
        
        .btn {
            padding: 8px 12px;
            margin-left: 8px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .btn-primary {
            background: #1890ff;
            color: white;
        }
        
        .btn-secondary {
            background: #f5f5f5;
            color: #333;
        }
        
        .btn:hover {
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="controls no-print">
        <button class="btn btn-primary" onclick="window.print()">🖨️ 打印</button>
        <button class="btn btn-secondary" onclick="window.close()">❌ 关闭</button>
    </div>

    <div class="header">
        <h1 class="title">需求单详情</h1>
        <p class="subtitle">需求单号：${order_summary.need_num} | 创建时间：${new Date(order_summary.create_time).toLocaleDateString('zh-CN')}</p>
    </div>

    <div class="summary">
        <div class="summary-item">
            <div class="summary-label">总SKU数</div>
            <div class="summary-value">${order_summary.total_items}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">总需求数量</div>
            <div class="summary-value">${order_summary.total_quantity}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">已发货数量</div>
            <div class="summary-value">${totalShipped}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">剩余数量</div>
            <div class="summary-value">${totalRemaining}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">现有库存</div>
            <div class="summary-value">${totalAvailable}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">缺货数量</div>
            <div class="summary-value">${totalShortage}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">完成进度</div>
            <div class="summary-value">${completionRate}%</div>
        </div>
    </div>

    <div class="section">
        <h2 class="section-title">SKU明细</h2>
        <table>
            <thead>
                <tr>
                    <th>记录号</th>
                    <th>本地SKU</th>
                    <th>Amazon SKU</th>
                    <th>需求数量</th>
                    <th>已发货</th>
                    <th>剩余</th>
                    <th>现有库存</th>
                    <th class="shortage-header">缺货</th>
                    <th>目的地</th>
                    <th>创建时间</th>
                    <th>状态</th>
                </tr>
            </thead>
            <tbody>
                ${itemRows}
            </tbody>
        </table>
    </div>

    <div class="footer">
        <p>打印时间：${new Date().toLocaleString('zh-CN')} | 工作助手PWA系统</p>
    </div>

    <script class="no-print">
        console.log('🖨️ 需求单详情打印页面已加载');
        window.onload = function() {
            console.log('📄 需求单详情页面准备完成');
        };
    </script>
</body>
</html>`.trim();
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