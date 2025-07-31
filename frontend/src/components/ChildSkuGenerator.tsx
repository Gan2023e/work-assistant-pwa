import React, { useState, useRef, useEffect } from 'react';
import { 
  Button, 
  Modal, 
  Input, 
  message, 
  Space, 
  Typography,
  Upload,
  Spin,
  Form,
  Card,
  Alert,
  Tooltip,
  Descriptions,
  Empty
} from 'antd';
import { 
  ToolOutlined, 
  UploadOutlined,
  EyeOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  PlusOutlined,
  SettingOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { API_BASE_URL } from '../config/api';

const { TextArea } = Input;
const { Text } = Typography;

interface ChildSkuGeneratorProps {
  onSuccess?: () => void;
}

interface UKTemplate {
  id: string;
  name: string;
  description: string;
  originalName: string;
  uploadTime: string;
  fileSize: number;
  isDefault: boolean;
  previewUrl: string;
}

const ChildSkuGenerator: React.FC<ChildSkuGeneratorProps> = ({ onSuccess }) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [skuInput, setSkuInput] = useState('');
  
  // 英国模板管理状态（单模板）
  const [currentTemplate, setCurrentTemplate] = useState<UKTemplate | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadForm] = Form.useForm();

  // 重置组件状态
  const resetState = () => {
    setSkuInput('');
  };

  // 加载英国模板信息（单模板）
  const loadCurrentTemplate = async () => {
    try {
      setTemplateLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/product_weblink/uk-template/list`);
      const result = await response.json();
      
      if (result.success && result.data.templates.length > 0) {
        setCurrentTemplate(result.data.templates[0]); // 单模板模式，取第一个
      } else {
        setCurrentTemplate(null);
      }
    } catch (error) {
      console.error('加载英国模板信息失败:', error);
      message.error('加载模板信息失败');
    } finally {
      setTemplateLoading(false);
    }
  };

  // 组件加载时获取模板信息
  useEffect(() => {
    if (visible) {
      loadCurrentTemplate();
    }
  }, [visible]);

  // 验证输入数据
  const validateInput = (): boolean => {
    if (!skuInput.trim()) {
      message.warning('请输入需要整理的SKU');
      return false;
    }

    if (!currentTemplate) {
      message.warning('系统中没有英国资料表模板，请先上传模板');
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
  const downloadFile = (blob: Blob, fileName: string) => {
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
      formData.append('parentSkus', skuInput.trim());
      // 使用英国模板（单模板模式）
      formData.append('useUploadedTemplate', 'false');

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

      // 从响应头获取文件名，支持中文
      const contentDisposition = response.headers.get('content-disposition');
      let fileName = 'processed_template.xlsx';
      
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/);
        if (fileNameMatch) {
          fileName = decodeURIComponent(fileNameMatch[1]);
        }
      }

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

  // 上传新模板
  const handleUploadTemplate = async (values: any) => {
    try {
      const formData = new FormData();
      formData.append('template', values.templateFile.file);
      formData.append('templateName', values.templateName);
      if (values.description) {
        formData.append('description', values.description);
      }

      const response = await fetch(`${API_BASE_URL}/api/product_weblink/uk-template/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        message.success('英国模板上传成功');
        setUploadModalVisible(false);
        uploadForm.resetFields();
        await loadCurrentTemplate(); // 重新加载模板信息
      } else {
        message.error(result.message || '上传失败');
      }
    } catch (error) {
      console.error('上传英国模板失败:', error);
      message.error('上传失败，请重试');
    }
  };

  // 删除模板
  const handleDeleteTemplate = () => {
    Modal.confirm({
      title: '确认删除模板',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除英国资料表模板"${currentTemplate?.name}"吗？删除后如需使用子SKU生成器，需要重新上传模板。`,
      okText: '确定删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/product_weblink/uk-template/delete`, {
            method: 'DELETE'
          });

          const result = await response.json();
          
          if (result.success) {
            message.success('模板删除成功');
            await loadCurrentTemplate(); // 重新加载模板信息
          } else {
            message.error(result.message || '删除失败');
          }
        } catch (error) {
          console.error('删除英国模板失败:', error);
          message.error('删除失败，请重试');
        }
      }
    });
  };

  // 预览模板
  const handlePreviewTemplate = () => {
    if (!currentTemplate) return;
    
    const previewWindow = window.open(
      `${API_BASE_URL}${currentTemplate.previewUrl}`,
      '_blank',
      'width=1200,height=800,scrollbars=yes,resizable=yes'
    );
    
    if (!previewWindow) {
      message.warning('请允许弹窗以预览模板文件');
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
        title="子SKU生成器 - 英国资料表处理"
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
            disabled={!currentTemplate}
          >
            开始处理
          </Button>
        ]}
        width={800}
        destroyOnClose
        maskClosable={!loading}
      >
        <Spin spinning={loading} tip="正在处理，请稍候...">
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            
            {/* SKU输入区域 */}
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                输入需要整理的母SKU：
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

            {/* 英国资料表模板管理 */}
            <Card 
              title={
                <Space>
                  <SettingOutlined />
                  <span>英国资料表模板</span>
                </Space>
              }
              size="small"
              loading={templateLoading}
            >
              {currentTemplate ? (
                <div>
                  {/* 当前模板信息 */}
                  <Alert
                    message="当前模板"
                    description="系统已配置英国资料表模板，可直接使用"
                    type="success"
                    style={{ marginBottom: 16 }}
                  />
                  
                  <Descriptions size="small" column={1}>
                    <Descriptions.Item label="模板名称">
                      <Space>
                        <FileExcelOutlined style={{ color: '#52c41a' }} />
                        <Text strong>{currentTemplate.name}</Text>
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="文件名">{currentTemplate.originalName}</Descriptions.Item>
                    <Descriptions.Item label="文件大小">{formatFileSize(currentTemplate.fileSize)}</Descriptions.Item>
                    <Descriptions.Item label="上传时间">
                      {new Date(currentTemplate.uploadTime).toLocaleString('zh-CN')}
                    </Descriptions.Item>
                    {currentTemplate.description && (
                      <Descriptions.Item label="描述">{currentTemplate.description}</Descriptions.Item>
                    )}
                  </Descriptions>

                  <div style={{ marginTop: 16, textAlign: 'right' }}>
                    <Space>
                      <Button 
                        icon={<EyeOutlined />}
                        onClick={handlePreviewTemplate}
                      >
                        预览模板
                      </Button>
                      <Button 
                        icon={<DeleteOutlined />}
                        danger
                        onClick={handleDeleteTemplate}
                      >
                        删除模板
                      </Button>
                    </Space>
                  </div>

                  {/* 模板使用说明 */}
                  <Alert
                    message="如需更新模板"
                    description="请先删除当前模板，然后上传新的模板文件"
                    type="info"
                    style={{ marginTop: 16 }}
                  />
                </div>
              ) : (
                <div>
                  {/* 没有模板时的状态 */}
                  <Empty
                    image={<FileExcelOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
                    description="尚未上传英国资料表模板"
                  >
                    <Button 
                      type="primary"
                      icon={<UploadOutlined />}
                      onClick={() => setUploadModalVisible(true)}
                    >
                      上传模板
                    </Button>
                  </Empty>

                  <Alert
                    message="使用提示"
                    description="请先上传英国资料表模板才能使用子SKU生成器功能"
                    type="warning"
                    style={{ marginTop: 16 }}
                  />
                </div>
              )}
            </Card>

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
                <li>使用ExcelJS引擎，完美保持Excel原始格式</li>
                <li>自动填写item_sku列（UK + 子SKU）</li>
                <li>自动填写color_name列（颜色信息）</li>
                <li>自动填写size_name列（尺寸信息）</li>
                <li>生成处理后的Excel文件供下载，支持中文文件名</li>
              </ul>
            </div>

          </Space>
        </Spin>
      </Modal>

      {/* 上传模板对话框 */}
      <Modal
        title="上传英国资料表模板"
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false);
          uploadForm.resetFields();
        }}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form
          form={uploadForm}
          layout="vertical"
          onFinish={handleUploadTemplate}
        >
          <Form.Item
            name="templateName"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="例如：英国亚马逊资料表模板V1" />
          </Form.Item>

          <Form.Item
            name="description"
            label="模板描述"
          >
            <TextArea 
              rows={3} 
              placeholder="可选：描述模板的用途或特点"
            />
          </Form.Item>

          <Form.Item
            name="templateFile"
            label="模板文件"
            rules={[{ required: true, message: '请选择模板文件' }]}
          >
            <Upload
              beforeUpload={() => false}
              accept=".xlsx,.xls"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择Excel文件</Button>
            </Upload>
          </Form.Item>

          <Alert
            message="模板要求"
            description={
              <div>
                <p>• 必须包含名为"Template"的工作表</p>
                <p>• 第3行必须包含：item_sku、color_name、size_name列</p>
                <p>• 支持.xlsx和.xls格式</p>
                <p>• 文件将保存到阿里云OSS，支持中文文件名</p>
                <p>• 系统仅支持一个模板，上传新模板前请先删除旧模板</p>
              </div>
            }
            type="info"
            style={{ marginBottom: 16 }}
          />

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setUploadModalVisible(false);
                uploadForm.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                上传模板
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </>
  );
};

export default ChildSkuGenerator; 