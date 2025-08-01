import React, { useState } from 'react';
import { Modal, Card, Button, Select, Form, Input, message, Space, Row, Col, AutoComplete, InputNumber } from 'antd';
import { SaveOutlined, UndoOutlined, FileTextOutlined } from '@ant-design/icons';
import { printManager, LabelData } from '../utils/printManager';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';

const { Option } = Select;
const { TextArea } = Input;

interface InventoryCreateModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

interface WholeBoxItem {
  sku: string;
  boxCount: number; // 箱数
  qtyPerBox?: number; // 单箱产品数
  totalQuantity?: number; // 总件数
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
  const { user } = useAuth(); // 获取当前登录用户
  
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
  
  // 临时存储单箱数量（当数据库字段不存在时）
  const [tempQtyPerBox, setTempQtyPerBox] = useState<{[sku: string]: number}>({});

  // 打包员选项
  const packerOptions = [
    { value: '自己打包' },
    { value: '老杜' },
    { value: '老张' }
  ];

  // 国家选项 - 显示中文，存储中文
  const countryOptions = [
    { value: '美国', label: '美国' },
    { value: '英国', label: '英国' },
    { value: '阿联酋', label: '阿联酋' },
    { value: '澳大利亚', label: '澳大利亚' },
    { value: '加拿大', label: '加拿大' }
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
    // 注意：不清除tempQtyPerBox，保持会话期间的数据
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

  // 验证SKU并获取单箱数量
  const validateSku = async (sku: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/inventory/validate-sku`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {})
        },
        body: JSON.stringify({ sku })
      });
      
      if (!response.ok) {
        console.error('SKU验证API请求失败:', response.status, response.statusText);
        return {
          code: 1,
          message: `网络请求失败: ${response.status} ${response.statusText}`
        };
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('SKU验证请求异常:', error);
      return {
        code: 1,
        message: `验证请求失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  };

  // 更新SKU的单箱数量
  const updateQtyPerBox = async (sku: string, qtyPerBox: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/inventory/update-qty-per-box`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {})
        },
        body: JSON.stringify({ sku, qtyPerBox })
      });
      
      if (!response.ok) {
        console.error('更新单箱数量API请求失败:', response.status, response.statusText);
        return {
          code: 1,
          message: `网络请求失败: ${response.status} ${response.statusText}`
        };
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('更新单箱数量请求异常:', error);
      return {
        code: 1,
        message: `更新请求失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  };

  // 将输入文本中的SKU转换为大写
  const formatSkuInput = (text: string): string => {
    if (!text.trim()) return text;
    
    const lines = text.split('\n');
    return lines.map(line => {
      // 保留空行
      if (!line.trim()) return line;
      
      const parts = line.trim().split(/\s+/);
      
      // 如果有至少2个部分（SKU和数量）
      if (parts.length >= 2) {
        // 将整个SKU（第一个部分的所有字符）转换为大写
        const sku = parts[0].toUpperCase();
        const rest = parts.slice(1).join(' ');
        return `${sku} ${rest}`;
      }
      
      // 如果只有一个部分，可能是用户还在输入，也转换为大写
      if (parts.length === 1) {
        return parts[0].toUpperCase();
      }
      
      // 其他情况保持原样
      return line;
    }).join('\n');
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
        const boxCount = parseInt(parts[1]);
        if (sku && !isNaN(boxCount) && boxCount > 0) {
          items.push({ sku, boxCount });
        }
      }
    }
    
