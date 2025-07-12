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
  Popconfirm,
  Tooltip
} from 'antd';
import { 
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ExportOutlined,
  WarningOutlined,
  InboxOutlined,
  BoxPlotOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';

const { Option } = Select;
const { Title, Text } = Typography;

// 待发货库存数据接口
interface PendingInventoryItem {
  record_num: number;
  need_num: string;
  amz_sku: string;
  local_sku: string;
  quantity: number;
  original_quantity: number;
  shipped_quantity: number;
  shipping_method?: string;
  marketplace: string;
  country: string;
  status: '待发货' | '已发货' | '已取消' | '有库存无需求' | '库存未映射';
  created_at: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  total_available: number;
  shortage: number;
}

// 国家库存汇总接口
interface CountryInventory {
  country: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  mixed_box_count: number;
  total_quantity: number;
}

const PendingInventoryPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<PendingInventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<PendingInventoryItem[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PendingInventoryItem | null>(null);
  const [editForm] = Form.useForm();
  const [countryInventory, setCountryInventory] = useState<CountryInventory[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('待发货');

  // 分页状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0
  });

  // 获取待发货库存数据
  const fetchPendingInventory = async (page = 1, pageSize = 50) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        status: filterStatus,
      });
      
      if (selectedCountry) {
        queryParams.append('country', selectedCountry);
      }

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
      
      if (result.code === 0) {
        // 过滤待发货和有库存的记录
        const filteredData = (result.data.list || []).filter((item: PendingInventoryItem) => {
          if (filterStatus === '待发货') {
            return item.status === '待发货' && item.quantity > 0;
          } else if (filterStatus === '有库存无需求') {
            return item.status === '有库存无需求' && item.total_available > 0;
          }
          return item.status === filterStatus;
        });
        
        setData(filteredData);
        setPagination(prev => ({
          ...prev,
          current: page,
          total: filteredData.length
        }));
        
        message.success(`加载了 ${filteredData.length} 条待发货库存记录`);
      } else {
        message.error(result.message || '获取数据失败');
      }
    } catch (error) {
      console.error('获取待发货库存失败:', error);
      message.error(`获取数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // 获取国家库存数据
  const fetchCountryInventory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/inventory-by-country`, {
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
      
      if (result.code === 0) {
        setCountryInventory(result.data || []);
      } else {
        console.error('获取国家库存数据失败:', result.message);
      }
    } catch (error) {
      console.error('获取国家库存数据失败:', error);
    }
  };

  useEffect(() => {
    fetchPendingInventory();
    fetchCountryInventory();
  }, [filterStatus, selectedCountry]);

  // 状态颜色映射
  const getStatusColor = (status: string) => {
    switch (status) {
      case '待发货': return 'orange';
      case '已发货': return 'green';
      case '已取消': return 'red';
      case '有库存无需求': return 'blue';
      case '库存未映射': return 'purple';
      default: return 'default';
    }
  };

  // 编辑库存数量
  const handleEdit = (record: PendingInventoryItem) => {
    setEditingRecord(record);
    editForm.setFieldsValue({
      quantity: record.quantity,
      shipping_method: record.shipping_method,
      marketplace: record.marketplace,
      status: record.status
    });
    setEditModalVisible(true);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields();
      
      if (!editingRecord) return;

      // 检查修改后的数量不能小于已发货数量
      if (values.quantity < editingRecord.shipped_quantity) {
        message.error(`修改后的数量(${values.quantity})不能小于已发货数量(${editingRecord.shipped_quantity})`);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/order-management/orders/${editingRecord.need_num}/items/${editingRecord.record_num}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
        body: JSON.stringify({
          quantity: values.quantity,
          shipping_method: values.shipping_method,
          marketplace: values.marketplace,
          status: values.status
        }),
      });

      const result = await response.json();
      
      if (result.code === 0) {
        message.success('修改成功');
        setEditModalVisible(false);
        fetchPendingInventory();
      } else {
        message.error(result.message || '修改失败');
      }
    } catch (error) {
      console.error('修改失败:', error);
      message.error('修改失败');
    }
  };

  // 删除单个记录
  const handleDelete = async (record: PendingInventoryItem) => {
    try {
      // 检查是否已有发货记录
      if (record.shipped_quantity > 0) {
        message.error(`该记录已有 ${record.shipped_quantity} 件发货，无法删除`);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/shipping/needs/${record.record_num}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
      });

      const result = await response.json();
      
      if (result.code === 0) {
        message.success('删除成功');
        fetchPendingInventory();
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的记录');
      return;
    }

    // 检查选中记录是否有已发货的
    const hasShipped = selectedRows.some(row => row.shipped_quantity > 0);
    if (hasShipped) {
      message.error('选中记录中有已发货的记录，无法删除');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/needs/batch-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
        body: JSON.stringify({
          record_nums: selectedRowKeys
        }),
      });

      const result = await response.json();
      
      if (result.code === 0) {
        message.success(`成功删除 ${selectedRowKeys.length} 条记录`);
        setSelectedRowKeys([]);
        setSelectedRows([]);
        fetchPendingInventory();
      } else {
        message.error(result.message || '批量删除失败');
      }
    } catch (error) {
      console.error('批量删除失败:', error);
      message.error('批量删除失败');
    }
  };

  // 导出数据
  const handleExport = () => {
    if (data.length === 0) {
      message.warning('没有数据可导出');
      return;
    }

    const exportData = data.map(item => ({
      '需求单号': item.need_num,
      'Amazon SKU': item.amz_sku,
      '本地SKU': item.local_sku,
      '需求数量': item.quantity,
      '原始数量': item.original_quantity,
      '已发货数量': item.shipped_quantity,
      '可用库存': item.total_available,
      '整箱数量': item.whole_box_quantity,
      '整箱数': item.whole_box_count,
      '混合箱数量': item.mixed_box_quantity,
      '缺货数量': item.shortage,
      '运输方式': item.shipping_method || '',
      '平台': item.marketplace,
      '国家': item.country,
      '状态': item.status,
      '创建时间': new Date(item.created_at).toLocaleString('zh-CN')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '待发货库存');
    XLSX.writeFile(wb, `待发货库存_${new Date().toISOString().split('T')[0]}.xlsx`);
    message.success('导出成功');
  };

  // 表格列定义
  const columns: ColumnsType<PendingInventoryItem> = [
    {
      title: '需求单号',
      dataIndex: 'need_num',
      key: 'need_num',
      width: 120,
      fixed: 'left',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: 'Amazon SKU',
      dataIndex: 'amz_sku',
      key: 'amz_sku',
      width: 150,
      render: (text: string) => <Text>{text}</Text>
    },
    {
      title: '本地SKU',
      dataIndex: 'local_sku',
      key: 'local_sku',
      width: 120,
      render: (text: string) => text || <Text type="secondary">未映射</Text>
    },
    {
      title: '需求数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 90,
      align: 'center',
      sorter: true,
      render: (value: number) => <Text strong>{value}</Text>
    },
    {
      title: '已发货',
      dataIndex: 'shipped_quantity',
      key: 'shipped_quantity',
      width: 80,
      align: 'center',
      render: (value: number) => (
        <Text type={value > 0 ? 'success' : 'secondary'}>{value}</Text>
      )
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
      title: '整箱数',
      dataIndex: 'whole_box_count',
      key: 'whole_box_count',
      width: 80,
      align: 'center',
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
      title: '缺货',
      dataIndex: 'shortage',
      key: 'shortage',
      width: 70,
      align: 'center',
      render: (value: number) => (
        value > 0 ? <Text type="danger">{value}</Text> : '-'
      )
    },
    {
      title: '平台',
      dataIndex: 'marketplace',
      key: 'marketplace',
      width: 80,
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 70,
      align: 'center',
      render: (text: string) => <Tag color="green">{text}</Tag>
    },
    {
      title: '运输方式',
      dataIndex: 'shipping_method',
      key: 'shipping_method',
      width: 100,
      render: (value: string) => value || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      sorter: true,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="link"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确认删除"
              description={
                record.shipped_quantity > 0 
                  ? `该记录已有 ${record.shipped_quantity} 件发货，无法删除` 
                  : "删除后无法恢复，确认删除吗？"
              }
              onConfirm={() => handleDelete(record)}
              disabled={record.shipped_quantity > 0}
              okText="确认"
              cancelText="取消"
            >
              <Button
                type="link"
                icon={<DeleteOutlined />}
                size="small"
                danger
                disabled={record.shipped_quantity > 0}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 计算统计数据
  const stats = data.reduce((acc, item) => {
    acc.totalQuantity += item.quantity;
    acc.totalAvailable += item.total_available;
    acc.totalShortage += item.shortage;
    acc.wholeBoxQuantity += item.whole_box_quantity;
    acc.mixedBoxQuantity += item.mixed_box_quantity;
    return acc;
  }, {
    totalQuantity: 0,
    totalAvailable: 0,
    totalShortage: 0,
    wholeBoxQuantity: 0,
    mixedBoxQuantity: 0
  });

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <InboxOutlined /> 待发货库存管理
      </Title>
      
      {/* 国家库存统计卡片 */}
      <Card 
        title="国家库存统计" 
        size="small" 
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          {countryInventory.map(item => (
            <Col key={item.country} span={4}>
              <div 
                style={{ 
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '4px',
                  backgroundColor: selectedCountry === item.country ? '#e6f7ff' : undefined
                }} 
                onClick={() => {
                  const newCountry = selectedCountry === item.country ? '' : item.country;
                  setSelectedCountry(newCountry);
                }}
              >
                <Statistic
                  title={item.country}
                  value={item.total_quantity}
                  valueStyle={{ 
                    color: selectedCountry === item.country ? '#1677ff' : '#3f8600',
                    fontSize: '16px'
                  }}
                  suffix={
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      整箱: {item.whole_box_quantity} | 混合: {item.mixed_box_quantity}
                    </div>
                  }
                />
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 操作栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Text>状态筛选:</Text>
              <Select
                value={filterStatus}
                onChange={setFilterStatus}
                style={{ width: 150 }}
              >
                <Option value="待发货">待发货</Option>
                <Option value="有库存无需求">有库存无需求</Option>
                <Option value="已取消">已取消</Option>
                <Option value="库存未映射">库存未映射</Option>
              </Select>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => fetchPendingInventory()}
                loading={loading}
              >
                刷新
              </Button>
              <Button
                icon={<ExportOutlined />}
                onClick={handleExport}
              >
                导出Excel
              </Button>
              <Popconfirm
                title="确认批量删除"
                description={`确认删除选中的 ${selectedRowKeys.length} 条记录吗？`}
                onConfirm={handleBatchDelete}
                disabled={selectedRowKeys.length === 0}
                okText="确认"
                cancelText="取消"
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  disabled={selectedRowKeys.length === 0}
                >
                  批量删除 ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            </Space>
          </Col>
          <Col>
            <Text type="secondary">
              当前显示: {data.length} 条记录
              {selectedRowKeys.length > 0 && ` | 已选择: ${selectedRowKeys.length} 条`}
            </Text>
          </Col>
        </Row>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="总需求"
              value={stats.totalQuantity}
              prefix={<BoxPlotOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="总库存"
              value={stats.totalAvailable}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="总缺货"
              value={stats.totalShortage}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="整箱库存"
              value={stats.wholeBoxQuantity}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="混合箱库存"
              value={stats.mixedBoxQuantity}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={data}
        rowKey="record_num"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
        }}
        scroll={{ x: 1800, y: 600 }}
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys,
          onChange: (newSelectedRowKeys, newSelectedRows) => {
            setSelectedRowKeys(newSelectedRowKeys);
            setSelectedRows(newSelectedRows);
          },
          getCheckboxProps: (record) => ({
            disabled: record.shipped_quantity > 0, // 已发货的记录无法选择
          }),
        }}
        rowClassName={(record) => {
          if (record.shipped_quantity > 0) return 'shipped-row';
          if (record.shortage > 0) return 'shortage-row';
          return '';
        }}
      />

      {/* 编辑模态框 */}
      <Modal
        title="编辑库存记录"
        open={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => setEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={editForm}
          layout="vertical"
        >
          <Form.Item
            label="需求数量"
            name="quantity"
            rules={[
              { required: true, message: '请输入需求数量' },
              { type: 'number', min: 0, message: '数量不能小于0' }
            ]}
          >
            <InputNumber 
              min={editingRecord?.shipped_quantity || 0}
              style={{ width: '100%' }}
              placeholder={`最少: ${editingRecord?.shipped_quantity || 0} (已发货数量)`}
            />
          </Form.Item>
          
          <Form.Item
            label="运输方式"
            name="shipping_method"
          >
            <Select placeholder="选择运输方式">
              <Option value="空运">空运</Option>
              <Option value="海运">海运</Option>
              <Option value="快递">快递</Option>
              <Option value="陆运">陆运</Option>
              <Option value="铁运">铁运</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="平台"
            name="marketplace"
          >
            <Select placeholder="选择平台">
              <Option value="Amazon">Amazon</Option>
              <Option value="eBay">eBay</Option>
              <Option value="AliExpress">AliExpress</Option>
              <Option value="Walmart">Walmart</Option>
              <Option value="Shopify">Shopify</Option>
              <Option value="Lazada">Lazada</Option>
              <Option value="Shopee">Shopee</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="状态"
            name="status"
          >
            <Select placeholder="选择状态">
              <Option value="待发货">待发货</Option>
              <Option value="已取消">已取消</Option>
            </Select>
          </Form.Item>
        </Form>
        
        {editingRecord && (
          <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
            <Text type="secondary" style={{ display: 'block' }}>
              <WarningOutlined style={{ color: '#faad14', marginRight: 4 }} />
              当前库存信息:
            </Text>
            <Text style={{ display: 'block', marginTop: 4 }}>
              可用库存: {editingRecord.total_available} | 
              整箱: {editingRecord.whole_box_quantity} | 
              混合箱: {editingRecord.mixed_box_quantity}
            </Text>
            <Text style={{ display: 'block' }}>
              已发货: {editingRecord.shipped_quantity} | 
              缺货: {editingRecord.shortage}
            </Text>
          </div>
        )}
      </Modal>

      <style>{`
        .shipped-row {
          background-color: #f6ffed !important;
        }
        .shipped-row:hover {
          background-color: #d9f7be !important;
        }
        .shortage-row {
          background-color: #fff2f0 !important;
        }
        .shortage-row:hover {
          background-color: #ffece6 !important;
        }
      `}</style>
    </div>
  );
};

export default PendingInventoryPage; 