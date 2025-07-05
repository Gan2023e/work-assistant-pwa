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
  DatePicker,
  Upload,
  Popconfirm,
  Tooltip,
  Badge
} from 'antd';
import { 
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined,
  FileExcelOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import dayjs from 'dayjs';

const { Option } = Select;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// 根据实际数据库表结构定义接口
interface FbaInventoryRecord {
  id?: number;
  sku: string;
  fnsku?: string;
  asin?: string;
  'product-name'?: string;
  condition?: string;
  'your-price'?: number;
  'mfn-listing-exists'?: string;
  'mfn-fulfillable-quantity'?: string;
  'afn-listing-exists'?: string;
  'afn-warehouse-quantity'?: number;
  'afn-fulfillable-quantity'?: number;
  'afn-unsellable-quantity'?: number;
  'afn-reserved-quantity'?: number;
  'afn-total-quantity'?: number;
  'per-unit-volume'?: number;
  'afn-inbound-working-quantity'?: number;
  'afn-inbound-shipped-quantity'?: number;
  'afn-inbound-receiving-quantity'?: number;
  'afn-researching-quantity'?: number;
  'afn-reserved-future-supply'?: number;
  'afn-future-supply-buyable'?: number;
  site: string;
  'afn-fulfillable-quantity-local'?: number;
  'afn-fulfillable-quantity-remote'?: number;
  store?: string;
  created_at?: string;
  updated_at?: string;
}

interface FbaInventoryStats {
  total_skus: number;
  total_afn_fulfillable: number;
  total_afn_reserved: number;
  total_afn_inbound: number;
  by_site: Array<{
    site: string;
    sku_count: number;
    total_afn_fulfillable: number;
    total_afn_reserved: number;
    total_afn_inbound: number;
  }>;
  by_store: Array<{
    store: string;
    sku_count: number;
    total_afn_fulfillable: number;
    total_afn_reserved: number;
    total_afn_inbound: number;
  }>;
}

const FbaInventory: React.FC = () => {
  const [records, setRecords] = useState<FbaInventoryRecord[]>([]);
  const [stats, setStats] = useState<FbaInventoryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FbaInventoryRecord | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [importForm] = Form.useForm();
  const { user } = useAuth();

  // 搜索和筛选状态
  const [searchFilters, setSearchFilters] = useState({
    sku: '',
    site: '',
    store: '',
    condition: ''
  });

  // 分页状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  // 站点列表
  const [sites, setSites] = useState<string[]>([]);
  const [stores, setStores] = useState<string[]>([]);

  // 加载数据
  const fetchData = async (page: number = 1, pageSize: number = 20) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...searchFilters
      });

      const response = await fetch(`${API_BASE_URL}/api/fba-inventory?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        setRecords(result.data.records);
        setPagination({
          current: result.data.current,
          pageSize: result.data.pageSize,
          total: result.data.total
        });
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error('获取FBA库存数据失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载统计数据
  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/fba-inventory/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  // 加载站点和店铺列表
  const fetchSitesAndStores = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/fba-inventory/sites-stores`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        setSites(result.data.sites || []);
        setStores(result.data.stores || []);
      }
    } catch (error) {
      console.error('获取站点和店铺列表失败:', error);
    }
  };

  // 初始化数据
  useEffect(() => {
    fetchData();
    fetchStats();
    fetchSitesAndStores();
  }, []);

  // 表格列定义 - 根据实际数据库字段重新设计
  const columns: ColumnsType<FbaInventoryRecord> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      fixed: 'left',
      sorter: true,
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'FNSKU',
      dataIndex: 'fnsku',
      key: 'fnsku',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: 'ASIN',
      dataIndex: 'asin',
      key: 'asin',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '产品名称',
      dataIndex: 'product-name',
      key: 'product-name',
      width: 200,
      ellipsis: {
        showTitle: false,
      },
      render: (text) => (
        <Tooltip placement="topLeft" title={text}>
          {text || '-'}
        </Tooltip>
      )
    },
    {
      title: '商品状态',
      dataIndex: 'condition',
      key: 'condition',
      width: 100,
      render: (text) => {
        const colorMap: { [key: string]: string } = {
          'New': 'green',
          'Used': 'orange',
          'Refurbished': 'blue'
        };
        return text ? <Tag color={colorMap[text] || 'default'}>{text}</Tag> : '-';
      }
    },
    {
      title: '售价',
      dataIndex: 'your-price',
      key: 'your-price',
      width: 100,
      align: 'right',
      render: (value) => value ? `$${value.toFixed(2)}` : '-'
    },
    {
      title: '站点',
      dataIndex: 'site',
      key: 'site',
      width: 80,
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '店铺',
      dataIndex: 'store',
      key: 'store',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: 'AFN可售数量',
      dataIndex: 'afn-fulfillable-quantity',
      key: 'afn-fulfillable-quantity',
      width: 120,
      align: 'right',
      render: (value) => (
        <Badge 
          count={value || 0} 
          overflowCount={9999}
          style={{ backgroundColor: value > 0 ? '#52c41a' : '#f5222d' }}
        />
      )
    },
    {
      title: 'AFN仓库数量',
      dataIndex: 'afn-warehouse-quantity',
      key: 'afn-warehouse-quantity',
      width: 120,
      align: 'right',
      render: (value) => value || 0
    },
    {
      title: 'AFN预留数量',
      dataIndex: 'afn-reserved-quantity',
      key: 'afn-reserved-quantity',
      width: 120,
      align: 'right',
      render: (value) => value || 0
    },
    {
      title: 'AFN不可售数量',
      dataIndex: 'afn-unsellable-quantity',
      key: 'afn-unsellable-quantity',
      width: 130,
      align: 'right',
      render: (value) => value || 0
    },
    {
      title: 'AFN总数量',
      dataIndex: 'afn-total-quantity',
      key: 'afn-total-quantity',
      width: 100,
      align: 'right',
      render: (value) => <Text strong>{value || 0}</Text>
    },
    {
      title: '入库处理中',
      dataIndex: 'afn-inbound-working-quantity',
      key: 'afn-inbound-working-quantity',
      width: 100,
      align: 'right',
      render: (value) => value || 0
    },
    {
      title: '入库运输中',
      dataIndex: 'afn-inbound-shipped-quantity',
      key: 'afn-inbound-shipped-quantity',
      width: 100,
      align: 'right',
      render: (value) => value || 0
    },
    {
      title: '入库接收中',
      dataIndex: 'afn-inbound-receiving-quantity',
      key: 'afn-inbound-receiving-quantity',
      width: 100,
      align: 'right',
      render: (value) => value || 0
    },
    {
      title: '单位体积',
      dataIndex: 'per-unit-volume',
      key: 'per-unit-volume',
      width: 100,
      align: 'right',
      render: (value) => value ? `${value.toFixed(2)}` : '-'
    },
    {
      title: 'MFN Listing',
      dataIndex: 'mfn-listing-exists',
      key: 'mfn-listing-exists',
      width: 100,
      render: (text) => {
        const color = text === 'Yes' ? 'green' : text === 'No' ? 'red' : 'default';
        return text ? <Tag color={color}>{text}</Tag> : '-';
      }
    },
    {
      title: 'AFN Listing',
      dataIndex: 'afn-listing-exists',
      key: 'afn-listing-exists',
      width: 100,
      render: (text) => {
        const color = text === 'Yes' ? 'green' : text === 'No' ? 'red' : 'default';
        return text ? <Tag color={color}>{text}</Tag> : '-';
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small" 
            icon={<EditOutlined />}
            onClick={() => openModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条记录吗？"
            onConfirm={() => handleDelete(record.id!)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="link" 
              size="small" 
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 处理表格分页
  const handleTableChange = (pag: any) => {
    fetchData(pag.current, pag.pageSize);
  };

  // 处理搜索
  const handleSearch = (changedValues: any) => {
    setSearchFilters(prev => ({ ...prev, ...changedValues }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  // 打开添加/编辑模态框
  const openModal = (record?: FbaInventoryRecord) => {
    setEditingRecord(record || null);
    setModalVisible(true);
    
    if (record) {
      form.setFieldsValue(record);
    } else {
      form.resetFields();
    }
  };

  // 保存记录
  const handleSave = async (values: any) => {
    try {
      const url = editingRecord 
        ? `${API_BASE_URL}/api/fba-inventory/${editingRecord.id}`
        : `${API_BASE_URL}/api/fba-inventory`;
      
      const method = editingRecord ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(values)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        message.success(editingRecord ? '更新成功' : '创建成功');
        setModalVisible(false);
        form.resetFields();
        fetchData(pagination.current, pagination.pageSize);
        fetchStats();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    }
  };

  // 删除记录
  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/fba-inventory/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        message.success('删除成功');
        fetchData(pagination.current, pagination.pageSize);
        fetchStats();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  // 处理Excel导入
  const handleImport = async (values: any) => {
    try {
      const { file } = values;
      
      if (!file || !file.fileList || file.fileList.length === 0) {
        message.error('请选择要导入的Excel文件');
        return;
      }

      const excelFile = file.fileList[0].originFileObj;
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          // 转换数据格式
          const records = jsonData.map((row: any) => ({
            sku: row['SKU'] || row['sku'],
            asin: row['ASIN'] || row['asin'],
            fnsku: row['FNSKU'] || row['fnsku'],
            'product-name': row['Product Name'] || row['product-name'] || row['商品名称'],
            condition: row['Condition'] || row['condition'] || row['商品状态'],
            'your-price': parseFloat(row['Your Price'] || row['your-price'] || 0),
            site: row['Site'] || row['site'] || row['站点'],
            store: row['Store'] || row['store'] || row['店铺'],
            'afn-fulfillable-quantity': parseInt(row['AFN Fulfillable'] || row['afn-fulfillable-quantity'] || 0),
            'afn-warehouse-quantity': parseInt(row['AFN Warehouse'] || row['afn-warehouse-quantity'] || 0),
            'afn-reserved-quantity': parseInt(row['AFN Reserved'] || row['afn-reserved-quantity'] || 0),
            'afn-unsellable-quantity': parseInt(row['AFN Unsellable'] || row['afn-unsellable-quantity'] || 0),
            'afn-total-quantity': parseInt(row['AFN Total'] || row['afn-total-quantity'] || 0),
            'afn-inbound-working-quantity': parseInt(row['AFN Inbound Working'] || row['afn-inbound-working-quantity'] || 0),
            'afn-inbound-shipped-quantity': parseInt(row['AFN Inbound Shipped'] || row['afn-inbound-shipped-quantity'] || 0),
            'afn-inbound-receiving-quantity': parseInt(row['AFN Inbound Receiving'] || row['afn-inbound-receiving-quantity'] || 0),
            'per-unit-volume': parseFloat(row['Per Unit Volume'] || row['per-unit-volume'] || 0),
            'mfn-listing-exists': row['MFN Listing Exists'] || row['mfn-listing-exists'],
            'afn-listing-exists': row['AFN Listing Exists'] || row['afn-listing-exists']
          }));

          // 批量导入
          const response = await fetch(`${API_BASE_URL}/api/fba-inventory/batch-import`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ records })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();
          
          if (result.code === 0) {
            message.success(`导入成功，共处理 ${result.data.imported_count} 条记录`);
            setImportModalVisible(false);
            importForm.resetFields();
            fetchData();
            fetchStats();
          } else {
            message.error(result.message);
          }
        } catch (error) {
          console.error('解析Excel文件失败:', error);
          message.error('解析Excel文件失败');
        }
      };

      reader.readAsArrayBuffer(excelFile);
    } catch (error) {
      console.error('导入失败:', error);
      message.error('导入失败');
    }
  };

  // 导出Excel
  const handleExport = () => {
    try {
      const exportData = records.map(record => ({
        'SKU': record.sku,
        'ASIN': record.asin,
        'FNSKU': record.fnsku,
        '商品名称': record['product-name'],
        '商品状态': record.condition,
        '售价': record['your-price'],
        '站点': record.site,
        '店铺': record.store,
        'AFN可售数量': record['afn-fulfillable-quantity'],
        'AFN仓库数量': record['afn-warehouse-quantity'],
        'AFN预留数量': record['afn-reserved-quantity'],
        'AFN不可售数量': record['afn-unsellable-quantity'],
        'AFN总数量': record['afn-total-quantity'],
        '入库处理中': record['afn-inbound-working-quantity'],
        '入库运输中': record['afn-inbound-shipped-quantity'],
        '入库接收中': record['afn-inbound-receiving-quantity'],
        '单位体积': record['per-unit-volume'],
        'MFN Listing': record['mfn-listing-exists'],
        'AFN Listing': record['afn-listing-exists'],
        '创建时间': record.created_at,
        '更新时间': record.updated_at
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'FBA库存');
      
      const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
      XLSX.writeFile(wb, `FBA库存_${timestamp}.xlsx`);
      
      message.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <BarChartOutlined /> FBA库存管理
      </Title>

      {/* 统计卡片 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总SKU数量"
                value={stats.total_skus}
                prefix={<FileExcelOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="可用库存"
                value={stats.total_afn_fulfillable}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="预留库存"
                value={stats.total_afn_reserved}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="入库中库存"
                value={stats.total_afn_inbound}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 操作按钮 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openModal()}
          >
            添加记录
          </Button>
        </Col>
        <Col>
          <Button
            icon={<UploadOutlined />}
            onClick={() => setImportModalVisible(true)}
          >
            批量导入
          </Button>
        </Col>
        <Col>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
            disabled={records.length === 0}
          >
            导出Excel
          </Button>
        </Col>
        <Col>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              fetchData();
              fetchStats();
            }}
          >
            刷新
          </Button>
        </Col>
      </Row>

      {/* 搜索过滤器 */}
      <Card style={{ marginBottom: 16 }}>
        <Form layout="inline" onValuesChange={handleSearch}>
          <Form.Item name="sku" label="SKU">
            <Input 
              placeholder="输入SKU搜索" 
              allowClear
              style={{ width: 150 }}
            />
          </Form.Item>
          <Form.Item name="site" label="站点">
            <Select 
              placeholder="选择站点" 
              allowClear
              style={{ width: 150 }}
            >
              {sites.map(option => (
                <Option key={option} value={option}>{option}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="store" label="店铺">
            <Select 
              placeholder="选择店铺" 
              allowClear
              style={{ width: 120 }}
            >
              {stores.map(option => (
                <Option key={option} value={option}>{option}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="condition" label="商品状态">
            <Select 
              placeholder="选择商品状态" 
              allowClear
              style={{ width: 150 }}
            >
              <Option value="New">New</Option>
              <Option value="Used">Used</Option>
              <Option value="Refurbished">Refurbished</Option>
            </Select>
          </Form.Item>
        </Form>
      </Card>

      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
        }}
        onChange={handleTableChange}
        scroll={{ x: 1400 }}
        size="small"
      />

      {/* 添加/编辑模态框 */}
      <Modal
        title={editingRecord ? '编辑FBA库存记录' : '添加FBA库存记录'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="sku"
                label="SKU"
                rules={[{ required: true, message: '请输入SKU' }]}
              >
                <Input placeholder="输入SKU" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="asin" label="ASIN">
                <Input placeholder="输入ASIN" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="fnsku" label="FNSKU">
                <Input placeholder="输入FNSKU" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="condition" label="商品状态">
                <Select placeholder="选择商品状态">
                  <Option value="New">New</Option>
                  <Option value="Used">Used</Option>
                  <Option value="Refurbished">Refurbished</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="product-name" label="商品名称">
            <Input placeholder="输入商品名称" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="site"
                label="站点"
                rules={[{ required: true, message: '请选择站点' }]}
              >
                <Select placeholder="选择站点">
                  {sites.map(option => (
                    <Option key={option} value={option}>{option}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="store" label="店铺">
                <Select placeholder="选择店铺" allowClear>
                  {stores.map(option => (
                    <Option key={option} value={option}>{option}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="your-price" label="售价">
                <InputNumber min={0} step={0.01} placeholder="售价" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="per-unit-volume" label="单位体积">
                <InputNumber min={0} step={0.01} placeholder="单位体积" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="afn-fulfillable-quantity" label="AFN可售数量">
                <InputNumber min={0} placeholder="AFN可售数量" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="afn-warehouse-quantity" label="AFN仓库数量">
                <InputNumber min={0} placeholder="AFN仓库数量" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="afn-reserved-quantity" label="AFN预留数量">
                <InputNumber min={0} placeholder="AFN预留数量" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="afn-inbound-working-quantity" label="入库处理中">
                <InputNumber min={0} placeholder="入库处理中" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="afn-inbound-shipped-quantity" label="入库运输中">
                <InputNumber min={0} placeholder="入库运输中" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="afn-inbound-receiving-quantity" label="入库接收中">
                <InputNumber min={0} placeholder="入库接收中" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="mfn-listing-exists" label="MFN Listing">
                <Select placeholder="选择MFN Listing状态">
                  <Option value="Yes">Yes</Option>
                  <Option value="No">No</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="afn-listing-exists" label="AFN Listing">
                <Select placeholder="选择AFN Listing状态">
                  <Option value="Yes">Yes</Option>
                  <Option value="No">No</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量导入模态框 */}
      <Modal
        title="批量导入FBA库存"
        open={importModalVisible}
        onCancel={() => {
          setImportModalVisible(false);
          importForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form
          form={importForm}
          layout="vertical"
          onFinish={handleImport}
        >
          <Form.Item
            name="file"
            label="Excel文件"
            rules={[{ required: true, message: '请选择Excel文件' }]}
          >
            <Upload
              accept=".xlsx,.xls"
              beforeUpload={() => false}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择Excel文件</Button>
            </Upload>
          </Form.Item>

          <Form.Item>
            <Text type="secondary">
              Excel文件应包含以下列：SKU, ASIN, FNSKU, Product Name, Condition, Your Price, 
              Site, Store, AFN Fulfillable, AFN Warehouse, AFN Reserved, AFN Unsellable, AFN Total, 
              AFN Inbound Working, AFN Inbound Shipped, AFN Inbound Receiving, Per Unit Volume, 
              MFN Listing Exists, AFN Listing Exists
            </Text>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                导入
              </Button>
              <Button onClick={() => setImportModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FbaInventory; 