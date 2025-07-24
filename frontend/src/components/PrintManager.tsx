import React, { useState, useEffect } from 'react';
import { Card, Button, Select, Alert, Space, message, Modal, Form, Input, Tag, Divider } from 'antd';
import { PrinterOutlined, SettingOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { printManager } from '../utils/printManager';
import { printConfig, getDeploymentModeText } from '../config/print';

const { Option } = Select;

interface Printer {
  name: string;
  status: string;
}

interface PrintManagerProps {
  visible?: boolean;
  onClose?: () => void;
}

const PrintManagerComponent: React.FC<PrintManagerProps> = ({ visible, onClose }) => {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [printServiceStatus, setPrintServiceStatus] = useState<{
    available: boolean;
    url: string;
    version?: string;
    isCloudDeployment: boolean;
  }>({
    available: false,
    url: printConfig.serviceUrl,
    isCloudDeployment: printConfig.isCloud
  });
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      checkServiceStatus();
    }
  }, [visible]);

  // 检查打印服务状态
  const checkServiceStatus = async () => {
    setLoading(true);
    try {
      const status = await printManager.getServiceStatus();
      setPrintServiceStatus(status);
      
      if (status.available) {
        loadPrinters();
      }
    } catch (error) {
      console.error('检查打印服务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载打印机列表
  const loadPrinters = async () => {
    try {
      const printerList = await printManager.getPrinters();
      setPrinters(printerList);
      
      // 自动选择第一个可用的打印机
      if (printerList.length > 0 && !selectedPrinter) {
        const availablePrinter = printerList.find(p => p.status === 'Ready') || printerList[0];
        setSelectedPrinter(availablePrinter.name);
      }
    } catch (error) {
      message.error('获取打印机列表失败');
      console.error(error);
    }
  };

  // 测试打印
  const handleTestPrint = async () => {
    setTestLoading(true);
    try {
      const success = await printManager.testPrint(selectedPrinter);
      if (success) {
        message.success('测试打印成功');
      } else {
        message.error('测试打印失败');
      }
    } catch (error) {
      message.error('测试打印失败');
      console.error(error);
    } finally {
      setTestLoading(false);
    }
  };

  // 启动本地打印服务的说明
  const renderServiceGuide = () => (
    <Card size="small" title="如何启动打印服务" style={{ marginTop: '16px' }}>
      <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
        <Alert
          message={getDeploymentModeText().mode}
          description={getDeploymentModeText().description}
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />
        <p><strong>步骤1:</strong> 在需要打印的电脑上打开命令行/终端</p>
        <p><strong>步骤2:</strong> 下载项目到本地，进入后端目录</p>
        <div style={{ background: '#f5f5f5', padding: '8px', borderRadius: '4px', fontFamily: 'monospace' }}>
          cd backend
        </div>
        <p><strong>步骤3:</strong> 启动本地打印服务</p>
        <div style={{ background: '#f5f5f5', padding: '8px', borderRadius: '4px', fontFamily: 'monospace' }}>
          node scripts/startPrintService.js
        </div>
        <p><strong>步骤4:</strong> 看到 "🖨️ 打印服务已启动" 提示后，点击上方 "重新检查" 按钮</p>
        
        <Alert
          message="云端部署说明"
          description={
            <div>
              <p>• <strong>本地打印:</strong> 需要在要打印的电脑上运行打印服务</p>
              <p>• <strong>浏览器打印:</strong> 不需要本地服务，直接使用浏览器打印功能</p>
              <p>• <strong>推荐方案:</strong> 使用浏览器打印作为主要方式，本地服务作为增强功能</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginTop: '16px' }}
        />
      </div>
    </Card>
  );

  return (
    <Modal
      title="打印管理"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      <div>
        {/* 服务状态 */}
        <Alert
          message={
            <Space>
              <span>{getDeploymentModeText().mode} - 打印服务:</span>
              <Tag color={printServiceStatus.available ? 'green' : 'red'}>
                {printServiceStatus.available ? '在线' : '离线'}
              </Tag>
              {printServiceStatus.url ? (
                <span style={{ color: '#666' }}>({printServiceStatus.url})</span>
              ) : (
                <span style={{ color: '#666' }}>(浏览器打印模式)</span>
              )}
              {printServiceStatus.version && (
                <Tag color="blue">v{printServiceStatus.version}</Tag>
              )}
            </Space>
          }
          type={printServiceStatus.available ? 'success' : 'warning'}
          showIcon
          icon={printServiceStatus.available ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
          action={
            <Button size="small" onClick={checkServiceStatus} loading={loading}>
              重新检查
            </Button>
          }
        />

        {printServiceStatus.available ? (
          <div style={{ marginTop: '24px' }}>
            {/* 打印机设置 */}
            <Card size="small" title="本地打印机设置">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <span style={{ display: 'inline-block', width: '80px' }}>选择打印机:</span>
                  <Select
                    value={selectedPrinter}
                    onChange={setSelectedPrinter}
                    style={{ width: '300px' }}
                    placeholder="请选择打印机"
                  >
                    {printers.map(printer => (
                      <Option key={printer.name} value={printer.name}>
                        <Space>
                          <span>{printer.name}</span>
                          <Tag color={printer.status === 'Ready' ? 'green' : 'orange'}>
                            {printer.status}
                          </Tag>
                        </Space>
                      </Option>
                    ))}
                  </Select>
                </div>
                
                {printers.length === 0 && (
                  <Alert
                    message="未检测到打印机"
                    description="请确认打印机已正确安装并连接"
                    type="warning"
                    showIcon
                  />
                )}
              </Space>
            </Card>

            {/* 打印测试 */}
            <Card size="small" title="打印测试" style={{ marginTop: '16px' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <span style={{ color: '#666' }}>
                    点击下方按钮测试打印功能，会打印一张测试标签
                  </span>
                </div>
                <Button
                  type="primary"
                  icon={<PrinterOutlined />}
                  onClick={handleTestPrint}
                  loading={testLoading}
                  disabled={!selectedPrinter}
                >
                  测试打印
                </Button>
              </Space>
            </Card>

            {/* 使用说明 */}
            <Card size="small" title="使用说明" style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#666' }}>
                <p>• <strong>本地打印:</strong> 通过本地服务直接发送到打印机</p>
                <p>• <strong>浏览器打印:</strong> 当本地服务不可用时自动使用</p>
                <p>• <strong>标签内容:</strong> 包含记录号、SKU、数量、目的地、操作员等信息</p>
                <p>• <strong>条码功能:</strong> 每个标签包含唯一的条码，便于扫描识别</p>
              </div>
            </Card>
          </div>
        ) : (
          <div>
            {renderServiceGuide()}
            
            {/* 浏览器打印说明 */}
            <Card size="small" title="浏览器打印方式" style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                <Alert
                  message="推荐使用浏览器打印"
                  description="无需安装额外软件，直接使用浏览器的打印功能，适用于云端部署的场景。"
                  type="success"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
                <p><strong>优势:</strong></p>
                <ul>
                  <li>✅ 无需本地服务，云端直接使用</li>
                  <li>✅ 支持所有类型的打印机</li>
                  <li>✅ 可以预览和调整打印效果</li>
                  <li>✅ 支持PDF保存</li>
                </ul>
                <p><strong>使用方法:</strong></p>
                <p>在库存管理或入库页面点击打印按钮，系统会自动生成标签页面并调用浏览器打印功能。</p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </Modal>
  );
};

// 独立的打印状态指示器组件
export const PrintStatusIndicator: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const status = await printManager.getServiceStatus();
      setAvailable(status.available);
    } catch (error) {
      setAvailable(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
    // 每30秒检查一次状态
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Button
      type="text"
      icon={<PrinterOutlined />}
      onClick={onClick}
      loading={checking}
      style={{
        color: available ? '#52c41a' : '#ff4d4f',
        borderColor: available ? '#52c41a' : '#ff4d4f'
      }}
    >
      <Tag color={available ? 'green' : 'red'}>
        打印服务{available ? '可用' : '不可用'}
      </Tag>
    </Button>
  );
};

export default PrintManagerComponent; 