import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  InputNumber, 
  message, 
  Space, 
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Divider
} from 'antd';
import { 
  PlusOutlined,
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';

// 自定义样式
const customStyles = `
  .shortage-row {
    background-color: #fff2f0 !important;
  }
  .shortage-row:hover {
    background-color: #ffece6 !important;
  }
  .unmapped-row {
    background-color: #fffbe6 !important;
  }
  .unmapped-row:hover {
    background-color: #fff7e6 !important;
  }
  .inventory-only-row {
    background-color: #f0f9ff !important;
  }
  .inventory-only-row:hover {
    background-color: #e6f4ff !important;
  }
  .sufficient-row {
    background-color: #f6ffed !important;
  }
  .sufficient-row:hover {
    background-color: #f0f9ff !important;
  }
`;

// 注入样式
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = customStyles;
  if (!document.head.querySelector('style[data-shipping-styles]')) {
    styleElement.setAttribute('data-shipping-styles', 'true');
    document.head.appendChild(styleElement);
  }
}

const { Option } = Select;
const { Title, Text } = Typography;



interface MergedShippingData {
  record_num: number;
  need_num: string;
  amz_sku: string;
  local_sku: string;
  quantity: number;
  shipping_method?: string;
  marketplace: string;
  country: string;
  status: '待发货' | '已发货' | '已取消';
  created_at: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  total_available: number;
  shortage: number;
}

interface AddNeedForm {
  sku: string;
  quantity: number;
  shipping_method?: string;
  marketplace: string;
  country: string;
  remark?: string;
}

