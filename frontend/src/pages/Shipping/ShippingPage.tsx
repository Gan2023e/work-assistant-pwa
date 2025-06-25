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
  Popconfirm,
  Card,
  Row,
  Col,
  Statistic,
  Tabs,
  Typography,
  Divider
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiClient, API_BASE_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';

const { Option } = Select;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface ShippingNeed {
  record_num: number;
  need_num: string;
  sku: string;
  quantity: number;
  shipping_method?: string;
  marketplace: string;
  country: string;
  status: '待发货' | '已发货' | '已取消';
  created_at: string;
  updated_at: string;
  created_by: string;
  remark?: string;
  send_out_date?: string;
  expired_date?: string;
  expect_sold_out_date?: string;
}

interface InventoryStats {
  sku: string;
  country: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  total_quantity: number;
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
  const [needs, setNeeds] = useState<ShippingNeed[]>([]);
  const [inventoryStats, setInventoryStats] = useState<InventoryStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentNeed, setCurrentNeed] = useState<ShippingNeed | null>(null);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [statusFilter, setStatusFilter] = useState('待发货');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  // 获取发货需求列表
  const fetchNeeds = async (page = 1, status = '待发货') => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        ...(status && { status }),
        page: page.toString(),
        limit: pagination.pageSize.toString()
      });
      
      console.log('🔍 发货需求API调用:', `${API_BASE_URL}/api/shipping/needs?${queryParams}`);
      
      const response = await fetch(`${API_BASE_URL}/api/shipping/needs?${queryParams}`, {
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
      console.log('📊 发货需求API响应:', result);
      
      if (result.code === 0) {
        setNeeds(result.data.list || []);
        setPagination(prev => ({
          ...prev,
          current: page,
          total: result.data.total || 0
        }));
        message.success(`加载了 ${result.data.list?.length || 0} 条发货需求`);
      } else {
        message.error(result.message || '获取发货需求失败');
      }
    } catch (error) {
      console.error('获取发货需求失败:', error);
      message.error(`获取发货需求失败: ${error instanceof Error ? error.message : '未知错误'}`);
      // 设置空数据以防止界面异常
      setNeeds([]);
      setPagination(prev => ({ ...prev, total: 0 }));
    } finally {
      setLoading(false);
    }
  };

  // 获取库存统计
  const fetchInventoryStats = async () => {
    try {
      console.log('🔍 库存统计API调用:', `${API_BASE_URL}/api/shipping/inventory-stats`);
      
      const response = await fetch(`${API_BASE_URL}/api/shipping/inventory-stats`, {
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
      console.log('📊 库存统计API响应:', result);
      
      if (result.code === 0) {
        setInventoryStats(result.data || []);
      } else {
        message.error(result.message || '获取库存统计失败');
      }
    } catch (error) {
      console.error('获取库存统计失败:', error);
      message.error(`获取库存统计失败: ${error instanceof Error ? error.message : '未知错误'}`);
      // 设置空数据以防止界面异常
      setInventoryStats([]);
    }
  };

  useEffect(() => {
    fetchNeeds(1, statusFilter);
    fetchInventoryStats();
  }, [statusFilter]);

  // 状态颜色映射
  const getStatusColor = (status: string) => {
    switch (status) {
      case '待发货': return 'orange';
      case '已发货': return 'green';
      case '已取消': return 'red';
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

  // 发货需求表格列定义
  const needsColumns: ColumnsType<ShippingNeed> = [
    {
      title: '需求单号',
      dataIndex: 'need_num',
      key: 'need_num',
      width: 150,
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 150,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      align: 'center',
    },
    {
      title: '运输方式',
      dataIndex: 'shipping_method',
      key: 'shipping_method',
      width: 120,
      render: (value: string) => value || '-',
    },
    {
      title: '平台',
      dataIndex: 'marketplace',
      key: 'marketplace',
      width: 100,
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 80,
      align: 'center',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '创建人',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 100,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这条需求吗？"
            onConfirm={() => handleDelete(record.record_num)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 库存统计表格列定义
  const inventoryColumns: ColumnsType<InventoryStats> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 150,
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 80,
      align: 'center',
    },
    {
      title: '整箱数量',
      dataIndex: 'whole_box_quantity',
      key: 'whole_box_quantity',
      width: 100,
      align: 'center',
      render: (value: number) => (
        <Text type={value >= 0 ? 'success' : 'danger'}>
          {value >= 0 ? `+${value}` : value}
        </Text>
      ),
    },
    {
      title: '整箱箱数',
      dataIndex: 'whole_box_count',
      key: 'whole_box_count',
      width: 100,
      align: 'center',
      render: (value: number) => (
        <Text type={value >= 0 ? 'success' : 'danger'}>
          {value >= 0 ? `+${value}` : value}
        </Text>
      ),
    },
    {
      title: '混合箱数量',
      dataIndex: 'mixed_box_quantity',
      key: 'mixed_box_quantity',
      width: 100,
      align: 'center',
      render: (value: number) => (
        <Text type={value >= 0 ? 'success' : 'danger'}>
          {value >= 0 ? `+${value}` : value}
        </Text>
      ),
    },
    {
      title: '总数量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      width: 100,
      align: 'center',
      render: (value: number) => (
        <Text type={value >= 0 ? 'success' : 'danger'}>
          {value >= 0 ? `+${value}` : value}
        </Text>
      ),
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
        fetchNeeds(pagination.current, statusFilter);
      } else {
        message.error(result.message || '添加失败');
      }
    } catch (error) {
      console.error('添加失败:', error);
      message.error(`添加失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 编辑需求
  const handleEdit = (record: ShippingNeed) => {
    setCurrentNeed(record);
    editForm.setFieldsValue(record);
    setEditModalVisible(true);
  };

  // 更新需求
  const handleUpdate = async (values: Partial<ShippingNeed>) => {
    if (!currentNeed) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/needs/${currentNeed.record_num}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
        body: JSON.stringify(values),
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success('更新成功');
        setEditModalVisible(false);
        setCurrentNeed(null);
        editForm.resetFields();
        fetchNeeds(pagination.current, statusFilter);
      } else {
        message.error(result.message || '更新失败');
      }
    } catch (error) {
      console.error('更新失败:', error);
      message.error(`更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 删除需求
  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/needs/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success('删除成功');
        fetchNeeds(pagination.current, statusFilter);
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 批量更新状态
  const handleBatchUpdateStatus = async (status: string, selectedIds: number[]) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/needs/batch-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
        body: JSON.stringify({
          ids: selectedIds,
          status
        }),
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success('批量更新成功');
        fetchNeeds(pagination.current, statusFilter);
      } else {
        message.error(result.message || '批量更新失败');
      }
    } catch (error) {
      console.error('批量更新失败:', error);
      message.error(`批量更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>发货需求管理</Title>
      
      <Tabs 
        defaultActiveKey="needs" 
        type="card"
        style={{ marginBottom: 24 }}
      >
        <TabPane tab="发货需求" key="needs">
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
                  setPagination(prev => ({ ...prev, current: 1 }));
                }}
                style={{ width: 120 }}
              >
                <Option value="">全部状态</Option>
                <Option value="待发货">待发货</Option>
                <Option value="已发货">已发货</Option>
                <Option value="已取消">已取消</Option>
              </Select>
            </Col>
            <Col>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => fetchNeeds(pagination.current, statusFilter)}
              >
                刷新
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
                type="dashed"
                onClick={async () => {
                  try {
                    const response = await fetch(`${API_BASE_URL}/api/shipping/create-test-data`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
                      },
                    });
                    const result = await response.json();
                    if (result.code === 0) {
                      message.success('测试数据创建成功！');
                      fetchNeeds(pagination.current, statusFilter);
                    } else {
                      message.error(`创建测试数据失败：${result.message}`);
                    }
                  } catch (error) {
                    message.error(`创建测试数据失败：${error instanceof Error ? error.message : '未知错误'}`);
                  }
                }}
              >
                创建测试数据
              </Button>
            </Col>
          </Row>

          <Table
            columns={needsColumns}
            dataSource={needs}
            rowKey="record_num"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
              onChange: (page, pageSize) => {
                setPagination(prev => ({ ...prev, pageSize: pageSize || 10 }));
                fetchNeeds(page, statusFilter);
              }
            }}
            scroll={{ x: 1200 }}
          />
        </TabPane>

        <TabPane tab="库存统计" key="inventory">
          <Card>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Statistic
                  title="有库存SKU数"
                  value={inventoryStats.filter(item => item.total_quantity > 0).length}
                  prefix={<CheckOutlined style={{ color: '#52c41a' }} />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="缺货SKU数"
                  value={inventoryStats.filter(item => item.total_quantity < 0).length}
                  prefix={<CloseOutlined style={{ color: '#ff4d4f' }} />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="总库存数量"
                  value={inventoryStats.reduce((sum, item) => sum + Math.max(0, item.total_quantity), 0)}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="总箱数"
                  value={inventoryStats.reduce((sum, item) => sum + Math.max(0, item.whole_box_count), 0)}
                />
              </Col>
            </Row>
            
            <Divider />
            
            <Table
              columns={inventoryColumns}
              dataSource={inventoryStats.filter(item => item.total_quantity !== 0)}
              rowKey={(record) => `${record.sku}_${record.country}`}
              pagination={{ pageSize: 20 }}
              size="small"
            />
          </Card>
        </TabPane>
      </Tabs>

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

      {/* 编辑需求模态框 */}
      <Modal
        title="编辑发货需求"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setCurrentNeed(null);
          editForm.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleUpdate}
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
            <Col span={12}>
              <Form.Item
                label="状态"
                name="status"
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select placeholder="请选择状态">
                  <Option value="待发货">待发货</Option>
                  <Option value="已发货">已发货</Option>
                  <Option value="已取消">已取消</Option>
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
                更新
              </Button>
              <Button onClick={() => {
                setEditModalVisible(false);
                setCurrentNeed(null);
                editForm.resetFields();
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