import React, { useState } from 'react';
import { 
  Modal, 
  Form, 
  Button, 
  Space, 
  Alert, 
  Table, 
  Card,
  Descriptions,
  Typography,
  message
} from 'antd';
import { 
  FileExcelOutlined,
  DownloadOutlined 
} from '@ant-design/icons';

const { Text } = Typography;

interface ShippingData {
  box_num: string;
  amz_sku: string;
  quantity: number;
  country?: string;
  logisticsProvider?: string;
}

interface LogisticsInvoiceTemplate {
  filename: string;
  originalName: string;
  filePath: string;
  uploadTime: string;
  sheetName: string;
  logisticsProvider: string;
  country: string;
  countryName: string;
  templateFields: {
    [key: string]: string;
  };
  sheetNames: string[];
}

interface LogisticsInvoiceConfig {
  hasTemplate: boolean;
  templates?: Record<string, Record<string, LogisticsInvoiceTemplate>>;
  logisticsProviders?: string[];
  countries?: string[];
}

interface InvoiceGeneratorProps {
  shippingData: ShippingData[];
  logisticsInvoiceConfig: LogisticsInvoiceConfig;
  visible: boolean;
  onClose: () => void;
  currentLogisticsProvider: string;
  currentCountry?: string;
}

const InvoiceGenerator: React.FC<InvoiceGeneratorProps> = ({
  shippingData,
  logisticsInvoiceConfig,
  visible,
  onClose,
  currentLogisticsProvider,
  currentCountry
}) => {
  const [form] = Form.useForm();
  const [generating, setGenerating] = useState(false);

  // 获取当前物流商和国家的模板
  const getCurrentTemplate = () => {
    if (!currentCountry || !logisticsInvoiceConfig.templates?.[currentLogisticsProvider]) {
      return null;
    }
    return logisticsInvoiceConfig.templates[currentLogisticsProvider][currentCountry];
  };

  const currentTemplate = getCurrentTemplate();

  // 生成发票
  const handleGenerateInvoice = async (values: any) => {
    if (!currentTemplate) {
      message.error('未找到对应的发票模板');
      return;
    }

    if (shippingData.length === 0) {
      message.error('没有发货数据');
      return;
    }

    setGenerating(true);
    try {
      // 这里将来可以调用API生成发票
      message.success('发票生成功能开发中，敬请期待！');
      onClose();
    } catch (error) {
      console.error('生成发票失败:', error);
      message.error('生成失败');
    } finally {
      setGenerating(false);
    }
  };

  // 发货数据统计
  const getShippingStats = () => {
    const totalBoxes = shippingData.length;
    const totalQuantity = shippingData.reduce((sum, item) => sum + item.quantity, 0);
    const uniqueSkus = new Set(shippingData.map(item => item.amz_sku)).size;
    
    return { totalBoxes, totalQuantity, uniqueSkus };
  };

  const stats = getShippingStats();

  return (
    <Modal
      title={
        <Space>
          <FileExcelOutlined />
          <span>生成发票</span>
          <Text type="secondary">
            ({currentLogisticsProvider} - {currentTemplate?.countryName || currentCountry})
          </Text>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnClose
    >
      {!currentTemplate ? (
        <Alert
          message="未配置发票模板"
          description={`当前物流商 ${currentLogisticsProvider} 在国家 ${currentCountry} 没有配置发票模板，请先上传对应的模板。`}
          type="warning"
          showIcon
        />
      ) : (
        <div>
          {/* 模板信息 */}
          <Card title="发票模板信息" size="small" style={{ marginBottom: 16 }}>
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="物流商">{currentTemplate.logisticsProvider}</Descriptions.Item>
              <Descriptions.Item label="国家">{currentTemplate.countryName}</Descriptions.Item>
              <Descriptions.Item label="模板文件">{currentTemplate.originalName}</Descriptions.Item>
              <Descriptions.Item label="Sheet页">{currentTemplate.sheetName}</Descriptions.Item>
              <Descriptions.Item label="上传时间" span={2}>
                {new Date(currentTemplate.uploadTime).toLocaleString('zh-CN')}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 发货数据统计 */}
          <Card title="发货数据统计" size="small" style={{ marginBottom: 16 }}>
            <Descriptions size="small" column={3}>
              <Descriptions.Item label="总箱数">{stats.totalBoxes}</Descriptions.Item>
              <Descriptions.Item label="总数量">{stats.totalQuantity}</Descriptions.Item>
              <Descriptions.Item label="SKU种类">{stats.uniqueSkus}</Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 发货清单预览 */}
          <Card title="发货清单预览" size="small" style={{ marginBottom: 16 }}>
            <Table
              dataSource={shippingData.slice(0, 5)} // 只显示前5条作为预览
              columns={[
                { title: '箱号', dataIndex: 'box_num', key: 'box_num', width: 100 },
                { title: 'Amazon SKU', dataIndex: 'amz_sku', key: 'amz_sku' },
                { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80, align: 'center' },
              ]}
              pagination={false}
              size="small"
              rowKey={(record) => `${record.box_num}_${record.amz_sku}`}
            />
            {shippingData.length > 5 && (
              <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
                显示前5条，共{shippingData.length}条记录
              </Text>
            )}
          </Card>

          {/* 发票生成表单 */}
          <Form
            form={form}
            layout="vertical"
            onFinish={handleGenerateInvoice}
          >
            <Alert
              message="发票生成设置"
              description="当前版本为基础发票生成功能，后续将支持更多自定义字段和高级设置。"
              type="info"
              style={{ marginBottom: 16 }}
            />

            <div style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={onClose}>
                  取消
                </Button>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={generating}
                  icon={<DownloadOutlined />}
                >
                  生成并下载发票
                </Button>
              </Space>
            </div>
          </Form>
        </div>
      )}
    </Modal>
  );
};

export default InvoiceGenerator; 