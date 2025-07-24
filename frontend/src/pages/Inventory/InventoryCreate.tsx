import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Select, InputNumber, Space, message, Divider, Table, Modal, Tag, Switch, Alert, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, PrinterOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons';
import { printManager, LabelData } from '../../utils/printManager';
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

const InventoryCreate: React.FC = () => {
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
    checkPrintService();
  }, []);

  // 检查打印服务
  const checkPrintService = async () => {
    try {
      const available = await printManager.checkPrintService();
      setPrintServiceAvailable(available);
    } catch (error) {
      setPrintServiceAvailable(false);
    }
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
        form.resetFields();
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
        setBatchItems([]);
        form.resetFields();
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
        setMixedBoxSkus([]);
        mixedBoxForm.resetFields();
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
      const values = await form.validateFields(['sku', 'total_quantity', 'total_boxes', 'country', 'marketplace', 'packer']);
      const newItem: InventoryItem = {
        key: Date.now().toString(),
        sku: values.sku,
        total_quantity: values.total_quantity,
        total_boxes: values.total_boxes,
        country: values.country,
        marketplace: values.marketplace,
        打包员: values.packer
      };
      
      setBatchItems([...batchItems, newItem]);
      
      // 清除部分字段，保留操作员等公共信息
      form.setFieldsValue({
        sku: '',
        total_quantity: undefined,
        total_boxes: undefined,
        packer: ''
      });
    } catch (error) {
      // 验证失败
    }
  };

  // 删除批量项目
  const removeBatchItem = (key: string) => {
    setBatchItems(batchItems.filter(item => item.key !== key));
  };

  // 添加混合箱SKU
  const addMixedBoxSku = () => {
    if (!tempMixedSku.sku || !tempMixedSku.country) {
      message.warning('请填写完整的SKU信息');
      return;
    }

    // 检查是否已存在
    const exists = mixedBoxSkus.some(sku => sku.sku === tempMixedSku.sku);
    if (exists) {
      message.warning('该SKU已存在于混合箱中');
      return;
    }

    setMixedBoxSkus([...mixedBoxSkus, { ...tempMixedSku }]);
    setTempMixedSku({
      sku: '',
      quantity: 1,
      country: '',
      marketplace: ''
    });
  };

  // 删除混合箱SKU
  const removeMixedBoxSku = (index: number) => {
    const newSkus = [...mixedBoxSkus];
    newSkus.splice(index, 1);
    setMixedBoxSkus(newSkus);
  };

  // 批量项目表格列
  const batchColumns: ColumnsType<InventoryItem> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku'
    },
    {
      title: '数量',
      dataIndex: 'total_quantity',
      key: 'total_quantity'
    },
    {
      title: '箱数',
      dataIndex: 'total_boxes',
      key: 'total_boxes'
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country'
    },
    {
      title: '市场',
      dataIndex: 'marketplace',
      key: 'marketplace'
    },
    {
      title: '打包员',
      dataIndex: '打包员',
      key: '打包员'
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
      )
    }
  ];

  // 混合箱SKU表格列
  const mixedSkuColumns: ColumnsType<MixedBoxSku> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku'
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity'
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country'
    },
    {
      title: '市场',
      dataIndex: 'marketplace',
      key: 'marketplace'
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
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card title="库存入库" style={{ marginBottom: '16px' }}>
        {/* 打印服务状态 */}
        <Alert
          message={
            <Space>
              <span>打印服务状态:</span>
              <Tag color={printServiceAvailable ? 'green' : 'red'}>
                {printServiceAvailable ? '可用' : '不可用'}
              </Tag>
              {!printServiceAvailable && (
                <span style={{ color: '#666' }}>
                  如需打印功能，请启动本地打印服务
                </span>
              )}
            </Space>
          }
          type={printServiceAvailable ? 'success' : 'warning'}
          style={{ marginBottom: '16px' }}
          showIcon
        />

        {/* 入库类型选择 */}
        <div style={{ marginBottom: '24px' }}>
          <Space size="large">
            <span style={{ fontWeight: 500 }}>入库类型:</span>
            <Button.Group>
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
            </Button.Group>
            <Divider type="vertical" />
            <Space>
              <span>自动打印:</span>
              <Switch
                checked={printAfterCreate}
                onChange={setPrintAfterCreate}
                disabled={!printServiceAvailable}
              />
              <Tooltip title="入库成功后自动打印外箱单">
                <PrinterOutlined style={{ color: '#666' }} />
              </Tooltip>
            </Space>
          </Space>
        </div>

        {/* 单个入库 */}
        {createType === 'single' && (
          <Form form={form} layout="vertical">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
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
                <InputNumber min={1} placeholder="请输入数量" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="箱数"
                name="total_boxes"
                rules={[{ required: true, message: '请输入箱数' }]}
              >
                <InputNumber min={1} placeholder="请输入箱数" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="国家"
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
                label="市场"
                name="marketplace"
                rules={[{ required: true, message: '请输入市场' }]}
              >
                <Input placeholder="如: Amazon" />
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
              <TextArea rows={3} placeholder="请输入备注信息" />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSingleCreate}
                  loading={loading}
                >
                  入库
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
        )}

        {/* 批量入库 */}
        {createType === 'batch' && (
          <div>
            <Form form={form} layout="vertical">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
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
                  <InputNumber min={1} placeholder="请输入数量" style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  label="箱数"
                  name="total_boxes"
                  rules={[{ required: true, message: '请输入箱数' }]}
                >
                  <InputNumber min={1} placeholder="请输入箱数" style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  label="国家"
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
                  label="市场"
                  name="marketplace"
                  rules={[{ required: true, message: '请输入市场' }]}
                >
                  <Input placeholder="如: Amazon" />
                </Form.Item>
                <Form.Item
                  label="打包员"
                  name="packer"
                >
                  <Input placeholder="请输入打包员" />
                </Form.Item>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                <Form.Item
                  label="操作员"
                  name="operator"
                >
                  <Input placeholder="请输入操作员" />
                </Form.Item>
                <div style={{ display: 'flex', alignItems: 'end' }}>
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={addBatchItem}
                    style={{ width: '100%' }}
                  >
                    添加到批量列表
                  </Button>
                </div>
              </div>

              <Form.Item
                label="备注"
                name="remark"
              >
                <TextArea rows={2} placeholder="批量入库备注信息" />
              </Form.Item>
            </Form>

            <Divider>批量入库列表 ({batchItems.length} 项)</Divider>
            
            <Table
              columns={batchColumns}
              dataSource={batchItems}
              pagination={false}
              size="small"
              style={{ marginBottom: '16px' }}
            />

            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleBatchCreate}
                loading={loading}
                disabled={batchItems.length === 0}
              >
                批量入库 ({batchItems.length} 项)
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
          </div>
        )}

        {/* 混合箱入库 */}
        {createType === 'mixed' && (
          <div>
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
          </div>
        )}
      </Card>
    </div>
  );
};

export default InventoryCreate; 