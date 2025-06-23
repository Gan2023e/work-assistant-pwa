import React, { useState, useEffect } from 'react';
import {
  Table,
  Input,
  Button,
  Space,
  Card,
  Form,
  Modal,
  message,
  Popconfirm,
  Row,
  Col,
  Tag,
  Tooltip,
  Typography,
  Select,
  Divider,
  Badge,
  Empty,
  Descriptions
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExportOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  UserOutlined,
  PhoneOutlined,
  InfoCircleOutlined,
  FilterOutlined,
  ClearOutlined,
  HomeOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { API_BASE_URL } from '../../config/api';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// 亚马逊仓库接口定义
interface AmzWarehouse {
  warehouse_code: string;
  recipient_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state_province?: string;
  postal_code: string;
  country: string;
  phone?: string;
  status: 'active' | 'inactive';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

const WarehouseManagement: React.FC = () => {
  const [data, setData] = useState<AmzWarehouse[]>([]);
  const [filteredData, setFilteredData] = useState<AmzWarehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AmzWarehouse | null>(null);
  const [viewingRecord, setViewingRecord] = useState<AmzWarehouse | null>(null);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();

  // 获取仓库列表
  const fetchWarehouses = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/warehouse`);
      const result = await response.json();
      
      if (result.code === 0) {
        setData(result.data);
        setFilteredData(result.data);
        message.success(`✅ 加载了 ${result.data.length} 个仓库地址`);
      } else {
        throw new Error(result.message || '获取数据失败');
      }
    } catch (error) {
      console.error('❌ 获取仓库列表失败:', error);
      message.error(`获取数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setData([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  };

  // 保存仓库
  const handleSaveWarehouse = async (values: AmzWarehouse) => {
    try {
      const isEditing = !!editingRecord;
      const url = isEditing 
        ? `${API_BASE_URL}/api/warehouse/${encodeURIComponent(editingRecord!.warehouse_code)}`
        : `${API_BASE_URL}/api/warehouse`;
      const method = isEditing ? 'PUT' : 'POST';

      console.log(`🔄 ${isEditing ? '更新' : '创建'}仓库:`, values);

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });

      const result = await response.json();
      
      if (result.code === 0) {
        message.success(`✅ ${isEditing ? '更新' : '创建'}成功`);
        setEditModalVisible(false);
        setEditingRecord(null);
        form.resetFields();
        await fetchWarehouses();
      } else {
        throw new Error(result.message || '操作失败');
      }
    } catch (error) {
      console.error('❌ 保存仓库失败:', error);
      message.error(`操作失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 删除仓库
  const handleDeleteWarehouse = async (warehouseCode: string) => {
    try {
      console.log('🗑️ 删除仓库:', warehouseCode);
      const response = await fetch(`${API_BASE_URL}/api/warehouse/${encodeURIComponent(warehouseCode)}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (result.code === 0) {
        message.success('✅ 删除成功');
        await fetchWarehouses();
      } else {
        throw new Error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('❌ 删除仓库失败:', error);
      message.error(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的仓库');
      return;
    }

    Modal.confirm({
      title: '批量删除确认',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个仓库吗？此操作不可恢复。`,
      okText: '确定删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const promises = selectedRowKeys.map(key => 
            fetch(`${API_BASE_URL}/api/warehouse/${encodeURIComponent(key as string)}`, {
              method: 'DELETE'
            })
          );
          
          await Promise.all(promises);
          message.success(`✅ 成功删除 ${selectedRowKeys.length} 个仓库`);
          setSelectedRowKeys([]);
          await fetchWarehouses();
        } catch (error) {
          message.error('❌ 批量删除失败');
        }
      }
    });
  };

  // 搜索处理
  const handleSearch = (params: any) => {
    let filtered = [...data];
    
    if (params.search) {
      const searchLower = params.search.toLowerCase();
      filtered = filtered.filter(item =>
        item.warehouse_code.toLowerCase().includes(searchLower) ||
        item.recipient_name.toLowerCase().includes(searchLower) ||
        item.address_line1.toLowerCase().includes(searchLower) ||
        item.city.toLowerCase().includes(searchLower) ||
        item.country.toLowerCase().includes(searchLower) ||
        (item.postal_code && item.postal_code.toLowerCase().includes(searchLower))
      );
    }
    
    if (params.status) {
      filtered = filtered.filter(item => item.status === params.status);
    }
    
    if (params.country) {
      filtered = filtered.filter(item => item.country === params.country);
    }
    
    setFilteredData(filtered);
  };

  // 重置搜索
  const handleResetSearch = () => {
    setFilteredData(data);
    searchForm.resetFields();
  };

  // 导出数据
  const handleExport = () => {
    const csvContent = [
      ['仓库代码', '收件人', '地址一', '地址二', '城市', '州/省', '邮编', '国家', '电话', '状态', '备注', '创建时间'].join(','),
      ...filteredData.map(item => [
        item.warehouse_code,
        item.recipient_name,
        item.address_line1,
        item.address_line2 || '',
        item.city,
        item.state_province || '',
        item.postal_code,
        item.country,
        item.phone || '',
        item.status === 'active' ? '启用' : '禁用',
        item.notes || '',
        item.created_at ? dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss') : ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `warehouses_${dayjs().format('YYYY-MM-DD')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    message.success('📊 数据导出成功');
  };

  // 获取唯一国家列表
  const getUniqueCountries = () => {
    const countries = Array.from(new Set(data.map(item => item.country)));
    return countries.filter(Boolean).sort();
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
  };

  // 表格列配置
  const columns: ColumnsType<AmzWarehouse> = [
    {
      title: '仓库代码',
      dataIndex: 'warehouse_code',
      key: 'warehouse_code',
      width: 120,
      fixed: 'left',
      render: (text: string) => (
        <Tag color="blue" style={{ fontWeight: 'bold', fontSize: '12px' }}>
          {text}
        </Tag>
      ),
    },
    {
      title: '收件人',
      dataIndex: 'recipient_name',
      key: 'recipient_name',
      width: 120,
      render: (name: string) => (
        <Text strong>{name}</Text>
      ),
    },
    {
      title: '地址',
      key: 'address',
      width: 300,
      render: (_, record) => (
        <div>
          <Text>{record.address_line1}</Text>
          {record.address_line2 && (
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.address_line2}
              </Text>
            </div>
          )}
          <div style={{ marginTop: 4 }}>
            <Space size="small">
              <Tag>{record.city}</Tag>
              {record.state_province && <Tag>{record.state_province}</Tag>}
              <Tag>{record.postal_code}</Tag>
            </Space>
          </div>
        </div>
      ),
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 100,
      align: 'center',
      render: (country: string) => (
        <Tag color="green">{country}</Tag>
      ),
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
      align: 'center',
      render: (phone: string) => (
        phone ? (
          <a href={`tel:${phone}`} style={{ color: '#1890ff' }}>
            {phone}
          </a>
        ) : '-'
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      align: 'center',
      render: (status: string) => (
        <Tag 
          color={status === 'active' ? 'success' : 'error'}
          icon={status === 'active' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
        >
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 100,
      align: 'center',
      render: (date: string) => (
        date ? dayjs(date).format('YYYY-MM-DD') : '-'
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<InfoCircleOutlined />}
              onClick={() => {
                setViewingRecord(record);
                setViewModalVisible(true);
              }}
              size="small"
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingRecord(record);
                form.setFieldsValue(record);
                setEditModalVisible(true);
              }}
              size="small"
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description={`确定要删除仓库 "${record.warehouse_code}" 吗？`}
            onConfirm={() => handleDeleteWarehouse(record.warehouse_code)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="text"
                icon={<DeleteOutlined />}
                danger
                size="small"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={4} style={{ margin: 0 }}>
                <HomeOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                亚马逊仓库管理
              </Title>
              <Text type="secondary">
                管理亚马逊仓库地址信息，包括收件人、地址和联系方式
              </Text>
            </Col>
            <Col>
              <Space>
                <Badge count={filteredData.filter(w => w.status === 'active').length} showZero>
                  <Button icon={<CheckCircleOutlined />} type="text" style={{ color: '#52c41a' }}>
                    启用仓库
                  </Button>
                </Badge>
                <Badge count={filteredData.length} showZero>
                  <Button icon={<InfoCircleOutlined />} type="text">
                    总仓库数
                  </Button>
                </Badge>
              </Space>
            </Col>
          </Row>
        </div>

        {/* 搜索区域 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Form
            form={searchForm}
            layout="inline"
            onFinish={handleSearch}
            style={{ width: '100%' }}
          >
            <Form.Item name="search" style={{ minWidth: 250 }}>
              <Input
                prefix={<SearchOutlined />}
                placeholder="搜索仓库代码、收件人、地址..."
                allowClear
              />
            </Form.Item>
            
            {showAdvancedSearch && (
              <>
                <Form.Item name="status">
                  <Select placeholder="筛选状态" style={{ width: 120 }} allowClear>
                    <Option value="active">启用</Option>
                    <Option value="inactive">禁用</Option>
                  </Select>
                </Form.Item>
                <Form.Item name="country">
                  <Select placeholder="筛选国家" style={{ width: 120 }} allowClear>
                    {getUniqueCountries().map(country => (
                      <Option key={country} value={country}>{country}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </>
            )}
            
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                  搜索
                </Button>
                <Button onClick={handleResetSearch} icon={<ClearOutlined />}>
                  重置
                </Button>
                <Button
                  type="text"
                  icon={<FilterOutlined />}
                  onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                >
                  {showAdvancedSearch ? '收起' : '高级'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>

        {/* 操作工具栏 */}
        <div style={{ marginBottom: 16 }}>
          <Row justify="space-between">
            <Col>
              <Space>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  onClick={() => {
                    setEditingRecord(null);
                    form.resetFields();
                    form.setFieldsValue({ status: 'active' });
                    setEditModalVisible(true);
                  }}
                >
                  新增仓库
                </Button>
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={fetchWarehouses}
                  loading={loading}
                >
                  刷新
                </Button>
                {selectedRowKeys.length > 0 && (
                  <Button 
                    danger 
                    icon={<DeleteOutlined />} 
                    onClick={handleBatchDelete}
                  >
                    批量删除 ({selectedRowKeys.length})
                  </Button>
                )}
              </Space>
            </Col>
            <Col>
              <Button 
                icon={<ExportOutlined />} 
                onClick={handleExport}
                disabled={filteredData.length === 0}
              >
                导出数据
              </Button>
            </Col>
          </Row>
        </div>

        {/* 数据表格 */}
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={filteredData}
          rowKey="warehouse_code"
          loading={loading}
          size="small"
          scroll={{ x: 1200, y: 600 }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range?.[0]}-${range?.[1]} 条，共 ${total} 个仓库`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无仓库记录"
              />
            )
          }}
        />
      </Card>

      {/* 编辑/新增模态框 */}
      <Modal
        title={
          <Space>
            {editingRecord ? <EditOutlined /> : <PlusOutlined />}
            {editingRecord ? '编辑仓库信息' : '新增仓库'}
          </Space>
        }
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingRecord(null);
          form.resetFields();
        }}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Divider />
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveWarehouse}
          initialValues={{
            status: 'active'
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="warehouse_code"
                label="仓库代码"
                rules={[
                  { required: true, message: '请输入仓库代码' },
                  { max: 50, message: '仓库代码长度不能超过50个字符' }
                ]}
              >
                <Input 
                  placeholder="请输入仓库代码" 
                  disabled={!!editingRecord}
                  maxLength={50}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="recipient_name"
                label="收件人"
                rules={[
                  { required: true, message: '请输入收件人姓名' },
                  { max: 100, message: '收件人姓名长度不能超过100个字符' }
                ]}
              >
                <Input 
                  placeholder="请输入收件人姓名" 
                  prefix={<UserOutlined />}
                  maxLength={100}
                />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            name="address_line1"
            label="地址一"
            rules={[
              { required: true, message: '请输入地址一' },
              { max: 200, message: '地址长度不能超过200个字符' }
            ]}
          >
            <Input 
              placeholder="请输入主要地址" 
              prefix={<EnvironmentOutlined />}
              maxLength={200}
            />
          </Form.Item>

          <Form.Item
            name="address_line2"
            label="地址二"
            rules={[
              { max: 200, message: '地址长度不能超过200个字符' }
            ]}
          >
            <Input 
              placeholder="请输入补充地址（可选）" 
              prefix={<EnvironmentOutlined />}
              maxLength={200}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="city"
                label="城市"
                rules={[
                  { required: true, message: '请输入城市' },
                  { max: 100, message: '城市名称长度不能超过100个字符' }
                ]}
              >
                <Input 
                  placeholder="请输入城市" 
                  maxLength={100}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="state_province"
                label="州/省"
                rules={[
                  { max: 100, message: '州/省名称长度不能超过100个字符' }
                ]}
              >
                <Input 
                  placeholder="请输入州/省" 
                  maxLength={100}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="postal_code"
                label="邮编"
                rules={[
                  { required: true, message: '请输入邮编' },
                  { max: 20, message: '邮编长度不能超过20个字符' }
                ]}
              >
                <Input 
                  placeholder="请输入邮编" 
                  maxLength={20}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="country"
                label="国家"
                rules={[
                  { required: true, message: '请输入国家' },
                  { max: 100, message: '国家名称长度不能超过100个字符' }
                ]}
              >
                <Input 
                  placeholder="请输入国家" 
                  prefix={<GlobalOutlined />}
                  maxLength={100}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="电话"
                rules={[
                  { max: 50, message: '电话长度不能超过50个字符' }
                ]}
              >
                <Input 
                  placeholder="请输入联系电话" 
                  prefix={<PhoneOutlined />}
                  maxLength={50}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="status"
                label="状态"
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select placeholder="选择仓库状态">
                  <Option value="active">
                    <Space>
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      启用
                    </Space>
                  </Option>
                  <Option value="inactive">
                    <Space>
                      <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                      禁用
                    </Space>
                  </Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="notes"
            label="备注"
            rules={[
              { max: 500, message: '备注长度不能超过500个字符' }
            ]}
          >
            <TextArea 
              rows={3} 
              placeholder="请输入备注信息（可选）" 
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Divider />
          
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setEditModalVisible(false);
                setEditingRecord(null);
                form.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingRecord ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看详情模态框 */}
      <Modal
        title={
          <Space>
            <InfoCircleOutlined />
            仓库详细信息
          </Space>
        }
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false);
          setViewingRecord(null);
        }}
        footer={[
          <Button key="edit" type="primary" onClick={() => {
            setViewModalVisible(false);
            setEditingRecord(viewingRecord);
            form.setFieldsValue(viewingRecord);
            setEditModalVisible(true);
          }}>
            编辑
          </Button>,
          <Button key="close" onClick={() => {
            setViewModalVisible(false);
            setViewingRecord(null);
          }}>
            关闭
          </Button>
        ]}
        width={700}
      >
        {viewingRecord && (
          <div>
            <Descriptions title="基本信息" column={2} bordered>
              <Descriptions.Item label="仓库代码">
                <Tag color="blue" style={{ fontWeight: 'bold' }}>
                  {viewingRecord.warehouse_code}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag 
                  color={viewingRecord.status === 'active' ? 'success' : 'error'}
                  icon={viewingRecord.status === 'active' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                >
                  {viewingRecord.status === 'active' ? '启用' : '禁用'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="收件人">
                <Space>
                  <UserOutlined />
                  {viewingRecord.recipient_name}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="电话">
                {viewingRecord.phone ? (
                  <Space>
                    <PhoneOutlined />
                    <a href={`tel:${viewingRecord.phone}`}>{viewingRecord.phone}</a>
                  </Space>
                ) : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">地址信息</Divider>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="地址一">
                <Space>
                  <EnvironmentOutlined />
                  {viewingRecord.address_line1}
                </Space>
              </Descriptions.Item>
              {viewingRecord.address_line2 && (
                <Descriptions.Item label="地址二">
                  <Space>
                    <EnvironmentOutlined />
                    {viewingRecord.address_line2}
                  </Space>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="城市/州省/邮编">
                <Space>
                  <Tag>{viewingRecord.city}</Tag>
                  {viewingRecord.state_province && <Tag>{viewingRecord.state_province}</Tag>}
                  <Tag>{viewingRecord.postal_code}</Tag>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="国家">
                <Space>
                  <GlobalOutlined />
                  <Tag color="green">{viewingRecord.country}</Tag>
                </Space>
              </Descriptions.Item>
            </Descriptions>

            {viewingRecord.notes && (
              <>
                <Divider orientation="left">备注信息</Divider>
                <Paragraph>
                  {viewingRecord.notes}
                </Paragraph>
              </>
            )}

            <Divider orientation="left">时间信息</Divider>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="创建时间">
                {viewingRecord.created_at ? dayjs(viewingRecord.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {viewingRecord.updated_at ? dayjs(viewingRecord.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default WarehouseManagement; 