    return items;
  };

  // 处理单箱数量缺失的对话框
  const handleMissingQtyPerBox = (sku: string): Promise<number | null> => {
    return new Promise((resolve) => {
      Modal.confirm({
        title: '单箱产品数量缺失',
        content: (
          <div>
            <p>SKU: {sku} 缺少单箱产品数量信息，请输入：</p>
            <InputNumber
              min={1}
              placeholder="请输入单箱产品数量"
              style={{ width: '100%' }}
              id="qty-per-box-input"
            />
          </div>
        ),
        onOk: async () => {
          const input = document.getElementById('qty-per-box-input') as HTMLInputElement;
          const qtyPerBox = parseInt(input?.value || '0');
          if (qtyPerBox > 0) {
            const result = await updateQtyPerBox(sku, qtyPerBox);
            if (result.code === 0) {
              // 如果是临时存储，则保存到本地状态；否则数据库已更新
              if (result.data.temporary) {
                setTempQtyPerBox(prev => ({ ...prev, [sku]: qtyPerBox }));
                message.success('单箱数量已记录（当前会话有效）');
              } else {
                message.success('单箱数量已保存到数据库');
              }
              resolve(qtyPerBox);
            } else {
              message.error('更新失败：' + result.message);
              resolve(null);
            }
          } else {
            message.error('请输入有效的数量');
            resolve(null);
          }
        },
        onCancel: () => resolve(null)
      });
    });
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

      // 验证所有SKU并获取单箱数量
      const validatedItems: WholeBoxItem[] = [];
      
      for (const item of skuItems) {
        // 首先检查临时存储中是否有单箱数量
        const tempQty = tempQtyPerBox[item.sku];
        if (tempQty && tempQty > 0) {
          validatedItems.push({
            ...item,
            qtyPerBox: tempQty,
            totalQuantity: item.boxCount * tempQty
          });
          continue;
        }

        const validation = await validateSku(item.sku);
        
        if (validation.code === 1) {
          // 网络错误或其他技术错误
          message.error(`SKU ${item.sku} 验证失败: ${validation.message}`);
          return;
        } else if (validation.code === 2) {
          // SKU不存在
          message.error(validation.message);
          return;
        } else if (validation.code === 3) {
          // 缺少单箱数量
          const qtyPerBox = await handleMissingQtyPerBox(item.sku);
          if (!qtyPerBox) {
            message.error('操作已取消');
            return;
          }
          validatedItems.push({
            ...item,
            qtyPerBox,
            totalQuantity: item.boxCount * qtyPerBox
          });
        } else if (validation.code === 0) {
          // 验证成功
          validatedItems.push({
            ...item,
            qtyPerBox: validation.data.qtyPerBox,
            totalQuantity: item.boxCount * validation.data.qtyPerBox
          });
        } else {
          // 未知错误代码
          message.error(`SKU ${item.sku} 验证失败: 未知错误代码 ${validation.code}, ${validation.message || '无详细信息'}`);
          return;
        }
      }

      // 准备库存记录数据
      const records = validatedItems.map(item => ({
        sku: item.sku,
        total_quantity: item.totalQuantity!,
        total_boxes: item.boxCount,
        country: values.country,
        operator: user?.username || '系统', // 使用当前登录用户名
        packer: values.packer,
        pre_type: values.pre_type,
        box_type: '整箱',
        remark: values.remark
      }));

      // 调用API创建库存记录
      const response = await fetch(`${API_BASE_URL}/api/inventory/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {})
        },
        body: JSON.stringify({
          records: records
        })
      });

      const data = await response.json();
      if (data.code === 0) {
        message.success(`整箱入库成功，已创建 ${records.length} 条记录`);
        
        // 执行打印功能 - 整箱入库需要为每个SKU的每个箱子单独打印
        if (data.data.records && data.data.records.length > 0) {
          try {
            const allLabels: LabelData[] = [];
            
            // 为每个SKU的每个箱子创建标签数据
            for (const record of (data.data.records as any[])) {
              const totalBoxes = record.total_boxes;
              const singleBoxQuantity = Math.floor(record.total_quantity / totalBoxes);
              
              // 为当前SKU的每个箱子创建一张外箱单
              for (let boxIndex = 1; boxIndex <= totalBoxes; boxIndex++) {
                const labelData: LabelData = {
                  recordId: `${record.记录号}_${boxIndex}`,
                  sku: record.sku,
                  quantity: singleBoxQuantity, // 单箱数量
                  boxes: 1, // 每张标签代表1箱
                  country: record.country,
                  operator: record.操作员,
                  packer: record.打包员,
                  boxType: record.box_type,
                  createTime: record.time,
                  barcode: `${record.记录号}_${boxIndex}`
                };
                allLabels.push(labelData);
              }
            }
            
            // 一次性打印所有标签
            const success = await printManager.printMultipleLabels(allLabels);
            if (success) {
              message.success(`打印任务已发送，共 ${allLabels.length} 张外箱单`);
            } else {
              message.warning('打印失败，但入库成功');
            }
          } catch (error) {
            message.warning('打印失败，但入库成功');
            console.error('打印错误:', error);
          }
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
          operator: user?.username || '系统', // 使用当前登录用户名
          packer: mixedBoxData!.packer,
          pre_type: mixedBoxData!.pre_type,
          box_type: '混合箱',
          mix_box_num: mixBoxNum,
          remark: mixedBoxData!.remark
        }));
        
        allRecords.push(...boxRecords);
      }

                    // 调用API创建混合箱记录
       const response = await fetch(`${API_BASE_URL}/api/inventory/create`, {
        method: 'POST',
         headers: { 
           'Content-Type': 'application/json',
           ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {})
         },
        body: JSON.stringify({
           records: allRecords
        })
      });

      const data = await response.json();
      if (data.code === 0) {
        message.success(`混合箱入库成功，已创建 ${mixedBoxData!.mixedBoxCount} 个混合箱，共 ${allRecords.length} 条记录`);
        
        // 执行打印功能 - 按混合箱分组打印
        if (data.data.records && data.data.records.length > 0) {
          try {
            // 按混合箱编号分组
            const mixedBoxGroups = data.data.records.reduce((groups: any, record: any) => {
              const mixBoxNum = record.mix_box_num;
              if (!groups[mixBoxNum]) {
                groups[mixBoxNum] = [];
              }
              groups[mixBoxNum].push(record);
              return groups;
            }, {});
            
            const allLabels: LabelData[] = [];
            
            // 为每个混合箱创建标签数据
            for (const [mixBoxNum, records] of Object.entries(mixedBoxGroups)) {
              const recordList = records as any[];
              const firstRecord = recordList[0];
              const totalQuantity = recordList.reduce((sum: number, record: any) => sum + record.total_quantity, 0);
              
              const labelData: LabelData = {
                recordId: mixBoxNum,
                sku: `混合箱-${mixBoxNum}`,
                quantity: totalQuantity,
                boxes: 1,
                country: firstRecord.country,
                operator: firstRecord.操作员,
                packer: firstRecord.打包员,
                boxType: '混合箱' as const,
                mixBoxNum: mixBoxNum,
                createTime: firstRecord.time,
                barcode: mixBoxNum,
                qrData: JSON.stringify({
                  mixBoxNum: mixBoxNum,
                  skus: recordList.map(record => ({
                    sku: record.sku,
                    quantity: record.total_quantity
                  })),
                  country: firstRecord.country
                })
              };
              allLabels.push(labelData);
            }
            
            // 一次性打印所有混合箱标签
            const success = await printManager.printMultipleLabels(allLabels);
            if (success) {
              message.success(`打印任务已发送，共 ${allLabels.length} 张混合箱外箱单`);
            } else {
              message.warning('打印失败，但入库成功');
            }
          } catch (error) {
            message.warning('打印失败，但入库成功');
            console.error('打印错误:', error);
          }
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
                      <Option value="平时备货">平时备货</Option>
                      <Option value="旺季备货">旺季备货</Option>
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
                help="每行填写一个SKU及箱数，格式：SKU 箱数（中间用空格隔开）。系统会自动根据单箱产品数计算总件数。"
              >
                <TextArea
                  rows={8}
                  placeholder="示例：&#10;XB362D1 12（表示XB362D1产品12箱）&#10;MK048A4 8（表示MK048A4产品8箱）&#10;..."
                  style={{ fontFamily: 'monospace' }}
                  onBlur={(e) => {
                    const formattedValue = formatSkuInput(e.target.value);
                    form.setFieldsValue({ skuInput: formattedValue });
                  }}
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
                onBlur={(e) => {
                  const formattedValue = formatSkuInput(e.target.value);
                  currentMixedBoxForm.setFieldsValue({ skuInput: formattedValue });
                }}
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