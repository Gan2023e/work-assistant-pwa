import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Select, InputNumber, Space, message, Divider, Table, Modal, Tag, Switch, Alert, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, PrinterOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons';
import { printManager, LabelData } from '../utils/printManager';
import type { ColumnsType } from 'antd/es/table';

const { Option } = Select;
const { TextArea } = Input;

interface InventoryItem {
  key: string;
  sku: string;
  total_quantity: number;
  total_boxes: number;
  country: string;
  marketplace: string;
  打包员?: string;
}

interface MixedBoxSku {
  sku: string;
  quantity: number;
  country: string;
  marketplace: string;
}

interface InventoryCreateModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const InventoryCreateModal: React.FC<InventoryCreateModalProps> = ({ visible, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [mixedBoxForm] = Form.useForm();
  
  const [loading, setLoading] = useState(false);
  const [createType, setCreateType] = useState<'single' | 'batch' | 'mixed'>('single');
  const [batchItems, setBatchItems] = useState<InventoryItem[]>([]);
  const [mixedBoxSkus, setMixedBoxSkus] = useState<MixedBoxSku[]>([]);
  const [printAfterCreate, setPrintAfterCreate] = useState(true);
  const [printServiceAvailable, setPrintServiceAvailable] = useState(false);

  // 混合箱模态框
  const [mixedBoxModalVisible, setMixedBoxModalVisible] = useState(false);
  const [tempMixedSku, setTempMixedSku] = useState<MixedBoxSku>({
    sku: '',
    quantity: 1,
    country: '',
    marketplace: ''
  });

  useEffect(() => {
    if (visible) {
      checkPrintService();
    }
  }, [visible]);

  // 检查打印服务
  const checkPrintService = async () => {
    try {
      const available = await printManager.checkPrintService();
      setPrintServiceAvailable(available);
    } catch (error) {
      setPrintServiceAvailable(false);
    }
  };

  // 重置所有状态
  const resetAllStates = () => {
    form.resetFields();
    mixedBoxForm.resetFields();
    setBatchItems([]);
    setMixedBoxSkus([]);
    setCreateType('single');
    setTempMixedSku({
      sku: '',
      quantity: 1,
      country: '',
      marketplace: ''
    });
  };

  // 处理对话框关闭
  const handleCancel = () => {
    resetAllStates();
    onCancel();
  };

  // 单个入库
  const handleSingleCreate = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      const record = {
        sku: values.sku,
        total_quantity: values.total_quantity,
        total_boxes: values.total_boxes,
        country: values.country,
        operator: values.operator || '系统',
        packer: values.packer,
        marketplace: values.marketplace,
        remark: values.remark
      };

      const response = await fetch('/api/inventory/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: [record],
          print: printAfterCreate
        })
      });

      const data = await response.json();
      if (data.code === 0) {
        message.success('入库成功');
        if (printAfterCreate && data.data.printData) {
          message.info('打印任务已发送');
        }
        resetAllStates();
        onSuccess();
      } else {
        message.error(data.message);
      }
    } catch (error) {
      message.error('入库失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 批量入库
  const handleBatchCreate = async () => {
    try {
      if (batchItems.length === 0) {
        message.warning('请先添加库存记录');
        return;
      }

      setLoading(true);
      const baseValues = await form.validateFields(['operator', 'remark']);
      
      const records = batchItems.map(item => ({
        sku: item.sku,
        total_quantity: item.total_quantity,
        total_boxes: item.total_boxes,
        country: item.country,
        operator: baseValues.operator || '系统',
        packer: item.打包员,
        marketplace: item.marketplace,
        remark: baseValues.remark
      }));

      const response = await fetch('/api/inventory/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: records,
          print: printAfterCreate
        })
      });

      const data = await response.json();
      if (data.code === 0) {
        message.success(`批量入库成功，创建了 ${records.length} 条记录`);
        if (printAfterCreate && data.data.printData) {
          message.info(`已发送 ${data.data.printData.length} 个打印任务`);
        }
        resetAllStates();
        onSuccess();
      } else {
        message.error(data.message);
      }
    } catch (error) {
      message.error('批量入库失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 混合箱入库
  const handleMixedBoxCreate = async () => {
    try {
      if (mixedBoxSkus.length === 0) {
        message.warning('请先添加混合箱内的SKU');
        return;
      }

      setLoading(true);
      const values = await mixedBoxForm.validateFields();
      
      const response = await fetch('/api/inventory/create-mixed-box', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mixBoxNum: values.mixBoxNum,
          skus: mixedBoxSkus,
          operator: values.operator || '系统',
          packer: values.packer,
          remark: values.remark,
          print: printAfterCreate
        })
      });

      const data = await response.json();
      if (data.code === 0) {
        message.success(`混合箱入库成功，创建了 ${mixedBoxSkus.length} 条记录`);
        if (printAfterCreate && data.data.printData) {
          message.info(`已发送 ${data.data.printData.length} 个打印任务`);
        }
        resetAllStates();
        onSuccess();
      } else {
        message.error(data.message);
      }
    } catch (error) {
      message.error('混合箱入库失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 添加批量项目
  const addBatchItem = async () => {
    try {
      const values = await form.validateFields(['sku', 'total_quantity', 'total_boxes', 'country', 'marketplace']);
      
      const newItem: InventoryItem = {
        key: Date.now().toString(),
        sku: values.sku,
        total_quantity: values.total_quantity,
        total_boxes: values.total_boxes,
        country: values.country,
        marketplace: values.marketplace,
        打包员: values.packer
      };

      setBatchItems(prev => [...prev, newItem]);
      form.setFieldsValue({
        sku: '',
        total_quantity: undefined,
        total_boxes: undefined,
        packer: ''
      });
      message.success('已添加到批量列表');
    } catch (error) {
      console.error('验证失败:', error);
    }
  };

  // 删除批量项目
  const removeBatchItem = (key: string) => {
    setBatchItems(prev => prev.filter(item => item.key !== key));
  };

  // 添加混合箱SKU
  const addMixedBoxSku = () => {
    if (!tempMixedSku.sku || !tempMixedSku.country) {
      message.warning('请填写完整的SKU信息');
      return;
    }

    if (mixedBoxSkus.some(sku => sku.sku === tempMixedSku.sku)) {
      message.warning('该SKU已存在，请勿重复添加');
      return;
    }

    setMixedBoxSkus(prev => [...prev, { ...tempMixedSku }]);
    setTempMixedSku({
      sku: '',
      quantity: 1,
      country: '',
      marketplace: ''
    });
    message.success('SKU已添加到混合箱');
  };

  // 删除混合箱SKU
  const removeMixedBoxSku = (index: number) => {
    setMixedBoxSkus(prev => prev.filter((_, i) => i !== index));
  };

  // 批量表格列定义
  const batchColumns: ColumnsType<InventoryItem> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
    },
    {
      title: '数量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      render: (value) => `${value} 件`,
    },
    {
      title: '箱数',
      dataIndex: 'total_boxes',
      key: 'total_boxes',
      render: (value) => `${value} 箱`,
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
    },
    {
      title: '市场',
      dataIndex: 'marketplace',
      key: 'marketplace',
    },
    {
      title: '打包员',
      dataIndex: '打包员',
      key: '打包员',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeBatchItem(record.key)}
        >
          删除
        </Button>
      ),
    },
  ];

  // 混合箱SKU表格列定义
  const mixedSkuColumns: ColumnsType<MixedBoxSku> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (value) => `${value} 件`,
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
    },
    {
      title: '市场',
      dataIndex: 'marketplace',
      key: 'marketplace',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record, index) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeMixedBoxSku(index)}
        >
          删除
        </Button>
      ),
    },
  ];

  return (
    <Modal
      title="库存入库"
      open={visible}
      onCancel={handleCancel}
      width={1000}
      footer={null}
      destroyOnClose
    >
      <div style={{ padding: '0 8px' }}>
        {/* 入库类型选择 */}
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Space>
            <span>入库类型:</span>
            <Button
              type={createType === 'single' ? 'primary' : 'default'}
              onClick={() => setCreateType('single')}
            >
              单个入库
            </Button>
            <Button
              type={createType === 'batch' ? 'primary' : 'default'}
              onClick={() => setCreateType('batch')}
            >
              批量入库
            </Button>
            <Button
              type={createType === 'mixed' ? 'primary' : 'default'}
              onClick={() => setCreateType('mixed')}
            >
              混合箱入库
            </Button>
            <Divider type="vertical" />
            <Space>
              <span>入库后打印:</span>
              <Switch
                checked={printAfterCreate}
                onChange={setPrintAfterCreate}
                checkedChildren="开启"
                unCheckedChildren="关闭"
              />
            </Space>
          </Space>
        </Card>

        {/* 单个入库 */}
        {createType === 'single' && (
          <Card title="单个库存入库" size="small">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSingleCreate}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                <Form.Item
                  label="SKU"
                  name="sku"
                  rules={[{ required: true, message: '请输入SKU' }]}
                >
                  <Input placeholder="请输入SKU" />
                </Form.Item>
                <Form.Item
                  label="总数量"
                  name="total_quantity"
                  rules={[{ required: true, message: '请输入总数量' }]}
                >
                  <InputNumber
                    min={1}
                    placeholder="请输入总数量"
                    style={{ width: '100%' }}
                    addonAfter="件"
                  />
                </Form.Item>
                <Form.Item
                  label="总箱数"
                  name="total_boxes"
                  rules={[{ required: true, message: '请输入总箱数' }]}
                >
                  <InputNumber
                    min={1}
                    placeholder="请输入总箱数"
                    style={{ width: '100%' }}
                    addonAfter="箱"
                  />
                </Form.Item>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                <Form.Item
                  label="目的国家"
                  name="country"
                  rules={[{ required: true, message: '请选择国家' }]}
                >
                  <Select placeholder="请选择国家">
                    <Option value="US">美国</Option>
                    <Option value="CA">加拿大</Option>
                    <Option value="UK">英国</Option>
                    <Option value="DE">德国</Option>
                    <Option value="FR">法国</Option>
                    <Option value="IT">意大利</Option>
                    <Option value="ES">西班牙</Option>
                    <Option value="JP">日本</Option>
                  </Select>
                </Form.Item>
                <Form.Item
                  label="市场平台"
                  name="marketplace"
                >
                  <Input placeholder="如: Amazon, eBay" />
                </Form.Item>
                <Form.Item
                  label="操作员"
                  name="operator"
                >
                  <Input placeholder="请输入操作员" />
                </Form.Item>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <Form.Item
                  label="打包员"
                  name="packer"
                >
                  <Input placeholder="请输入打包员" />
                </Form.Item>
              </div>

              <Form.Item
                label="备注"
                name="remark"
              >
                <TextArea rows={3} placeholder="入库备注信息" />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={loading}
                  >
                    确认入库
                  </Button>
                  <Button
                    icon={<UndoOutlined />}
                    onClick={() => form.resetFields()}
                  >
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        )}

        {/* 批量入库 */}
        {createType === 'batch' && (
          <Card title="批量库存入库" size="small">
            <Form form={form} layout="vertical">
              <Divider>添加库存记录</Divider>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr) auto', gap: '8px', alignItems: 'end', marginBottom: '16px' }}>
                <Form.Item
                  label="SKU"
                  name="sku"
                  rules={[{ required: true, message: '请输入SKU' }]}
                >
                  <Input placeholder="请输入SKU" />
                </Form.Item>
                <Form.Item
                  label="数量"
                  name="total_quantity"
                  rules={[{ required: true, message: '请输入数量' }]}
                >
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  label="箱数"
                  name="total_boxes"
                  rules={[{ required: true, message: '请输入箱数' }]}
                >
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  label="国家"
                  name="country"
                  rules={[{ required: true, message: '请选择国家' }]}
                >
                  <Select placeholder="选择国家" style={{ width: '100%' }}>
                    <Option value="US">美国</Option>
                    <Option value="CA">加拿大</Option>
                    <Option value="UK">英国</Option>
                    <Option value="DE">德国</Option>
                    <Option value="FR">法国</Option>
                    <Option value="IT">意大利</Option>
                    <Option value="ES">西班牙</Option>
                    <Option value="JP">日本</Option>
                  </Select>
                </Form.Item>
                <Form.Item
                  label="市场"
                  name="marketplace"
                >
                  <Input placeholder="如: Amazon" />
                </Form.Item>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={addBatchItem}
                >
                  添加
                </Button>
              </div>

              <Table
                columns={batchColumns}
                dataSource={batchItems}
                pagination={false}
                size="small"
                style={{ marginBottom: '16px' }}
                locale={{ emptyText: '暂无记录，请添加' }}
              />

              <Divider>批量操作设置</Divider>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <Form.Item
                  label="操作员"
                  name="operator"
                >
                  <Input placeholder="请输入操作员" />
                </Form.Item>
              </div>

              <Form.Item
                label="批量备注"
                name="remark"
              >
                <TextArea rows={2} placeholder="批量入库备注信息" />
              </Form.Item>

              <Space>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleBatchCreate}
                  loading={loading}
                  disabled={batchItems.length === 0}
                >
                  批量入库 ({batchItems.length} 条记录)
                </Button>
                <Button
                  icon={<UndoOutlined />}
                  onClick={() => {
                    setBatchItems([]);
                    form.resetFields();
                  }}
                >
                  清空重置
                </Button>
              </Space>
            </Form>
          </Card>
        )}

        {/* 混合箱入库 */}
        {createType === 'mixed' && (
          <Card title="混合箱库存入库" size="small">
            <Form form={mixedBoxForm} layout="vertical">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <Form.Item
                  label="混合箱编号"
                  name="mixBoxNum"
                  rules={[{ required: true, message: '请输入混合箱编号' }]}
                >
                  <Input placeholder="如: MIX001" />
                </Form.Item>
                <Form.Item
                  label="操作员"
                  name="operator"
                >
                  <Input placeholder="请输入操作员" />
                </Form.Item>
                <Form.Item
                  label="打包员"
                  name="packer"
                >
                  <Input placeholder="请输入打包员" />
                </Form.Item>
              </div>
              
              <Form.Item
                label="备注"
                name="remark"
              >
                <TextArea rows={2} placeholder="混合箱备注信息" />
              </Form.Item>
            </Form>

            <Divider>混合箱内SKU</Divider>
            
            {/* SKU添加区域 */}
            <Card size="small" title="添加SKU到混合箱" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: '8px', alignItems: 'end' }}>
                <div>
                  <label>SKU</label>
                  <Input
                    value={tempMixedSku.sku}
                    onChange={(e) => setTempMixedSku(prev => ({ ...prev, sku: e.target.value }))}
                    placeholder="请输入SKU"
                  />
                </div>
                <div>
                  <label>数量</label>
                  <InputNumber
                    min={1}
                    value={tempMixedSku.quantity}
                    onChange={(value) => setTempMixedSku(prev => ({ ...prev, quantity: value || 1 }))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label>国家</label>
                  <Select
                    value={tempMixedSku.country}
                    onChange={(value) => setTempMixedSku(prev => ({ ...prev, country: value }))}
                    placeholder="选择国家"
                    style={{ width: '100%' }}
                  >
                    <Option value="US">美国</Option>
                    <Option value="CA">加拿大</Option>
                    <Option value="UK">英国</Option>
                    <Option value="DE">德国</Option>
                    <Option value="FR">法国</Option>
                    <Option value="IT">意大利</Option>
                    <Option value="ES">西班牙</Option>
                    <Option value="JP">日本</Option>
                  </Select>
                </div>
                <div>
                  <label>市场</label>
                  <Input
                    value={tempMixedSku.marketplace}
                    onChange={(e) => setTempMixedSku(prev => ({ ...prev, marketplace: e.target.value }))}
                    placeholder="如: Amazon"
                  />
                </div>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={addMixedBoxSku}
                >
                  添加
                </Button>
              </div>
            </Card>

            <Table
              columns={mixedSkuColumns}
              dataSource={mixedBoxSkus}
              pagination={false}
              size="small"
              style={{ marginBottom: '16px' }}
              locale={{ emptyText: '暂无SKU，请添加' }}
            />

            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleMixedBoxCreate}
                loading={loading}
                disabled={mixedBoxSkus.length === 0}
              >
                创建混合箱 ({mixedBoxSkus.length} 个SKU)
              </Button>
              <Button
                icon={<UndoOutlined />}
                onClick={() => {
                  setMixedBoxSkus([]);
                  mixedBoxForm.resetFields();
                  setTempMixedSku({
                    sku: '',
                    quantity: 1,
                    country: '',
                    marketplace: ''
                  });
                }}
              >
                清空重置
              </Button>
            </Space>
          </Card>
        )}
      </div>
    </Modal>
  );
};

export default InventoryCreateModal; 