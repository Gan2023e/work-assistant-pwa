import React, { useState } from 'react';
import { Card, Button, Alert, Space, message, Modal, Tag } from 'antd';
import { PrinterOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { printManager } from '../utils/printManager';

interface PrintManagerProps {
  visible?: boolean;
  onClose?: () => void;
}

const PrintManagerComponent: React.FC<PrintManagerProps> = ({ visible, onClose }) => {
  const [testLoading, setTestLoading] = useState(false);

  // 测试浏览器打印
  const handleTestPrint = async () => {
    setTestLoading(true);
    try {
      const success = await printManager.testPrint();
      if (success) {
        message.success('测试打印窗口已打开，请使用浏览器打印功能');
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

  return (
    <Modal
      title="打印管理"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <div>
        {/* 打印服务状态 */}
        <Alert
          message={
            <Space>
              <span>浏览器打印服务:</span>
              <Tag color="green">可用</Tag>
              <span style={{ color: '#666' }}>(60x40mm热敏纸)</span>
            </Space>
          }
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
        />

        {/* 打印测试 */}
        <Card size="small" title="打印测试" style={{ marginTop: '16px' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <span style={{ color: '#666' }}>
                点击下方按钮测试打印功能，会在新窗口中生成测试标签
              </span>
            </div>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={handleTestPrint}
              loading={testLoading}
            >
              测试打印
            </Button>
          </Space>
        </Card>

        {/* 使用说明 */}
        <Card size="small" title="使用说明" style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#666' }}>
            <Alert
              message="60x40mm热敏纸打印"
              description="系统已优化为60x40mm热敏纸标签格式，目的国加粗显示在顶部，SKU信息居中显示在下方。"
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />
            <p><strong>打印流程:</strong></p>
            <ul>
              <li>📦 在库存管理页面点击打印按钮</li>
              <li>🖨️ 系统自动生成标签并打开打印窗口</li>
              <li>⚙️ 在打印设置中选择实际尺寸(100%)打印</li>
              <li>✅ 确认后完成打印</li>
            </ul>
            <p><strong>标签内容:</strong></p>
            <ul>
              <li>🌍 <strong>目的国:</strong> 顶部16px黑色加粗显示</li>
              <li>📋 <strong>SKU信息:</strong> 居中12px黑色加粗显示</li>
              <li>📦 <strong>混合箱:</strong> 自动显示所有SKU及数量</li>
            </ul>
          </div>
        </Card>

        {/* 浏览器打印优势 */}
        <Card size="small" title="浏览器打印优势" style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
            <ul>
              <li>✅ 无需安装额外软件或服务</li>
              <li>✅ 支持所有类型的打印机</li>
              <li>✅ 可以预览和调整打印效果</li>
              <li>✅ 支持PDF保存功能</li>
              <li>✅ 适用于云端部署环境</li>
            </ul>
          </div>
        </Card>
      </div>
    </Modal>
  );
};

// 简化的打印状态指示器组件
export const PrintStatusIndicator: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  return (
    <Button
      type="text"
      icon={<PrinterOutlined />}
      onClick={onClick}
      style={{
        color: '#52c41a',
        borderColor: '#52c41a'
      }}
    >
      <Tag color="green">
        浏览器打印可用
      </Tag>
    </Button>
  );
};

export default PrintManagerComponent; 