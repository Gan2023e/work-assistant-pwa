import React, { useState, useRef } from 'react';
import { 
  Button, 
  Modal, 
  Input, 
  message, 
  Space, 
  Typography,
  Upload,
  Spin
} from 'antd';
import { 
  ToolOutlined, 
  UploadOutlined 
} from '@ant-design/icons';
import { API_BASE_URL } from '../config/api';

const { TextArea } = Input;
const { Text } = Typography;

interface ChildSkuGeneratorProps {
  onSuccess?: () => void;
}

const ChildSkuGenerator: React.FC<ChildSkuGeneratorProps> = ({ onSuccess }) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [skuInput, setSkuInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 重置组件状态
  const resetState = () => {
    setSkuInput('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 处理文件选择
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 验证文件类型
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/vnd.ms-excel.sheet.macroEnabled.12'
      ];
      
      if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
        message.error('请选择有效的Excel文件（.xlsx、.xls或.xlsm格式）');
        return;
      }
      
      setSelectedFile(file);
      message.success(`已选择文件：${file.name}`);
    }
  };

  // 验证输入数据
  const validateInput = (): boolean => {
    if (!skuInput.trim()) {
      message.warning('请输入需要整理的SKU');
      return false;
    }

    if (!selectedFile) {
      message.warning('请选择英国资料表Excel文件');
      return false;
    }

    // 验证SKU格式（基本验证）
    const skuList = skuInput
      .split('\n')
      .map(sku => sku.trim())
      .filter(Boolean);

    if (skuList.length === 0) {
      message.warning('请输入有效的SKU');
      return false;
    }

    return true;
  };

  // 处理文件下载
  const downloadFile = (blob: Blob, customFileName: string) => {
    // 确保文件名有扩展名
    const fileName = customFileName.endsWith('.xlsx') ? customFileName : `${customFileName}.xlsx`;
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    
    // 清理
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  };

  // 显示详细错误对话框
  const showErrorDialog = (error: string, details?: string) => {
    Modal.error({
      title: '处理失败',
      content: (
        <div>
          <p style={{ marginBottom: '12px', fontWeight: 'bold', color: '#ff4d4f' }}>
            {error}
          </p>
          {details && (
            <div>
              <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>详细信息：</p>
              <div style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '8px 12px', 
                borderRadius: '4px',
                border: '1px solid #d9d9d9',
                maxHeight: '200px',
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: '12px',
                whiteSpace: 'pre-wrap'
              }}>
                {details}
              </div>
            </div>
          )}
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
            <p>可能的解决方案：</p>
            <ul style={{ marginLeft: '16px' }}>
              <li>检查输入的SKU是否存在于数据库中</li>
              <li>确认Excel文件格式正确（包含Template工作表）</li>
              <li>验证网络连接是否正常</li>
              <li>联系管理员检查服务器状态</li>
            </ul>
          </div>
        </div>
      ),
      width: 500
    });
  };

  // 主要处理函数
  const handleProcess = async () => {
    if (!validateInput()) {
      return;
    }

    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile!);
      formData.append('parentSkus', skuInput.trim());

      const response = await fetch(`${API_BASE_URL}/api/product_weblink/child-sku-generator`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `请求失败 (HTTP ${response.status})`;
        let errorDetails = '';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          
          // 添加更多错误详情
          if (response.status === 500) {
            errorDetails = `服务器内部错误\n状态码: ${response.status}\n错误信息: ${errorData.message || '未知错误'}\n请求URL: ${response.url}`;
          } else if (response.status === 404) {
            errorDetails = `资源未找到\n状态码: ${response.status}\n可能原因: API端点不存在或SKU数据未找到`;
          } else if (response.status === 400) {
            errorDetails = `请求参数错误\n状态码: ${response.status}\n错误信息: ${errorData.message || '请检查输入的SKU和Excel文件'}`;
          } else {
            errorDetails = `HTTP错误\n状态码: ${response.status}\n状态文本: ${response.statusText}`;
          }
        } catch (parseError) {
          // 如果无法解析JSON响应
          errorDetails = `无法解析服务器响应\n状态码: ${response.status}\n状态文本: ${response.statusText}\n响应类型: ${response.headers.get('content-type') || '未知'}`;
        }
        
        showErrorDialog(errorMessage, errorDetails);
        return;
      }

      // 处理文件下载
      const blob = await response.blob();
      
      if (blob.size === 0) {
        showErrorDialog(
          '返回的文件为空', 
          '可能的原因：\n1. 输入的SKU在数据库中不存在\n2. 数据库查询未返回任何结果\n3. Excel处理过程中出现错误'
        );
        return;
      }

      // 根据输入的SKU生成文件名
      const skuList = skuInput
        .split('\n')
        .map(sku => sku.trim())
        .filter(Boolean);
      
      // 构建文件名：UK + SKU（多个SKU用下划线连接）
      const skuPart = skuList.length === 1 ? skuList[0] : skuList.join('_');
      const fileName = `UK${skuPart}`;
      
      downloadFile(blob, fileName);
      
      message.success('子SKU生成器处理完成，文件已下载');
      
      // 成功后关闭弹窗并重置状态
      setVisible(false);
      resetState();
      
      // 调用成功回调
      onSuccess?.();
      
    } catch (error) {
      console.error('子SKU生成器失败:', error);
      
      // 显示详细错误对话框
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const errorDetails = `错误类型: ${error instanceof Error ? error.name : 'Unknown'}\n错误信息: ${errorMessage}\n发生时间: ${new Date().toLocaleString('zh-CN')}\n\n请检查网络连接和输入数据的正确性。`;
      
      showErrorDialog('处理过程中发生错误', errorDetails);
    } finally {
      setLoading(false);
    }
  };

  // 打开弹窗
  const handleOpen = () => {
    setVisible(true);
  };

  // 关闭弹窗
  const handleCancel = () => {
    if (loading) {
      message.warning('正在处理中，请稍候...');
      return;
    }
    
    setVisible(false);
    resetState();
  };

  return (
    <>
      {/* 触发按钮 */}
      <Button 
        icon={<ToolOutlined />}
        onClick={handleOpen}
        type="default"
      >
        子SKU生成器
      </Button>

      {/* 主弹窗 */}
      <Modal
        title="子SKU生成器"
        open={visible}
        onCancel={handleCancel}
        footer={[
          <Button key="cancel" onClick={handleCancel} disabled={loading}>
            取消
          </Button>,
          <Button 
            key="process" 
            type="primary" 
            onClick={handleProcess}
            loading={loading}
          >
            开始处理
          </Button>
        ]}
        width={600}
        destroyOnClose
        maskClosable={!loading}
      >
        <Spin spinning={loading} tip="正在处理，请稍候...">
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            
            {/* SKU输入区域 */}
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                输入需要整理的SKU：
              </Text>
              <TextArea
                rows={6}
                value={skuInput}
                onChange={(e) => setSkuInput(e.target.value)}
                placeholder="请输入需要整理的母SKU，一行一个&#10;例如：&#10;ABC001&#10;DEF002&#10;GHI003"
                style={{ fontFamily: 'monospace' }}
                disabled={loading}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                支持多个SKU，每行输入一个
              </Text>
            </div>

            {/* 文件选择区域 */}
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                选择英国资料表模板：
              </Text>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                disabled={loading}
              />
              
              <Button 
                icon={<UploadOutlined />}
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                block
                style={{ marginBottom: 8 }}
              >
                选择Excel文件
              </Button>
              
              {selectedFile && (
                <div style={{ 
                  padding: '8px 12px', 
                  backgroundColor: '#f0f9ff', 
                  border: '1px solid #91d5ff',
                  borderRadius: '6px',
                  marginBottom: 8
                }}>
                  <Text style={{ color: '#1890ff', fontSize: '14px' }}>
                    ✓ 已选择：{selectedFile.name}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    大小：{(selectedFile.size / 1024).toFixed(1)} KB
                  </Text>
                </div>
              )}
              
              <Text type="secondary" style={{ fontSize: '12px' }}>
                • 必须包含名为"Template"的工作表<br />
                • 第3行必须包含：item_sku、color_name、size_name列<br />
                • 支持.xlsx、.xls和.xlsm格式
              </Text>
            </div>

            {/* 功能说明 */}
            <div style={{ 
              backgroundColor: '#fafafa', 
              padding: '12px', 
              borderRadius: '6px',
              border: '1px solid #d9d9d9'
            }}>
              <Text strong style={{ color: '#1890ff' }}>功能说明：</Text>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                <li>根据输入的母SKU查询数据库中的子SKU信息</li>
                <li>自动填写item_sku列（UK + 子SKU）</li>
                <li>自动填写color_name列（颜色信息）</li>
                <li>自动填写size_name列（尺寸信息）</li>
                <li>生成处理后的Excel文件供下载</li>
              </ul>
            </div>

          </Space>
        </Spin>
      </Modal>
    </>
  );
};

export default ChildSkuGenerator; 