const ShippingPage: React.FC = () => {
  const { user } = useAuth();
  const [mergedData, setMergedData] = useState<MergedShippingData[]>([]);
  const [mergedLoading, setMergedLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addForm] = Form.useForm();
  const [statusFilter, setStatusFilter] = useState('待发货');
  const [filterType, setFilterType] = useState<string>(''); // 新增：卡片筛选类型



  // 获取合并数据（全部显示，不分页）
  const fetchMergedData = async (status = '待发货') => {
    setMergedLoading(true);
    try {
      const queryParams = new URLSearchParams({
        ...(status && { status }),
        limit: '1000' // 设置较大的限制来获取所有数据
      });
      
      console.log('🔍 合并数据API调用:', `${API_BASE_URL}/api/shipping/merged-data?${queryParams}`);
      
      const response = await fetch(`${API_BASE_URL}/api/shipping/merged-data?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('📊 合并数据API响应:', result);
      
      if (result.code === 0) {
        setMergedData(result.data.list || []);
        message.success(`加载了 ${result.data.list?.length || 0} 条合并数据`);
      } else {
        message.error(result.message || '获取合并数据失败');
      }
    } catch (error) {
      console.error('获取合并数据失败:', error);
      message.error(`获取合并数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
      // 设置空数据以防止界面异常
      setMergedData([]);
    } finally {
      setMergedLoading(false);
    }
  };

  useEffect(() => {
    fetchMergedData(statusFilter);
  }, [statusFilter]);

  // 状态颜色映射
  const getStatusColor = (status: string) => {
    switch (status) {
      case '待发货': return 'orange';
      case '已发货': return 'green';
      case '已取消': return 'red';
      case '有库存无需求': return 'blue';
      default: return 'default';
    }
  };

  // 平台选项
  const marketplaceOptions = [
    'Amazon',
    'eBay', 
    'AliExpress',
    'Walmart',
    'Shopify',
    'Lazada',
    'Shopee'
  ];

  // 国家选项
  const countryOptions = [
    'US', 'UK', 'DE', 'FR', 'IT', 'ES', 'CA', 'JP', 'AU', 'SG', 'MY', 'TH', 'PH', 'ID', 'VN'
  ];

  // 运输方式选项
  const shippingMethodOptions = [
    '空运',
    '海运',
    '快递',
    '陆运',
    '铁运'
  ];



  // 处理列排序
  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    // 排序处理逻辑可以在这里添加
    console.log('排序变更:', sorter);
  };

  // 合并数据表格列定义（重新排序）
  const mergedColumns: ColumnsType<MergedShippingData> = [
    {
      title: '需求单号',
      dataIndex: 'need_num',
      key: 'need_num',
      width: 130,
      ellipsis: true,
      sorter: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      sorter: true,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: 'Amazon SKU',
      dataIndex: 'amz_sku',
      key: 'amz_sku',
      width: 130,
      ellipsis: true,
      sorter: true,
    },
    {
      title: '需求数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 90,
      align: 'center',
      sorter: true,
      render: (value: number) => <Text strong>{value}</Text>,
    },
    {
      title: '缺货数量',
      dataIndex: 'shortage',
      key: 'shortage',
      width: 90,
      align: 'center',
      sorter: true,
      render: (value: number) => (
        value > 0 ? <Text type="danger">{value}</Text> : <Text type="success">充足</Text>
      ),
    },
    {
      title: '可用库存',
      dataIndex: 'total_available',
      key: 'total_available',
      width: 90,
      align: 'center',
      sorter: true,
      render: (value: number) => (
        <Text type={value > 0 ? 'success' : 'danger'}>
          {value}
        </Text>
      ),
    },
    {
      title: '整箱数量',
      dataIndex: 'whole_box_quantity',
      key: 'whole_box_quantity',
      width: 90,
      align: 'center',
      sorter: true,
      render: (value: number) => value || '-',
    },
    {
      title: '混合箱数量',
      dataIndex: 'mixed_box_quantity',
      key: 'mixed_box_quantity',
      width: 90,
      align: 'center',
      sorter: true,
      render: (value: number) => value || '-',
    },
    {
      title: '平台',
      dataIndex: 'marketplace',
      key: 'marketplace',
      width: 90,
      sorter: true,
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 70,
      align: 'center',
      sorter: true,
    },
    {
      title: '运输方式',
      dataIndex: 'shipping_method',
      key: 'shipping_method',
      width: 100,
      sorter: true,
      render: (value: string) => value || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      sorter: true,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
  ];

  // 添加需求
  const handleAdd = async (values: AddNeedForm[]) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/needs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
        body: JSON.stringify({
          needs: values,
          created_by: user?.username
        }),
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success('添加成功');
        setAddModalVisible(false);
        addForm.resetFields();
        fetchMergedData(statusFilter);
      } else {
        message.error(result.message || '添加失败');
      }
    } catch (error) {
      console.error('添加失败:', error);
      message.error(`添加失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>发货需求管理</Title>
      
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAddModalVisible(true)}
          >
            添加需求
          </Button>
        </Col>
        <Col>
          <Select
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
            }}
            style={{ width: 150 }}
          >
            <Option value="">全部状态</Option>
            <Option value="待发货">待发货</Option>
            <Option value="已发货">已发货</Option>
            <Option value="已取消">已取消</Option>
            <Option value="有库存无需求">有库存无需求</Option>
          </Select>
        </Col>
        <Col>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchMergedData(statusFilter)}
          >
            刷新数据
          </Button>
        </Col>
        <Col>
          <Button
            type="default"
            onClick={async () => {
              try {
                const response = await fetch(`${API_BASE_URL}/api/shipping/health`);
                const result = await response.json();
                if (result.code === 0) {
                  message.success(`健康检查通过！发货需求表：${result.data.tables.pbi_warehouse_products_need.count}条，库存表：${result.data.tables.local_boxes.count}条`);
                } else {
                  message.error(`健康检查失败：${result.message}`);
                }
              } catch (error) {
                message.error(`健康检查失败：${error instanceof Error ? error.message : '未知错误'}`);
              }
            }}
          >
            健康检查
          </Button>
        </Col>
        <Col>
          <Button
            type="primary"
            danger
            onClick={async () => {
              try {
                const response = await fetch(`${API_BASE_URL}/api/shipping/debug-mapping`);
                const result = await response.json();
                if (result.code === 0) {
                  console.log('🔧 映射调试结果:', result.data);
                  message.success(`调试完成！查看控制台获取详细信息。映射成功率：${result.data.分析.映射成功数}/${result.data.分析.库存统计结果数}`);
                  
                  // 显示关键信息
                  Modal.info({
                    title: '映射调试结果',
                    width: 800,
                    content: (
                      <div>
                        <p><strong>库存表记录数：</strong>{result.data.分析.库存表记录数}</p>
                        <p><strong>映射表记录数：</strong>{result.data.分析.映射表记录数}</p>
                        <p><strong>需求表记录数：</strong>{result.data.分析.需求表记录数}</p>
                        <p><strong>库存统计结果数：</strong>{result.data.分析.库存统计结果数}</p>
                        <p><strong>正向映射成功数：</strong>{result.data.分析.映射成功数}</p>
                        <p><strong>反向映射成功数：</strong>{result.data.分析.反向映射成功数}</p>
                        <Divider />
                        <p style={{ color: '#666' }}>详细信息请查看浏览器控制台（F12 → Console）</p>
                      </div>
                    ),
                  });
                } else {
                  message.error(`映射调试失败：${result.message}`);
                }
              } catch (error) {
                message.error(`映射调试失败：${error instanceof Error ? error.message : '未知错误'}`);
              }
            }}
          >
            🔧 调试映射
          </Button>
        </Col>
        {filterType && (
          <Col>
            <Button
              onClick={() => setFilterType('')}
              type="dashed"
            >
              清除筛选
            </Button>
          </Col>
        )}
      </Row>

          <Card style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={4}>
                <div 
                  style={{ cursor: 'pointer' }} 
                  onClick={() => setFilterType(filterType === 'needs' ? '' : 'needs')}
                >
                  <Statistic
                    title="发货需求数"
                    value={mergedData.filter(item => item.quantity > 0).length}
                    prefix={<PlusOutlined />}
                    valueStyle={{ color: filterType === 'needs' ? '#1677ff' : undefined }}
                  />
                </div>
              </Col>
              <Col span={4}>
                <div 
                  style={{ cursor: 'pointer' }} 
                  onClick={() => setFilterType(filterType === 'sufficient' ? '' : 'sufficient')}
                >
                  <Statistic
                    title="库存充足需求"
                    value={mergedData.filter(item => item.quantity > 0 && item.shortage === 0).length}
                    valueStyle={{ color: filterType === 'sufficient' ? '#1677ff' : '#3f8600' }}
                    prefix={<CheckOutlined />}
                  />
                </div>
              </Col>
              <Col span={4}>
                <div 
                  style={{ cursor: 'pointer' }} 
                  onClick={() => setFilterType(filterType === 'shortage' ? '' : 'shortage')}
                >
                  <Statistic
                    title="库存不足需求"
                    value={mergedData.filter(item => item.quantity > 0 && item.shortage > 0).length}
                    valueStyle={{ color: filterType === 'shortage' ? '#1677ff' : '#cf1322' }}
                    prefix={<CloseOutlined />}
                  />
                </div>
              </Col>
              <Col span={4}>
                <div 
                  style={{ cursor: 'pointer' }} 
                  onClick={() => setFilterType(filterType === 'unmapped' ? '' : 'unmapped')}
                >
                  <Statistic
                    title="未映射需求"
                    value={mergedData.filter(item => item.quantity > 0 && !item.local_sku).length}
                    valueStyle={{ color: filterType === 'unmapped' ? '#1677ff' : '#fa8c16' }}
                  />
                </div>
              </Col>
              <Col span={4}>
                <div 
                  style={{ cursor: 'pointer' }} 
                  onClick={() => setFilterType(filterType === 'inventory-only' ? '' : 'inventory-only')}
                >
                  <Statistic
                    title="有库存无需求"
                    value={mergedData.filter(item => item.quantity === 0 && item.total_available > 0).length}
                    valueStyle={{ color: filterType === 'inventory-only' ? '#1677ff' : '#1677ff' }}
                  />
                </div>
              </Col>
              <Col span={4}>
                <div 
                  style={{ cursor: 'pointer' }} 
                  onClick={() => setFilterType('')}
                >
                  <Statistic
                    title="总记录数"
                    value={mergedData.length}
                    valueStyle={{ color: filterType === '' ? '#1677ff' : '#666' }}
                  />
                </div>
              </Col>
            </Row>
            <Divider />
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="总缺货数量"
                  value={mergedData.reduce((sum, item) => sum + item.shortage, 0)}
                  valueStyle={{ color: '#cf1322' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="总可用库存"
                  value={mergedData.reduce((sum, item) => sum + item.total_available, 0)}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="总需求数量"
                  value={mergedData.reduce((sum, item) => sum + item.quantity, 0)}
                  valueStyle={{ color: '#1677ff' }}
                />
              </Col>
            </Row>
          </Card>

          <Card size="small" style={{ marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              行颜色说明：
              <Tag color="blue" style={{ marginLeft: 8 }}>蓝色 - 有库存无需求</Tag>
              <Tag color="red" style={{ marginLeft: 4 }}>红色 - 需求缺货</Tag>
              <Tag color="orange" style={{ marginLeft: 4 }}>橙色 - 需求未映射</Tag>
              <Tag color="green" style={{ marginLeft: 4 }}>绿色 - 需求库存充足</Tag>
            </Text>
          </Card>

          <Table
            columns={mergedColumns}
            dataSource={mergedData.filter(item => {
              switch (filterType) {
                case 'needs':
                  return item.quantity > 0;
                case 'sufficient':
                  return item.quantity > 0 && item.shortage === 0;
                case 'shortage':
                  return item.quantity > 0 && item.shortage > 0;
                case 'unmapped':
                  return item.quantity > 0 && !item.local_sku;
                case 'inventory-only':
                  return item.quantity === 0 && item.total_available > 0;
                default:
                  return true; // 显示所有数据
              }
            })}
            rowKey="record_num"
            loading={mergedLoading}
            pagination={false}
            scroll={{ x: 1500 }}
            onChange={handleTableChange}
            rowClassName={(record) => {
              // 有库存无需求的记录
              if (record.quantity === 0 && record.total_available > 0) return 'inventory-only-row';
              // 有需求但缺货的记录
              if (record.quantity > 0 && record.shortage > 0) return 'shortage-row';
              // 有需求但未映射SKU的记录
              if (record.quantity > 0 && !record.local_sku) return 'unmapped-row';
              // 有需求且库存充足的记录
              if (record.quantity > 0 && record.shortage === 0 && record.local_sku) return 'sufficient-row';
              return '';
            }}
          />


      {/* 添加需求模态框 */}
      <Modal
        title="添加发货需求"
        open={addModalVisible}
        onCancel={() => {
          setAddModalVisible(false);
          addForm.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={addForm}
          layout="vertical"
          onFinish={(values) => {
            // 支持批量添加，表单数据转换为数组
            const needsArray = [{
              sku: values.sku,
              quantity: values.quantity,
              shipping_method: values.shipping_method,
              marketplace: values.marketplace,
              country: values.country,
              remark: values.remark
            }];
            handleAdd(needsArray);
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="SKU"
                name="sku"
                rules={[{ required: true, message: '请输入SKU' }]}
              >
                <Input placeholder="请输入SKU" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="数量"
                name="quantity"
                rules={[{ required: true, message: '请输入数量' }]}
              >
                <InputNumber
                  min={1}
                  placeholder="请输入数量"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="平台"
                name="marketplace"
                rules={[{ required: true, message: '请选择平台' }]}
              >
                <Select placeholder="请选择平台">
                  {marketplaceOptions.map(option => (
                    <Option key={option} value={option}>{option}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="国家"
                name="country"
                rules={[{ required: true, message: '请选择国家' }]}
              >
                <Select placeholder="请选择国家">
                  {countryOptions.map(option => (
                    <Option key={option} value={option}>{option}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="运输方式"
                name="shipping_method"
              >
                <Select placeholder="请选择运输方式">
                  {shippingMethodOptions.map(option => (
                    <Option key={option} value={option}>{option}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
              <Button onClick={() => {
                setAddModalVisible(false);
                addForm.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>


    </div>
  );
};

export default ShippingPage; 