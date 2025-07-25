import React, { useState, useEffect } from 'react';
import { Modal, Card, Button, Select, Form, Input, message, Space, Row, Col, Divider, AutoComplete } from 'antd';
import { SaveOutlined, UndoOutlined, FileTextOutlined } from '@ant-design/icons';
import { printManager, LabelData } from '../utils/printManager';

const { Option } = Select;
const { TextArea } = Input;

interface InventoryCreateModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

interface WholeBoxItem {
  sku: string;
  quantity: number;
}

interface MixedBoxData {
  pre_type: string;
  packer: string;
  country: string;
  mixedBoxCount: number;
  remark?: string;
}

interface MixedBoxSkuItem {
  sku: string;
  quantity: number;
}

const InventoryCreateModal: React.FC<InventoryCreateModalProps> = ({ visible, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [mixedBoxForm] = Form.useForm();
  const [currentMixedBoxForm] = Form.useForm();
  
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'select' | 'whole-box' | 'mixed-box'>('select');
  
  // 整箱入库相关状态
  const [wholeBoxItems, setWholeBoxItems] = useState<WholeBoxItem[]>([]);
  
  // 混合箱入库相关状态
  const [mixedBoxData, setMixedBoxData] = useState<MixedBoxData | null>(null);
  const [currentMixedBoxIndex, setCurrentMixedBoxIndex] = useState(0);
  const [currentMixedBoxSkus, setCurrentMixedBoxSkus] = useState<MixedBoxSkuItem[]>([]);
  const [allMixedBoxes, setAllMixedBoxes] = useState<{[key: number]: MixedBoxSkuItem[]}>({});
  const [mixedBoxInputModalVisible, setMixedBoxInputModalVisible] = useState(false);

  // 打包员选项
  const packerOptions = [
    { value: '自己打包' },
    { value: '老杜' },
    { value: '老张' }
  ];

  // 国家选项
  const countryOptions = [
    { value: 'US', label: '美国' },
    { value: 'UK', label: '英国' },
    { value: 'AE', label: '阿联酋' },
    { value: 'AU', label: '澳大利亚' },
    { value: 'CA', label: '加拿大' }
  ];

  // 重置所有状态
  const resetAllStates = () => {
    form.resetFields();
    mixedBoxForm.resetFields();
    currentMixedBoxForm.resetFields();
    setStep('select');
    setWholeBoxItems([]);
    setMixedBoxData(null);
    setCurrentMixedBoxIndex(0);
    setCurrentMixedBoxSkus([]);
    setAllMixedBoxes({});
    setMixedBoxInputModalVisible(false);
  };

  // 处理对话框关闭
  const handleCancel = () => {
    resetAllStates();
    onCancel();
  };

  // 选择整箱入库
  const handleSelectWholeBox = () => {
    setStep('whole-box');
  };

  // 选择混合箱入库
  const handleSelectMixedBox = () => {
    setStep('mixed-box');
  };

  // 返回选择页面
  const handleBackToSelect = () => {
    setStep('select');
    form.resetFields();
    mixedBoxForm.resetFields();
    setWholeBoxItems([]);
    setMixedBoxData(null);
  };

  // 解析SKU及箱数输入框内容
  const parseSkuInput = (text: string): WholeBoxItem[] => {
    if (!text.trim()) return [];
    
    const lines = text.split('\n').filter(line => line.trim());
    const items: WholeBoxItem[] = [];
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const sku = parts[0];
        const quantity = parseInt(parts[1]);
        if (sku && !isNaN(quantity) && quantity > 0) {
          items.push({ sku, quantity });
        }
      }
    }
    
    return items;
  };

  // 整箱入库确认
  const handleWholeBoxSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      const skuItems = parseSkuInput(values.skuInput);
      if (skuItems.length === 0) {
        message.error('请输入有效的SKU及箱数信息');
        return;
      }

      // 准备库存记录数据
      const records = skuItems.map(item => ({
        sku: item.sku,
        total_quantity: item.quantity,
        total_boxes: item.quantity, // 整箱入库时，数量即箱数
        country: values.country,
        operator: '系统',
        packer: values.packer,
        pre_type: values.pre_type,
        box_type: '整箱',
        remark: values.remark
      }));

      // 调用API创建库存记录
      const response = await fetch('/api/inventory/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: records,
          print: true // 默认打印
        })
      });

      const data = await response.json();
      if (data.code === 0) {
        message.success(`整箱入库成功，已创建 ${records.length} 条记录`);
        if (data.data.printData) {
          message.info(`已发送 ${data.data.printData.length} 个打印任务`);
        }
        resetAllStates();
        onSuccess();
      } else {
        message.error(data.message);
      }
    } catch (error) {
      message.error('整箱入库失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 提交混合箱基本信息
  const handleMixedBoxInfoSubmit = async () => {
    try {
      const values = await mixedBoxForm.validateFields();
      setMixedBoxData(values);
      setCurrentMixedBoxIndex(0);
      setCurrentMixedBoxSkus([]);
      setAllMixedBoxes({});
      setMixedBoxInputModalVisible(true);
    } catch (error) {
      console.error('验证失败:', error);
    }
  };

  // 解析混合箱SKU输入
  const parseMixedBoxSkuInput = (text: string): MixedBoxSkuItem[] => {
    if (!text.trim()) return [];
    
    const lines = text.split('\n').filter(line => line.trim());
    const items: MixedBoxSkuItem[] = [];
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const sku = parts[0];
        const quantity = parseInt(parts[1]);
        if (sku && !isNaN(quantity) && quantity > 0) {
          items.push({ sku, quantity });
        }
      }
    }
    
    return items;
  };

  // 确认当前混合箱内容
  const handleConfirmCurrentMixedBox = async () => {
    try {
      const values = await currentMixedBoxForm.validateFields();
      const skuItems = parseMixedBoxSkuInput(values.skuInput);
      
      if (skuItems.length === 0) {
        message.error('请输入有效的SKU及数量信息');
        return;
      }

      // 保存当前混合箱的SKU数据
      setAllMixedBoxes(prev => ({
        ...prev,
        [currentMixedBoxIndex]: skuItems
      }));

      const nextIndex = currentMixedBoxIndex + 1;
      
      if (nextIndex < mixedBoxData!.mixedBoxCount) {
        // 还有下一箱
        setCurrentMixedBoxIndex(nextIndex);
        setCurrentMixedBoxSkus([]);
        currentMixedBoxForm.resetFields();
        message.success(`第 ${currentMixedBoxIndex + 1} 箱录入完成，请录入第 ${nextIndex + 1} 箱`);
      } else {
        // 所有箱子都录入完成，提交到后端
        await submitAllMixedBoxes({
          ...allMixedBoxes,
          [currentMixedBoxIndex]: skuItems
        });
      }
    } catch (error) {
      console.error('录入失败:', error);
    }
  };

  // 提交所有混合箱数据
  const submitAllMixedBoxes = async (allBoxes: {[key: number]: MixedBoxSkuItem[]}) => {
    try {
      setLoading(true);
      
      // 为每个混合箱创建记录
      const allRecords: any[] = [];
      
      for (let boxIndex = 0; boxIndex < mixedBoxData!.mixedBoxCount; boxIndex++) {
        const skuItems = allBoxes[boxIndex] || [];
        
        // 生成混合箱编号
        const mixBoxNum = `MIX${Date.now()}_${boxIndex + 1}`;
        
        const boxRecords = skuItems.map(item => ({
          sku: item.sku,
          total_quantity: item.quantity,
          total_boxes: 1, // 混合箱每个SKU都是1箱
          country: mixedBoxData!.country,
          operator: '系统',
          packer: mixedBoxData!.packer,
          pre_type: mixedBoxData!.pre_type,
          box_type: '混合箱',
          mix_box_num: mixBoxNum,
          remark: mixedBoxData!.remark
        }));
        
        allRecords.push(...boxRecords);
      }

      // 调用API创建混合箱记录
      const response = await fetch('/api/inventory/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: allRecords,
          print: true // 默认打印
        })
      });

      const data = await response.json();
      if (data.code === 0) {
        message.success(`混合箱入库成功，已创建 ${mixedBoxData!.mixedBoxCount} 个混合箱，共 ${allRecords.length} 条记录`);
        if (data.data.printData) {
          message.info('已发送打印任务');
        }
        setMixedBoxInputModalVisible(false);
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

  // 取消混合箱录入
  const handleCancelMixedBoxInput = () => {
    setMixedBoxInputModalVisible(false);
    setCurrentMixedBoxIndex(0);
    setCurrentMixedBoxSkus([]);
    setAllMixedBoxes({});
    currentMixedBoxForm.resetFields();
  };

  return (
    <>
      <Modal
        title="库存入库"
        open={visible}
        onCancel={handleCancel}
        width={800}
        footer={null}
        destroyOnClose
      >
        {step === 'select' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <h3>请选择入库类型</h3>
            <Space size="large" style={{ marginTop: '30px' }}>
              <Button 
                type="primary" 
                size="large"
                onClick={handleSelectWholeBox}
                style={{ width: '150px', height: '80px' }}
              >
                <div>
                  <FileTextOutlined style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }} />
                  整箱入库
                </div>
              </Button>
              <Button 
                type="primary" 
                size="large"
                onClick={handleSelectMixedBox}
                style={{ width: '150px', height: '80px' }}
              >
                <div>
                  <FileTextOutlined style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }} />
                  混合箱入库
                </div>
              </Button>
            </Space>
          </div>
        )}

        {step === 'whole-box' && (
          <Card title="整箱入库" size="small">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleWholeBoxSubmit}
            >
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="备货类型"
                    name="pre_type"
                    rules={[{ required: true, message: '请选择备货类型' }]}
                  >
                    <Select placeholder="请选择备货类型">
                      <Option value="旺季备货">旺季备货</Option>
                      <Option value="平时备货">平时备货</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="打包员"
                    name="packer"
                    rules={[{ required: true, message: '请选择打包员' }]}
                  >
                    <AutoComplete
                      options={packerOptions}
                      placeholder="请选择或输入打包员"
                      filterOption={(inputValue, option) =>
                        option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                      }
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="目的国"
                    name="country"
                    rules={[{ required: true, message: '请选择目的国' }]}
                  >
                    <Select placeholder="请选择目的国">
                      {countryOptions.map(option => (
                        <Option key={option.value} value={option.value}>{option.label}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="SKU及箱数"
                name="skuInput"
                rules={[{ required: true, message: '请输入SKU及箱数' }]}
                help="每行填写一个SKU及数量，格式：SKU 数量（中间用空格隔开）"
              >
                <TextArea
                  rows={8}
                  placeholder="示例：&#10;XB362D1 12&#10;MK048A4 8&#10;..."
                  style={{ fontFamily: 'monospace' }}
                />
              </Form.Item>

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
                    onClick={handleBackToSelect}
                  >
                    返回
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        )}

        {step === 'mixed-box' && (
          <Card title="混合箱入库" size="small">
            <Form
              form={mixedBoxForm}
              layout="vertical"
              onFinish={handleMixedBoxInfoSubmit}
            >
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="打包员"
                    name="packer"
                    rules={[{ required: true, message: '请选择打包员' }]}
                  >
                    <AutoComplete
                      options={packerOptions}
                      placeholder="请选择或输入打包员"
                      filterOption={(inputValue, option) =>
                        option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                      }
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="目的国"
                    name="country"
                    rules={[{ required: true, message: '请选择目的国' }]}
                  >
                    <Select placeholder="请选择目的国">
                      {countryOptions.map(option => (
                        <Option key={option.value} value={option.value}>{option.label}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="需要录入的混合箱箱数"
                    name="mixedBoxCount"
                    rules={[{ required: true, message: '请输入混合箱箱数' }]}
                  >
                    <Input type="number" min={1} placeholder="1" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="pre_type" initialValue="平时备货" hidden>
                <Input />
              </Form.Item>

              <Form.Item
                label="备注"
                name="remark"
              >
                <TextArea rows={3} placeholder="混合箱入库备注信息" />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                  >
                    开始录入混合箱
                  </Button>
                  <Button
                    icon={<UndoOutlined />}
                    onClick={handleBackToSelect}
                  >
                    返回
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        )}
      </Modal>

      {/* 混合箱录入对话框 */}
      <Modal
        title={`混合箱第${currentMixedBoxIndex + 1}箱产品信息录入`}
        open={mixedBoxInputModalVisible}
        onCancel={handleCancelMixedBoxInput}
        width={600}
        footer={null}
        destroyOnClose
      >
        <Card size="small">
          <p style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>
            混合箱第{currentMixedBoxIndex + 1}箱产品信息录入：
          </p>
          
          <Form
            form={currentMixedBoxForm}
            layout="vertical"
            onFinish={handleConfirmCurrentMixedBox}
          >
            <Form.Item
              name="skuInput"
              rules={[{ required: true, message: '请输入SKU及数量' }]}
              help="每行填写一个SKU及数量，格式：SKU 数量（中间用空格隔开）"
            >
              <TextArea
                rows={10}
                placeholder="示例：&#10;MK048A4 56&#10;XB362D1 23&#10;..."
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={loading}
                >
                  {currentMixedBoxIndex + 1 < (mixedBoxData?.mixedBoxCount || 0) ? '确认' : '完成录入'}
                </Button>
                <Button
                  icon={<UndoOutlined />}
                  onClick={handleCancelMixedBoxInput}
                >
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </Modal>
    </>
  );
};

export default InventoryCreateModal; 