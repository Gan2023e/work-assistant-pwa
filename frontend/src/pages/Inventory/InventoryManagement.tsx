import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Input, Select, Modal, Form, message, Tag, Space, Popconfirm, DatePicker, Tooltip, Row, Col, Statistic, Typography } from 'antd';
import { SearchOutlined, EditOutlined, DeleteOutlined, PrinterOutlined, ReloadOutlined, PlusOutlined, HistoryOutlined, GlobalOutlined } from '@ant-design/icons';
import { printManager, LabelData } from '../../utils/printManager';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { API_BASE_URL } from '../../config/api';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text } = Typography;

interface InventoryRecord {
  记录号: string;
  sku: string;
  total_quantity: number;
  total_boxes: number;
  country: string;
  操作员: string;
  打包员: string;
  mix_box_num?: string;
  marketPlace: string;
  status: '待出库' | '已出库' | '已取消';
  box_type: '整箱' | '混合箱';
  time: string;
  last_updated_at: string;
  shipped_at?: string;
  shipment_id?: number;
  remark?: string;
}

interface InventorySummary {
  sku: string;
  country: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  mixed_box_count: number;
  earliest_inbound: string;
  latest_update: string;
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

const InventoryManagement: React.FC = () => {
  const [summaryData, setSummaryData] = useState<InventorySummary[]>([]);
  const [recordsData, setRecordsData] = useState<InventoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [currentView, setCurrentView] = useState<'summary' | 'records'>('summary');
  
  // 国家库存汇总相关状态
  const [countryInventory, setCountryInventory] = useState<CountryInventory[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  
  // 筛选条件
  const [filters, setFilters] = useState({
    sku: '',
    country: '',
    box_type: '',
    status: '',
    dateRange: null as [dayjs.Dayjs, dayjs.Dayjs] | null
  });

  // 分页
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  // 编辑模态框
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<InventoryRecord | null>(null);
  const [editForm] = Form.useForm();

  // 打印状态
  const [printServiceAvailable, setPrintServiceAvailable] = useState(false);

  useEffect(() => {
    loadSummaryData();
    checkPrintService();
  }, []);

  useEffect(() => {
    if (currentView === 'summary') {
      loadSummaryData();
    } else {
      loadRecordsData();
    }
    fetchCountryInventory();
  }, [currentView, filters, pagination.current, pagination.pageSize]);

  // 检查打印服务
  const checkPrintService = async () => {
    try {
      const available = await printManager.checkPrintService();
      setPrintServiceAvailable(available);
    } catch (error) {
      setPrintServiceAvailable(false);
    }
  };

  // 加载库存汇总数据
  const loadSummaryData = async () => {
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.sku) params.append('sku', filters.sku);
      if (filters.country) params.append('country', filters.country);
      if (filters.box_type) params.append('box_type', filters.box_type);
      
      const response = await fetch(`/api/inventory/pending?${params.toString()}`);
      const data = await response.json();
      
      if (data.code === 0) {
        setSummaryData(data.data.inventory);
        setPagination(prev => ({
          ...prev,
          total: data.data.total
        }));
      } else {
        message.error(data.message);
      }
    } catch (error) {
      message.error('加载库存汇总失败');
      console.error(error);
    } finally {
      setSummaryLoading(false);
    }
  };

  // 获取国家库存汇总数据
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

