import React, { useState, useRef, useEffect } from 'react';
import { 
  Button, 
  Modal, 
  Input, 
  message, 
  Space, 
  Typography,
  Spin,
  Card,
  Upload,
  Progress,
  Alert,
  Steps,
  Divider
} from 'antd';
import { 
  ToolOutlined, 
  UploadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { API_BASE_URL } from '../config/api';

const { TextArea } = Input;
const { Title, Text } = Typography;
const { Step } = Steps;

interface ChildSkuGeneratorProps {
  onSuccess?: () => void;
}

interface TemplateInfo {
  name: string;
  fileName: string;
  size: number;
  lastModified: string;
  url: string;
}

interface GenerationStatus {
  step: number;
  message: string;
  progress: number;
}

const ChildSkuGenerator: React.FC<ChildSkuGeneratorProps> = ({ onSuccess }) => {
  // 状态管理
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [skuInput, setSkuInput] = useState('');
  const [templateInfo, setTemplateInfo] = useState<TemplateInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>({
    step: 0,
    message: '',
    progress: 0
  });

  // 打开弹窗时重置状态并加载模板
  const handleOpen = () => {
    setVisible(true);
    setCurrentStep(0);
    setSkuInput('');
    setGenerationStatus({ step: 0, message: '', progress: 0 });
    loadTemplateInfo();
  };

  // 关闭弹窗
  const handleClose = () => {
    setVisible(false);
    setLoading(false);
    setUploading(false);
    setUploadProgress(0);
  };

  // 加载模板信息
  const loadTemplateInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/product_weblink/uk-templates`, {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      
      if (response.ok) {
        const result = await response.json();
        const templates = result.data || [];
        setTemplateInfo(templates.length > 0 ? templates[0] : null);
        setCurrentStep(templates.length > 0 ? 1 : 0);
      }
    } catch (error) {
      console.error('加载模板信息失败:', error);
    }
  };

  // 文件上传配置
  const uploadProps = {
    name: 'template',
    action: `${API_BASE_URL}/api/product_weblink/upload-uk-template`,
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    accept: '.xlsx,.xls,.xlsm',
    showUploadList: false,
    beforeUpload: (file: File) => {
      // 文件大小检查
      if (file.size > 50 * 1024 * 1024) {
        message.error('文件大小不能超过50MB');
        return false;
      }
      
      // 文件类型检查
      const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                         'application/vnd.ms-excel',
                         'application/vnd.ms-excel.sheet.macroEnabled.12'];
      
      if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
        message.error('请选择有效的Excel文件（.xlsx、.xls或.xlsm格式）');
        return false;
      }
      
      setUploading(true);
      setUploadProgress(0);
      return true;
    },
    onChange: (info: any) => {
      if (info.file.status === 'uploading') {
        setUploadProgress(info.file.percent || 0);
      } else if (info.file.status === 'done') {
        setUploading(false);
        setUploadProgress(100);
        message.success('模板上传成功');
        loadTemplateInfo();
        setTimeout(() => setUploadProgress(0), 2000);
      } else if (info.file.status === 'error') {
        setUploading(false);
        setUploadProgress(0);
        message.error('模板上传失败');
      }
    },
  };

  // 生成子SKU文件
  const handleGenerate = async () => {
    if (!skuInput.trim()) {
      message.error('请输入需要处理的SKU');
      return;
    }

    if (!templateInfo) {
      message.error('请先上传Excel模板');
      return;
    }

    const skuList = skuInput.split('\n').map(s => s.trim()).filter(Boolean);
    if (skuList.length === 0) {
      message.error('请输入有效的SKU');
      return;
    }

    if (skuList.length > 50) {
      message.error('一次最多处理50个SKU，请分批处理');
      return;
    }

    setLoading(true);
    setCurrentStep(2);
    
    try {
      // 步骤1：准备数据
      setGenerationStatus({
        step: 1,
        message: '正在验证输入数据...',
        progress: 10
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // 步骤2：查询数据库
      setGenerationStatus({
        step: 2,
        message: '正在查询数据库中的子SKU信息...',
        progress: 30
      });

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/product_weblink/child-sku-generator-from-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          parentSkus: skuInput,
          templateObjectName: templateInfo.name
        })
      });

      // 步骤3：生成文件
      setGenerationStatus({
        step: 3,
        message: '正在生成Excel文件...',
        progress: 70
      });

      if (response.ok) {
        // 步骤4：下载文件
        setGenerationStatus({
          step: 4,
          message: '正在下载文件...',
          progress: 90
        });

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // 从响应头获取文件名
        const contentDisposition = response.headers.get('content-disposition');
        let fileName = 'child_skus.xlsx';
        if (contentDisposition) {
          const fileNameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/);
          if (fileNameMatch) {
            fileName = decodeURIComponent(fileNameMatch[1]);
          }
        }
        
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);

        setGenerationStatus({
          step: 4,
          message: '文件下载完成！',
          progress: 100
        });

        message.success('子SKU文件生成成功');
        onSuccess?.();
        
        // 2秒后重置状态
        setTimeout(() => {
          setCurrentStep(1);
          setGenerationStatus({ step: 0, message: '', progress: 0 });
        }, 2000);

      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || '生成失败');
      }

    } catch (error) {
      console.error('生成子SKU文件失败:', error);
      const errorMessage = error instanceof Error ? error.message : '生成失败';
      message.error(errorMessage);
      setCurrentStep(1);
      setGenerationStatus({ step: 0, message: '', progress: 0 });
    } finally {
      setLoading(false);
    }
  };

  // 下载模板文件
  const handleDownloadTemplate = async () => {
    if (!templateInfo) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/product_weblink/uk-template/download/${templateInfo.name}`, {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = templateInfo.fileName;
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
        message.success('模板下载成功');
      } else {
        message.error('模板下载失败');
      }
    } catch (error) {
      console.error('下载模板失败:', error);
      message.error('模板下载失败');
    }
  };

  return (
    <>
      <Button 
        type="primary" 
        icon={<ToolOutlined />} 
        onClick={handleOpen}
        size="large"
      >
        子SKU生成器
      </Button>

      <Modal
        title="子SKU生成器"
        open={visible}
        onCancel={handleClose}
        footer={null}
        width={700}
        maskClosable={false}
      >
        <div style={{ padding: '20px 0' }}>
          {/* 操作步骤 */}
          <Steps current={currentStep} style={{ marginBottom: 30 }}>
            <Step title="上传模板" icon={<UploadOutlined />} />
            <Step title="输入SKU" icon={<FileExcelOutlined />} />
            <Step title="生成文件" icon={<DownloadOutlined />} />
          </Steps>

          {/* 步骤1：模板管理 */}
          {currentStep === 0 && (
            <Card title="步骤1：上传Excel模板" style={{ marginBottom: 20 }}>
              <Alert
                message="请上传包含'Template'工作表的Excel文件"
                description="模板文件第3行必须包含：item_sku、color_name、size_name列"
                type="info"
                style={{ marginBottom: 16 }}
              />
              
              <Upload {...uploadProps}>
                <Button 
                  icon={<UploadOutlined />} 
                  loading={uploading}
                  size="large"
                  block
                >
                  选择Excel模板文件
                </Button>
              </Upload>

              {uploading && (
                <Progress 
                  percent={uploadProgress} 
                  style={{ marginTop: 16 }}
                  status="active"
                />
              )}
            </Card>
          )}

          {/* 步骤2：输入SKU */}
          {currentStep === 1 && (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {/* 模板信息显示 */}
              <Card size="small" title="当前模板">
                <Space>
                  <FileExcelOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                  <div>
                    <Text strong>{templateInfo?.fileName}</Text>
                    <br />
                    <Text type="secondary">
                      {templateInfo && (templateInfo.size / 1024).toFixed(1)} KB • 
                      {templateInfo && new Date(templateInfo.lastModified).toLocaleString('zh-CN')}
                    </Text>
                  </div>
                  <Button 
                    icon={<DownloadOutlined />} 
                    onClick={handleDownloadTemplate}
                    type="link"
                  >
                    下载
                  </Button>
                </Space>
              </Card>

              {/* SKU输入 */}
              <Card title="步骤2：输入需要处理的SKU">
                <TextArea
                  rows={8}
                  placeholder="请输入母SKU，每行一个&#10;例如：&#10;XBC120&#10;DEF456&#10;GHI789"
                  value={skuInput}
                  onChange={(e) => setSkuInput(e.target.value)}
                  style={{ marginBottom: 16 }}
                />
                
                <Space>
                  <Button 
                    type="primary" 
                    icon={<ToolOutlined />}
                    onClick={handleGenerate}
                    loading={loading}
                    disabled={!skuInput.trim()}
                  >
                    生成子SKU文件
                  </Button>
                  <Text type="secondary">
                    已输入 {skuInput.split('\n').filter(s => s.trim()).length} 个SKU
                  </Text>
                </Space>
              </Card>
            </Space>
          )}

          {/* 步骤3：生成进度 */}
          {currentStep === 2 && (
            <Card title="正在生成文件">
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div style={{ textAlign: 'center' }}>
                  <Spin size="large" />
                  <Title level={4} style={{ marginTop: 16 }}>
                    {generationStatus.message}
                  </Title>
                </div>
                
                <Progress 
                  percent={generationStatus.progress}
                  status="active"
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068',
                  }}
                />

                <Steps direction="vertical" size="small" current={generationStatus.step - 1}>
                  <Step title="验证数据" />
                  <Step title="查询数据库" />
                  <Step title="生成Excel文件" />
                  <Step title="下载文件" />
                </Steps>
              </Space>
            </Card>
          )}

          <Divider />

          {/* 功能说明 */}
          <Card size="small" title="功能说明" type="inner">
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>根据输入的母SKU自动查询数据库中的子SKU信息</li>
              <li>按母SKU分组填充，先填写母SKU行（格式：UK+母SKU），再填写子SKU行</li>
              <li>自动填写item_sku、color_name、size_name列</li>
              <li>支持.xlsx、.xls、.xlsm格式的Excel文件</li>
              <li>文件名格式：UK_SKU1_SKU2_SKU3</li>
              <li>一次最多处理50个SKU</li>
            </ul>
          </Card>
        </div>
      </Modal>
    </>
  );
};

export default ChildSkuGenerator; 