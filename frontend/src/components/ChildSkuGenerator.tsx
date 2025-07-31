import React, { useState, useRef } from 'react';
import { 
  Button, 
  Modal, 
  Input, 
  message, 
  Space, 
  Typography,
  Spin,
  Popconfirm,
  Card
} from 'antd';
import { 
  ToolOutlined, 
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileExcelOutlined
} from '@ant-design/icons';
import { API_BASE_URL } from '../config/api';

const { TextArea } = Input;
const { Text } = Typography;

interface ChildSkuGeneratorProps {
  onSuccess?: () => void;
}

interface TemplateFile {
  name: string;
  fileName: string;
  size: number;
  lastModified: string;
  url: string;
}

const ChildSkuGenerator: React.FC<ChildSkuGeneratorProps> = ({ onSuccess }) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [skuInput, setSkuInput] = useState('');
  const [currentTemplate, setCurrentTemplate] = useState<TemplateFile | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  
  const templateFileInputRef = useRef<HTMLInputElement>(null);

  // 重置组件状态
  const resetState = () => {
    setSkuInput('');
    if (templateFileInputRef.current) {
      templateFileInputRef.current.value = '';
    }
  };

  // 加载当前模板
  const loadCurrentTemplate = async () => {
    setTemplateLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/product_weblink/uk-templates`);
      const result = await response.json();
      
      if (response.ok) {
        const templates = result.data || [];
        // 只取第一个模板作为当前模板
        setCurrentTemplate(templates.length > 0 ? templates[0] : null);
      } else {
        message.error(result.message || '加载模板失败');
      }
    } catch (error) {
      console.error('加载模板失败:', error);
      message.error('加载模板失败');
    } finally {
      setTemplateLoading(false);
    }
  };

  // 上传模板文件
  const handleTemplateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

    setUploadLoading(true);
    
    try {
      // 如果存在当前模板，先删除OSS中的原文件
      if (currentTemplate) {
        try {
          const deleteResponse = await fetch(`${API_BASE_URL}/api/product_weblink/uk-template/${currentTemplate.name}`, {
            method: 'DELETE',
          });

          if (!deleteResponse.ok) {
            const deleteResult = await deleteResponse.json();
            console.warn('删除原模板文件失败:', deleteResult.message);
            // 继续上传，不阻断流程
          } else {
            console.log('✅ 原模板文件已从OSS删除');
          }
        } catch (deleteError) {
          console.warn('删除原模板文件时出错:', deleteError);
          // 继续上传，不阻断流程
        }
      }

      // 上传新模板文件
      const formData = new FormData();
      formData.append('template', file);

      const response = await fetch(`${API_BASE_URL}/api/product_weblink/upload-uk-template`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        message.success('模板文件上传成功');
        loadCurrentTemplate(); // 重新加载当前模板
        if (templateFileInputRef.current) {
          templateFileInputRef.current.value = '';
        }
      } else {
        message.error(result.message || '上传失败');
      }
    } catch (error) {
      console.error('上传模板文件失败:', error);
      message.error('上传失败');
    } finally {
      setUploadLoading(false);
    }
  };

  // 下载模板文件
  const handleTemplateDownload = async () => {
    if (!currentTemplate) {
      message.warning('没有可下载的模板文件');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/product_weblink/uk-template/download/${currentTemplate.name}`, {
        method: 'GET',
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = currentTemplate.fileName;
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
        message.success('模板文件下载成功');
      } else {
        const errorData = await response.json();
        message.error(errorData.message || '下载失败');
      }
    } catch (error) {
      console.error('下载模板文件失败:', error);
      message.error('下载失败');
    }
  };

  // 删除模板文件
  const handleTemplateDelete = async () => {
    if (!currentTemplate) {
      message.warning('没有可删除的模板文件');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/product_weblink/uk-template/${currentTemplate.name}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (response.ok) {
        message.success('模板文件删除成功');
        setCurrentTemplate(null); // 清除当前模板
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除模板文件失败:', error);
      message.error('删除失败');
    }
  };

  // 验证输入数据
  const validateInput = (): boolean => {
    if (!skuInput.trim()) {
      message.warning('请输入需要整理的SKU');
      return false;
    }

    if (!currentTemplate) {
      message.warning('请先上传英国资料表模板');
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
  const downloadFile = (blob: Blob, originalFileName: string) => {
    // 从原文件名提取名称和扩展名
    const lastDotIndex = originalFileName.lastIndexOf('.');
    const nameWithoutExt = lastDotIndex > 0 ? originalFileName.substring(0, lastDotIndex) : originalFileName;
    const extension = lastDotIndex > 0 ? originalFileName.substring(lastDotIndex) : '.xlsx';
    
    // 生成时间戳
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
    
    // 构建新文件名：原名称_时间戳.扩展名
    const newFileName = `${nameWithoutExt}_${timestamp}${extension}`;
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = newFileName;
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
              <li>确认模板文件格式正确（包含Template工作表）</li>
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
      // 显示处理开始提示
      message.loading('正在处理子SKU生成请求...', 0);
      
      console.log('🚀 开始子SKU生成处理');
      
      const response = await fetch(`${API_BASE_URL}/api/product_weblink/child-sku-generator-from-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parentSkus: skuInput.trim(),
          templateObjectName: currentTemplate!.name
        }),
      });

      // 关闭loading提示
      message.destroy();

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
            errorDetails = `资源未找到\n状态码: ${response.status}\n可能原因: 模板文件不存在或SKU数据未找到`;
          } else if (response.status === 400) {
            errorDetails = `请求参数错误\n状态码: ${response.status}\n错误信息: ${errorData.message || '请检查输入的SKU和模板文件'}`;
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

      console.log('📥 开始下载生成的文件');
      message.loading('正在准备下载文件...', 0);

      // 处理文件下载
      const blob = await response.blob();
      
      message.destroy();
      
      if (blob.size === 0) {
        showErrorDialog(
          '返回的文件为空', 
          '可能的原因：\n1. 输入的SKU在数据库中不存在\n2. 数据库查询未返回任何结果\n3. Excel处理过程中出现错误'
        );
        return;
      }

      console.log(`📁 文件大小: ${(blob.size / 1024).toFixed(1)} KB`);
      
      // 使用模板文件名+时间戳
      downloadFile(blob, currentTemplate!.fileName);
      
      message.success('子SKU生成器处理完成，文件已下载');
      
      // 成功后关闭弹窗并重置状态
      setVisible(false);
      resetState();
      
      // 调用成功回调
      onSuccess?.();
      
    } catch (error) {
      message.destroy();
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
    loadCurrentTemplate(); // 加载当前模板
  };

  // 关闭弹窗
  const handleCancel = () => {
    if (loading || uploadLoading) {
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
        width={700}
        destroyOnClose
        maskClosable={!loading && !uploadLoading}
      >
        <Spin spinning={loading} tip={
          loading ? "正在生成子SKU，请耐心等待..." : "正在处理，请稍候..."
        }>
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

            {/* 管理英国资料表模板区域 */}
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                管理英国资料表模板：
              </Text>
              
              <Spin spinning={templateLoading}>
                {currentTemplate ? (
                  // 显示当前模板
                  <Card
                    size="small"
                    style={{ marginBottom: 12 }}
                  >
                    <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <FileExcelOutlined style={{ color: '#52c41a', fontSize: '20px' }} />
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{currentTemplate.fileName}</div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            {(currentTemplate.size / 1024).toFixed(1)} KB • {new Date(currentTemplate.lastModified).toLocaleString('zh-CN')}
                          </div>
                        </div>
                      </Space>
                      <Space>
                        <Button
                          type="link"
                          icon={<DownloadOutlined />}
                          onClick={handleTemplateDownload}
                          size="small"
                          disabled={loading}
                        >
                          下载
                        </Button>
                        <Popconfirm
                          title="确定要删除这个模板文件吗？删除后将同步从阿里云OSS中移除。"
                          onConfirm={handleTemplateDelete}
                          okText="确定"
                          cancelText="取消"
                          disabled={loading}
                        >
                          <Button
                            type="link"
                            danger
                            icon={<DeleteOutlined />}
                            size="small"
                            disabled={loading}
                          >
                            删除
                          </Button>
                        </Popconfirm>
                      </Space>
                    </Space>
                  </Card>
                ) : (
                  // 显示上传区域
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '20px', 
                    border: '2px dashed #d9d9d9',
                    borderRadius: '6px',
                    marginBottom: 12
                  }}>
                    <FileExcelOutlined style={{ fontSize: '32px', color: '#d9d9d9', marginBottom: 8 }} />
                    <div style={{ color: '#999', marginBottom: 12 }}>
                      暂未上传英国资料表模板
                    </div>
                  </div>
                )}
              </Spin>

              {/* 上传按钮 */}
              <input
                ref={templateFileInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={handleTemplateUpload}
                style={{ display: 'none' }}
                disabled={uploadLoading || loading}
              />
              
              <Button 
                icon={<UploadOutlined />}
                onClick={() => templateFileInputRef.current?.click()}
                loading={uploadLoading}
                block
                style={{ marginBottom: 8 }}
                disabled={loading}
              >
                {currentTemplate ? '重新上传模板文件' : '上传Excel模板文件'}
              </Button>
              
              <Text type="secondary" style={{ fontSize: '12px' }}>
                • 支持.xlsx、.xls和.xlsm格式的Excel文件<br />
                • 模板将上传到阿里云OSS的"templates/excel/amazon/UK/"文件夹<br />
                • 模板必须包含名为"Template"的工作表，第3行必须包含：item_sku、color_name、size_name列
              </Text>
            </div>

            {/* 性能优化说明 */}
            {loading && (
              <div style={{ 
                backgroundColor: '#e6f7ff', 
                padding: '12px', 
                borderRadius: '6px',
                border: '1px solid #91d5ff'
              }}>
                <Text style={{ color: '#1890ff' }}>
                  <strong>正在处理中...</strong><br />
                  • 正在下载并解析模板文件<br />
                  • 正在查询数据库中的子SKU信息<br />
                  • 正在生成包含子SKU数据的Excel文件<br />
                  • 处理完成后将自动下载文件
                </Text>
              </div>
            )}

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
                <li>✨ 优化后处理速度更快，支持模板缓存</li>
              </ul>
            </div>

          </Space>
        </Spin>
      </Modal>
    </>
  );
};

export default ChildSkuGenerator; 