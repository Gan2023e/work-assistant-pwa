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

interface FbaInventoryRecord {
  id: number;
  sku: string;
  asin?: string;
  fnsku?: string;
  product_name?: string;
  marketplace: string;
  country: string;
  fulfillment_center?: string;
  available_quantity: number;
  inbound_working_quantity: number;
  inbound_shipped_quantity: number;
  inbound_receiving_quantity: number;
  reserved_quantity: number;
  unfulfillable_quantity: number;
  total_quantity: number;
  last_updated?: string;
  snapshot_date: string;
  created_at: string;
  updated_at: string;
}

interface FbaInventoryStats {
  snapshot_date: string;
  total_skus: number;
  total_available: number;
  total_reserved: number;
  total_inbound: number;
  by_marketplace: Array<{
    marketplace: string;
    sku_count: number;
    total_available: number;
    total_reserved: number;
    total_inbound: number;
  }>;
  by_country: Array<{
    country: string;
    sku_count: number;
    total_available: number;
    total_reserved: number;
    total_inbound: number;
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
    marketplace: '',
    country: '',
    snapshot_date: ''
  });

  // 分页状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  // 快照日期列表
  const [snapshotDates, setSnapshotDates] = useState<string[]>([]);

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

  // 加载快照日期列表
  const fetchSnapshotDates = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/fba-inventory/snapshot-dates`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        setSnapshotDates(result.data);
      }
    } catch (error) {
      console.error('获取快照日期失败:', error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchStats();
    fetchSnapshotDates();
  }, [searchFilters]);

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
      form.setFieldsValue({
        ...record,
        snapshot_date: dayjs(record.snapshot_date)
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        snapshot_date: dayjs()
      });
    }
  };

  // 保存记录
  const handleSave = async (values: any) => {
    try {
      const formData = {
        ...values,
        snapshot_date: values.snapshot_date.format('YYYY-MM-DD')
      };

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
        body: JSON.stringify(formData)
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
        fetchSnapshotDates();
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
      const { file, snapshot_date } = values;
      
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
            product_name: row['Product Name'] || row['product_name'] || row['商品名称'],
            marketplace: row['Marketplace'] || row['marketplace'] || row['市场站点'],
            country: row['Country'] || row['country'] || row['国家'],
            fulfillment_center: row['Fulfillment Center'] || row['fulfillment_center'] || row['履约中心'],
            available_quantity: parseInt(row['Available'] || row['available_quantity'] || 0),
            inbound_working_quantity: parseInt(row['Inbound Working'] || row['inbound_working_quantity'] || 0),
            inbound_shipped_quantity: parseInt(row['Inbound Shipped'] || row['inbound_shipped_quantity'] || 0),
            inbound_receiving_quantity: parseInt(row['Inbound Receiving'] || row['inbound_receiving_quantity'] || 0),
            reserved_quantity: parseInt(row['Reserved'] || row['reserved_quantity'] || 0),
            unfulfillable_quantity: parseInt(row['Unfulfillable'] || row['unfulfillable_quantity'] || 0),
            total_quantity: parseInt(row['Total'] || row['total_quantity'] || 0)
          }));

          // 批量导入
          const response = await fetch(`${API_BASE_URL}/api/fba-inventory/batch-import`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              records,
              snapshot_date: snapshot_date.format('YYYY-MM-DD')
            })
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
            fetchSnapshotDates();
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
        '商品名称': record.product_name,
        '市场站点': record.marketplace,
        '国家': record.country,
        '履约中心': record.fulfillment_center,
        '可用数量': record.available_quantity,
        '入库处理中': record.inbound_working_quantity,
        '入库运输中': record.inbound_shipped_quantity,
        '入库接收中': record.inbound_receiving_quantity,
        '预留数量': record.reserved_quantity,
        '不可售数量': record.unfulfillable_quantity,
        '总数量': record.total_quantity,
        '快照日期': record.snapshot_date,
        '最后更新': record.last_updated
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

  // 表格列定义
  const columns: ColumnsType<FbaInventoryRecord> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      fixed: 'left'
    },
    {
      title: 'ASIN',
      dataIndex: 'asin',
      key: 'asin',
      width: 100
    },
    {
      title: '商品名称',
      dataIndex: 'product_name',
      key: 'product_name',
      width: 200,
      ellipsis: true
    },
    {
      title: '市场站点',
      dataIndex: 'marketplace',
      key: 'marketplace',
      width: 100
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 80
    },
    {
      title: '履约中心',
      dataIndex: 'fulfillment_center',
      key: 'fulfillment_center',
      width: 100
    },
    {
      title: '可用数量',
      dataIndex: 'available_quantity',
      key: 'available_quantity',
      width: 100,
      render: (value: number) => (
        <Badge count={value} showZero style={{ backgroundColor: '#52c41a' }} />
      )
    },
    {
      title: '入库中',
      key: 'inbound',
      width: 100,
      render: (record: FbaInventoryRecord) => {
        const total = record.inbound_working_quantity + record.inbound_shipped_quantity + record.inbound_receiving_quantity;
        return total > 0 ? (
          <Tooltip title={`处理中: ${record.inbound_working_quantity}, 运输中: ${record.inbound_shipped_quantity}, 接收中: ${record.inbound_receiving_quantity}`}>
            <Badge count={total} showZero style={{ backgroundColor: '#1890ff' }} />
          </Tooltip>
        ) : (
          <Badge count={0} showZero style={{ backgroundColor: '#d9d9d9' }} />
        );
      }
    },
    {
      title: '预留数量',
      dataIndex: 'reserved_quantity',
      key: 'reserved_quantity',
      width: 100,
      render: (value: number) => (
        <Badge count={value} showZero style={{ backgroundColor: '#faad14' }} />
      )
    },
    {
      title: '不可售',
      dataIndex: 'unfulfillable_quantity',
      key: 'unfulfillable_quantity',
      width: 100,
      render: (value: number) => (
        <Badge count={value} showZero style={{ backgroundColor: '#ff4d4f' }} />
      )
    },
    {
      title: '总数量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      width: 100,
      render: (value: number) => (
        <Badge count={value} showZero style={{ backgroundColor: '#722ed1' }} />
      )
    },
    {
      title: '快照日期',
      dataIndex: 'snapshot_date',
      key: 'snapshot_date',
      width: 100
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button 
              type="link" 
              icon={<EditOutlined />} 
              onClick={() => openModal(record)}
              size="small"
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这条记录吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button 
                type="link" 
                danger 
                icon={<DeleteOutlined />}
                size="small"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 市场站点选项
  const marketplaceOptions = ['Amazon US', 'Amazon UK', 'Amazon DE', 'Amazon FR', 'Amazon IT', 'Amazon ES', 'Amazon CA', 'Amazon AU', 'Amazon JP'];
  
  // 国家选项
  const countryOptions = ['US', 'UK', 'DE', 'FR', 'IT', 'ES', 'CA', 'AU', 'JP'];

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
                value={stats.total_available}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="预留库存"
                value={stats.total_reserved}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="入库中库存"
                value={stats.total_inbound}
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
          <Form.Item name="marketplace" label="市场站点">
            <Select 
              placeholder="选择市场站点" 
              allowClear
              style={{ width: 150 }}
            >
              {marketplaceOptions.map(option => (
                <Option key={option} value={option}>{option}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="country" label="国家">
            <Select 
              placeholder="选择国家" 
              allowClear
              style={{ width: 120 }}
            >
              {countryOptions.map(option => (
                <Option key={option} value={option}>{option}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="snapshot_date" label="快照日期">
            <Select 
              placeholder="选择快照日期" 
              allowClear
              style={{ width: 150 }}
            >
              {snapshotDates.map(date => (
                <Option key={date} value={date}>{date}</Option>
              ))}
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
              <Form.Item name="fulfillment_center" label="履约中心">
                <Input placeholder="输入履约中心" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="product_name" label="商品名称">
            <Input placeholder="输入商品名称" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="marketplace"
                label="市场站点"
                rules={[{ required: true, message: '请选择市场站点' }]}
              >
                <Select placeholder="选择市场站点">
                  {marketplaceOptions.map(option => (
                    <Option key={option} value={option}>{option}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="country"
                label="国家"
                rules={[{ required: true, message: '请选择国家' }]}
              >
                <Select placeholder="选择国家">
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
                name="available_quantity"
                label="可用数量"
                rules={[{ required: true, message: '请输入可用数量' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="reserved_quantity" label="预留数量">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="inbound_working_quantity" label="入库处理中">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="inbound_shipped_quantity" label="入库运输中">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="inbound_receiving_quantity" label="入库接收中">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="unfulfillable_quantity" label="不可售数量">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="snapshot_date"
                label="快照日期"
                rules={[{ required: true, message: '请选择快照日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
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
            name="snapshot_date"
            label="快照日期"
            rules={[{ required: true, message: '请选择快照日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

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
              Excel文件应包含以下列：SKU, ASIN, FNSKU, Product Name, Marketplace, Country, 
              Fulfillment Center, Available, Inbound Working, Inbound Shipped, Inbound Receiving, 
              Reserved, Unfulfillable, Total
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