  // 加载库存记录数据
  const loadRecordsData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.sku) params.append('sku', filters.sku);
      if (filters.country) params.append('country', filters.country);
      if (filters.box_type) params.append('box_type', filters.box_type);
      if (filters.status) params.append('status', filters.status);
      params.append('page', pagination.current.toString());
      params.append('limit', pagination.pageSize.toString());
      
      const response = await fetch(`/api/inventory/records?${params.toString()}`);
      const data = await response.json();
      
      if (data.code === 0) {
        setRecordsData(data.data.records);
        setPagination(prev => ({
          ...prev,
          total: data.data.total
        }));
      } else {
        message.error(data.message);
      }
    } catch (error) {
      message.error('加载库存记录失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 编辑记录
  const handleEdit = (record: InventoryRecord) => {
    setEditingRecord(record);
    editForm.setFieldsValue({
      sku: record.sku,
      total_quantity: record.total_quantity,
      total_boxes: record.total_boxes,
      country: record.country,
      打包员: record.打包员,
      marketPlace: record.marketPlace
    });
    setEditModalVisible(true);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields();
      const response = await fetch(`/api/inventory/edit/${editingRecord?.记录号}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateData: values,
          changeNote: '手动编辑'
        })
      });

      const data = await response.json();
      if (data.code === 0) {
        message.success('编辑成功');
        setEditModalVisible(false);
        if (currentView === 'summary') {
          loadSummaryData();
        } else {
          loadRecordsData();
        }
      } else {
        message.error(data.message);
      }
    } catch (error) {
      message.error('编辑失败');
      console.error(error);
    }
  };

  // 删除记录
  const handleDelete = async (recordId: string) => {
    try {
      const response = await fetch(`/api/inventory/delete/${recordId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: '用户删除' })
      });

      const data = await response.json();
      if (data.code === 0) {
        message.success('删除成功');
        if (currentView === 'summary') {
          loadSummaryData();
        } else {
          loadRecordsData();
        }
      } else {
        message.error(data.message);
      }
    } catch (error) {
      message.error('删除失败');
      console.error(error);
    }
  };

  // 打印标签
  const handlePrint = async (record: InventoryRecord) => {
    try {
      const labelData: LabelData = {
        recordId: record.记录号,
        sku: record.sku,
        quantity: record.total_quantity,
        boxes: record.total_boxes,
        country: record.country,
        operator: record.操作员,
        packer: record.打包员,
        boxType: record.box_type,
        mixBoxNum: record.mix_box_num,
        createTime: record.time,
        barcode: record.记录号
      };

      await printManager.printLabel(labelData);
      message.success('打印任务已发送');
    } catch (error) {
      message.error('打印失败');
      console.error(error);
    }
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusConfig = {
      '待出库': { color: 'blue', text: '待出库' },
      '已出库': { color: 'green', text: '已出库' },
      '已取消': { color: 'red', text: '已取消' }
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 库存汇总表格列
  const summaryColumns: ColumnsType<InventorySummary> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      fixed: 'left',
      width: 150
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 80
    },
    {
      title: '整箱库存',
      key: 'whole_box',
      width: 120,
      render: (_, record) => (
        <div>
          <div>{record.whole_box_quantity} 件</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.whole_box_count} 箱
          </div>
        </div>
      )
    },
    {
      title: '混合箱库存',
      key: 'mixed_box',
      width: 120,
      render: (_, record) => (
        <div>
          <div>{record.mixed_box_quantity} 件</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.mixed_box_count} 个混合箱
          </div>
        </div>
      )
    },
    {
      title: '总库存',
      key: 'total',
      width: 100,
      render: (_, record) => (
        <strong>{record.whole_box_quantity + record.mixed_box_quantity} 件</strong>
      )
    },
    {
      title: '最早入库',
      dataIndex: 'earliest_inbound',
      key: 'earliest_inbound',
      width: 120,
      render: (date) => dayjs(date).format('MM-DD HH:mm')
    },
    {
      title: '最后更新',
      dataIndex: 'latest_update',
      key: 'latest_update',
      width: 120,
      render: (date) => dayjs(date).format('MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="link"
              icon={<HistoryOutlined />}
              onClick={() => {
                setFilters(prev => ({ ...prev, sku: record.sku, country: record.country }));
                setCurrentView('records');
              }}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  // 库存记录表格列
  const recordsColumns: ColumnsType<InventoryRecord> = [
    {
      title: '记录号',
      dataIndex: '记录号',
      key: '记录号',
      fixed: 'left',
      width: 140
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120
    },
    {
      title: '数量',
      key: 'quantity',
      width: 100,
      render: (_, record) => `${record.total_quantity}件/${record.total_boxes}箱`
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 80
    },
    {
      title: '箱型',
      dataIndex: 'box_type',
      key: 'box_type',
      width: 80,
      render: (type, record) => (
        <div>
          <Tag color={type === '整箱' ? 'blue' : 'orange'}>{type}</Tag>
          {record.mix_box_num && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              {record.mix_box_num}
            </div>
          )}
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => getStatusTag(status)
    },
    {
      title: '操作员',
      dataIndex: '操作员',
      key: '操作员',
      width: 100
    },
    {
      title: '打包员',
      dataIndex: '打包员',
      key: '打包员',
      width: 100
    },
    {
      title: '入库时间',
      dataIndex: 'time',
      key: 'time',
      width: 120,
      render: (date) => dayjs(date).format('MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Space>
          {record.status === '待出库' && (
            <>
              <Tooltip title="编辑">
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(record)}
                />
              </Tooltip>
              <Popconfirm
                title="确定要删除这条记录吗？"
                onConfirm={() => handleDelete(record.记录号)}
                okText="确定"
                cancelText="取消"
              >
                <Tooltip title="删除">
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
          <Tooltip title="打印标签">
            <Button
              type="link"
              icon={<PrinterOutlined />}
              onClick={() => handlePrint(record)}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 国家库存统计卡片 */}
      <Card 
        title={
          <span>
            <GlobalOutlined style={{ marginRight: 8 }} />
            按国家库存汇总
            <Text type="secondary" style={{ fontSize: '12px', marginLeft: 8 }}>
              (不含已发货记录，点击卡片筛选对应国家数据)
            </Text>
          </span>
        } 
        size="small" 
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[16, 16]}>
          {countryInventory.map(item => (
            <Col key={item.country}>
              <div 
                style={{ 
                  cursor: 'pointer',
                  padding: '8px 16px',
                  border: `2px solid ${selectedCountry === item.country ? '#1677ff' : '#d9d9d9'}`,
                  borderRadius: '6px',
                  backgroundColor: selectedCountry === item.country ? '#f0f6ff' : '#fff',
                  transition: 'all 0.3s',
                  minWidth: '120px'
                }} 
                onClick={() => {
                  const newCountry = selectedCountry === item.country ? '' : item.country;
                  setSelectedCountry(newCountry);
                  setFilters(prev => ({ ...prev, country: newCountry }));
                }}
              >
                <Statistic
                  title={
                    <div>
                      <Text strong>{item.country}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: '10px' }}>
                        整箱: {item.whole_box_count}箱 | 混合箱: {item.mixed_box_count}箱
                      </Text>
                    </div>
                  }
                  value={item.total_quantity}
                  valueStyle={{ 
                    color: selectedCountry === item.country ? '#1677ff' : '#666',
                    fontSize: '18px'
                  }}
                  suffix="件"
                />
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title="本地库存管理" style={{ marginBottom: '16px' }}>
        {/* 筛选区域 */}
        <div style={{ marginBottom: '16px' }}>
          <Space wrap>
            <Input
              placeholder="搜索SKU"
              prefix={<SearchOutlined />}
              value={filters.sku}
              onChange={(e) => setFilters(prev => ({ ...prev, sku: e.target.value }))}
              style={{ width: 200 }}
            />
            <Select
              placeholder="选择国家"
              value={filters.country}
              onChange={(value) => setFilters(prev => ({ ...prev, country: value }))}
              style={{ width: 120 }}
              allowClear
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
            <Select
              placeholder="箱型"
              value={filters.box_type}
              onChange={(value) => setFilters(prev => ({ ...prev, box_type: value }))}
              style={{ width: 120 }}
              allowClear
            >
              <Option value="整箱">整箱</Option>
              <Option value="混合箱">混合箱</Option>
            </Select>
            {currentView === 'records' && (
              <Select
                placeholder="状态"
                value={filters.status}
                onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                style={{ width: 120 }}
                allowClear
              >
                <Option value="待出库">待出库</Option>
                <Option value="已出库">已出库</Option>
                <Option value="已取消">已取消</Option>
              </Select>
            )}
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => {
                if (currentView === 'summary') {
                  loadSummaryData();
                } else {
                  loadRecordsData();
                }
                fetchCountryInventory();
              }}
            >
              搜索
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setFilters({ sku: '', country: '', box_type: '', status: '', dateRange: null });
                setPagination(prev => ({ ...prev, current: 1 }));
              }}
            >
              重置
            </Button>
          </Space>
        </div>

        {/* 视图切换和操作按钮 */}
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Button.Group>
              <Button
                type={currentView === 'summary' ? 'primary' : 'default'}
                onClick={() => setCurrentView('summary')}
              >
                库存汇总
              </Button>
              <Button
                type={currentView === 'records' ? 'primary' : 'default'}
                onClick={() => setCurrentView('records')}
              >
                库存记录
              </Button>
            </Button.Group>
          </Space>
          <Space>
            <Tag color={printServiceAvailable ? 'green' : 'red'}>
              打印服务: {printServiceAvailable ? '可用' : '不可用'}
            </Tag>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                // 跳转到入库页面
                window.location.href = '/inventory/create';
              }}
            >
              新增库存
            </Button>
          </Space>
        </div>

        {/* 表格 */}
        {currentView === 'summary' ? (
          <Table
            columns={summaryColumns}
            dataSource={summaryData}
            loading={summaryLoading}
            rowKey={(record) => `${record.sku}_${record.country}`}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
            }}
            scroll={{ x: 1000 }}
          />
        ) : (
          <Table
            columns={recordsColumns}
            dataSource={recordsData}
            loading={loading}
            rowKey="记录号"
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
              onChange: (page, pageSize) => {
                setPagination(prev => ({ ...prev, current: page, pageSize: pageSize || 20 }));
              }
            }}
            scroll={{ x: 1200 }}
          />
        )}
      </Card>

      {/* 编辑模态框 */}
      <Modal
        title="编辑库存记录"
        visible={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => setEditModalVisible(false)}
        width={600}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            label="SKU"
            name="sku"
            rules={[{ required: true, message: '请输入SKU' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="数量"
            name="total_quantity"
            rules={[{ required: true, message: '请输入数量' }]}
          >
            <Input type="number" min={1} />
          </Form.Item>
          <Form.Item
            label="箱数"
            name="total_boxes"
            rules={[{ required: true, message: '请输入箱数' }]}
          >
            <Input type="number" min={1} />
          </Form.Item>
          <Form.Item
            label="国家"
            name="country"
            rules={[{ required: true, message: '请选择国家' }]}
          >
            <Select>
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
            label="打包员"
            name="打包员"
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="市场"
            name="marketPlace"
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InventoryManagement; 