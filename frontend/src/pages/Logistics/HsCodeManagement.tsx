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
  InputNumber,
  Upload,
  Divider,
  Switch,
  Badge,
  Empty,
  Spin
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExportOutlined,
  ImportOutlined,
  ReloadOutlined,
  LinkOutlined,
  GlobalOutlined,
  DollarOutlined,
  InfoCircleOutlined,
  FilterOutlined,
  ClearOutlined,
  UploadOutlined,
  EyeOutlined,
  PictureOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { API_BASE_URL } from '../../config/api';

const { TextArea } = Input;
const { Title, Text, Link } = Typography;
const { Option } = Select;

// HSCODE接口定义
interface HsCode {
  parent_sku: string;
  weblink: string;
  uk_hscode: string;
  us_hscode: string;
  declared_value?: number;
  declared_value_currency?: string;
  declared_image?: string;
  created_at?: string;
  updated_at?: string;
}

// 搜索参数接口
interface SearchParams {
  search?: string;
  currency?: string;
  country?: string;
}

const HsCodeManagement: React.FC = () => {
  // 状态管理
  const [data, setData] = useState<HsCode[]>([]);
  const [filteredData, setFilteredData] = useState<HsCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<HsCode | null>(null);
  const [searchParams, setSearchParams] = useState<SearchParams>({});
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [uploadingParentSku, setUploadingParentSku] = useState<string | null>(null);
  
  // Form实例
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();

  // 获取HSCODE列表
  const fetchHsCodes = async (params?: SearchParams) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (params?.search) {
        queryParams.append('search', params.search);
      }
      
      const response = await fetch(`${API_BASE_URL}/api/hscode?${queryParams}`);
      const result = await response.json();
      
      if (result.code === 0) {
        setData(result.data);
        setFilteredData(result.data);
        message.success(`加载了 ${result.data.length} 条HSCODE记录`);
      } else {
        throw new Error(result.message || '获取数据失败');
      }
    } catch (error) {
      console.error('获取HSCODE列表失败:', error);
      message.error(`获取数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setData([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  };

  // 创建或更新HSCODE
  const handleSaveHsCode = async (values: HsCode) => {
    try {
      const isEditing = !!editingRecord;
      const url = isEditing 
        ? `${API_BASE_URL}/api/hscode/${encodeURIComponent(editingRecord!.parent_sku)}`
        : `${API_BASE_URL}/api/hscode`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });

      const result = await response.json();
      
      if (result.code === 0) {
        message.success(isEditing ? '更新成功' : '创建成功');
        setEditModalVisible(false);
        setEditingRecord(null);
        form.resetFields();
        await fetchHsCodes(searchParams);
      } else {
        throw new Error(result.message || '操作失败');
      }
    } catch (error) {
      console.error('保存HSCODE失败:', error);
      message.error(`操作失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 删除HSCODE
  const handleDeleteHsCode = async (parentSku: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/hscode/${encodeURIComponent(parentSku)}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (result.code === 0) {
        message.success('删除成功');
        await fetchHsCodes(searchParams);
      } else {
        throw new Error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除HSCODE失败:', error);
      message.error(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的记录');
      return;
    }

    Modal.confirm({
      title: '批量删除确认',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条记录吗？此操作不可恢复。`,
      okText: '确定删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const promises = selectedRowKeys.map(key => 
            fetch(`${API_BASE_URL}/api/hscode/${encodeURIComponent(key as string)}`, {
              method: 'DELETE'
            })
          );
          
          await Promise.all(promises);
          message.success(`成功删除 ${selectedRowKeys.length} 条记录`);
          setSelectedRowKeys([]);
          await fetchHsCodes(searchParams);
        } catch (error) {
          message.error('批量删除失败');
        }
      }
    });
  };

  // 搜索处理
  const handleSearch = (params: SearchParams) => {
    setSearchParams(params);
    
    let filtered = [...data];
    
    // 文本搜索
    if (params.search) {
      const searchLower = params.search.toLowerCase();
      filtered = filtered.filter(item =>
        item.parent_sku.toLowerCase().includes(searchLower) ||
        item.weblink.toLowerCase().includes(searchLower) ||
        item.uk_hscode.toLowerCase().includes(searchLower) ||
        item.us_hscode.toLowerCase().includes(searchLower)
      );
    }
    
    // 货币筛选
    if (params.currency) {
      filtered = filtered.filter(item => item.declared_value_currency === params.currency);
    }
    
    setFilteredData(filtered);
  };

  // 重置搜索
  const handleResetSearch = () => {
    setSearchParams({});
    setFilteredData(data);
    searchForm.resetFields();
  };

  // 导出数据
  const handleExport = () => {
    const csvContent = [
      ['父SKU', '产品链接', '英国HSCODE', '美国HSCODE', '申报价值', '货币', '创建时间'].join(','),
      ...filteredData.map(item => [
        item.parent_sku,
        item.weblink,
        item.uk_hscode,
        item.us_hscode,
        item.declared_value || '',
        item.declared_value_currency || '',
        item.created_at ? dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss') : ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `hscode_${dayjs().format('YYYY-MM-DD')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    message.success('数据导出成功');
  };

  // 新增记录
  const handleAddNew = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      declared_value_currency: 'USD'
    });
    setEditModalVisible(true);
  };

  // 编辑记录
  const handleEdit = (record: HsCode) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setEditModalVisible(true);
  };

  // 图片上传处理
  const handleImageUpload = async (parentSku: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    
    setUploadingParentSku(parentSku);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/hscode/${encodeURIComponent(parentSku)}/upload-image`, {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success('申报图片上传成功');
        await fetchHsCodes(searchParams);
      } else {
        throw new Error(result.message || '上传失败');
      }
    } catch (error) {
      console.error('上传申报图片失败:', error);
      message.error(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setUploadingParentSku(null);
    }
  };

  // 删除图片
  const handleDeleteImage = async (parentSku: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/hscode/${encodeURIComponent(parentSku)}/image`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success('申报图片删除成功');
        await fetchHsCodes(searchParams);
      } else {
        throw new Error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除申报图片失败:', error);
      message.error(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 预览图片
  const handlePreviewImage = (imageUrl: string) => {
    setPreviewImageUrl(`${API_BASE_URL}${imageUrl}`);
    setImagePreviewVisible(true);
  };

  // 初始化
  useEffect(() => {
    fetchHsCodes();
  }, []);

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    getCheckboxProps: (record: HsCode) => ({
      name: record.parent_sku,
    }),
  };

  // 表格列配置
  const columns: ColumnsType<HsCode> = [
    {
      title: '父SKU',
      dataIndex: 'parent_sku',
      key: 'parent_sku',
      width: 120,
      fixed: 'left',
      render: (text: string) => (
        <Tag color="blue" style={{ fontWeight: 'bold' }}>
          {text}
        </Tag>
      ),
    },
    {
      title: '产品链接',
      dataIndex: 'weblink',
      key: 'weblink',
      width: 200,
      ellipsis: true,
      render: (url: string) => (
        <Tooltip title={url}>
          <Link href={url} target="_blank" rel="noopener noreferrer">
            <LinkOutlined style={{ marginRight: 4 }} />
            查看产品
          </Link>
        </Tooltip>
      ),
    },
    {
      title: (
        <Space>
          <GlobalOutlined />
          英国HSCODE
        </Space>
      ),
      dataIndex: 'uk_hscode',
      key: 'uk_hscode',
      width: 130,
      align: 'center',
      render: (code: string) => (
        <Tag color="green">{code}</Tag>
      ),
    },
    {
      title: (
        <Space>
          <GlobalOutlined />
          美国HSCODE
        </Space>
      ),
      dataIndex: 'us_hscode',
      key: 'us_hscode',
      width: 130,
      align: 'center',
      render: (code: string) => (
        <Tag color="orange">{code}</Tag>
      ),
    },
    {
      title: (
        <Space>
          <DollarOutlined />
          申报价值
        </Space>
      ),
      key: 'declared_value',
      width: 120,
      align: 'right',
      render: (_, record) => {
        if (!record.declared_value) return '-';
        return (
                     <Space>
             <Text strong>{record.declared_value}</Text>
             <Tag style={{ fontSize: '12px', padding: '0 4px' }}>{record.declared_value_currency}</Tag>
           </Space>
        );
      },
    },
    {
      title: (
        <Space>
          <PictureOutlined />
          申报图片
        </Space>
      ),
      key: 'declared_image',
      width: 150,
      align: 'center',
      render: (_, record) => (
        <Space direction="vertical" size="small">
          {record.declared_image ? (
            <Space>
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handlePreviewImage(record.declared_image!)}
              >
                预览
              </Button>
              <Popconfirm
                title="确定要删除这张申报图片吗？"
                onConfirm={() => handleDeleteImage(record.parent_sku)}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                >
                  删除
                </Button>
              </Popconfirm>
            </Space>
          ) : (
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={(file) => {
                handleImageUpload(record.parent_sku, file);
                return false;
              }}
              disabled={uploadingParentSku === record.parent_sku}
            >
              <Button
                type="text"
                size="small"
                icon={<UploadOutlined />}
                loading={uploadingParentSku === record.parent_sku}
              >
                上传
              </Button>
            </Upload>
          )}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      align: 'center',
      render: (date: string) => (
        date ? dayjs(date).format('YYYY-MM-DD') : '-'
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 120,
      align: 'center',
      render: (date: string) => (
        date ? dayjs(date).format('YYYY-MM-DD') : '-'
      ),
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
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              size="small"
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description={`确定要删除父SKU "${record.parent_sku}" 吗？`}
            onConfirm={() => handleDeleteHsCode(record.parent_sku)}
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
                <GlobalOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                HSCODE编码管理
              </Title>
              <Text type="secondary">
                管理产品的英美HSCODE编码和申报价值信息
              </Text>
            </Col>
            <Col>
              <Badge count={filteredData.length} showZero>
                <Button icon={<InfoCircleOutlined />} type="text">
                  记录总数
                </Button>
              </Badge>
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
                placeholder="搜索SKU、链接或HSCODE..."
                allowClear
              />
            </Form.Item>
            
            {showAdvancedSearch && (
              <>
                <Form.Item name="currency">
                  <Select placeholder="筛选货币" style={{ width: 120 }} allowClear>
                    <Option value="USD">USD</Option>
                    <Option value="EUR">EUR</Option>
                    <Option value="GBP">GBP</Option>
                    <Option value="CNY">CNY</Option>
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
                  onClick={handleAddNew}
                >
                  新增记录
                </Button>
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={() => fetchHsCodes(searchParams)}
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
              <Space>
                <Button 
                  icon={<ExportOutlined />} 
                  onClick={handleExport}
                  disabled={filteredData.length === 0}
                >
                  导出数据
                </Button>
              </Space>
            </Col>
          </Row>
        </div>

        {/* 数据表格 */}
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={filteredData}
          rowKey="parent_sku"
          loading={loading}
          size="small"
          scroll={{ x: 1200, y: 600 }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range?.[0]}-${range?.[1]} 条，共 ${total} 条记录`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无HSCODE记录"
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
            {editingRecord ? '编辑HSCODE记录' : '新增HSCODE记录'}
          </Space>
        }
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingRecord(null);
          form.resetFields();
        }}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Divider />
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveHsCode}
          initialValues={{
            declared_value_currency: 'USD'
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="parent_sku"
                label="父SKU"
                rules={[
                  { required: true, message: '请输入父SKU' },
                  { max: 10, message: 'SKU长度不能超过10个字符' }
                ]}
              >
                <Input 
                  placeholder="请输入父SKU" 
                  disabled={!!editingRecord}
                  maxLength={10}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="declared_value_currency"
                label="申报货币"
                rules={[{ required: true, message: '请选择货币' }]}
              >
                <Select placeholder="选择货币">
                  <Option value="USD">美元 (USD)</Option>
                  <Option value="EUR">欧元 (EUR)</Option>
                  <Option value="GBP">英镑 (GBP)</Option>
                  <Option value="CNY">人民币 (CNY)</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            name="weblink"
            label="产品链接"
            rules={[
              { required: true, message: '请输入产品链接' },
              { type: 'url', message: '请输入有效的URL' },
              { max: 100, message: '链接长度不能超过100个字符' }
            ]}
          >
            <Input 
              placeholder="https://..." 
              prefix={<LinkOutlined />}
              maxLength={100}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="uk_hscode"
                label="英国HSCODE"
                rules={[
                  { required: true, message: '请输入英国HSCODE' },
                  { max: 20, message: 'HSCODE长度不能超过20个字符' }
                ]}
              >
                <Input 
                  placeholder="请输入英国HSCODE" 
                  maxLength={20}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="us_hscode"
                label="美国HSCODE"
                rules={[
                  { required: true, message: '请输入美国HSCODE' },
                  { max: 20, message: 'HSCODE长度不能超过20个字符' }
                ]}
              >
                <Input 
                  placeholder="请输入美国HSCODE" 
                  maxLength={20}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="declared_value"
            label="申报价值"
            rules={[
              { type: 'number', min: 0, message: '申报价值必须大于等于0' }
            ]}
          >
            <InputNumber
              placeholder="请输入申报价值"
              style={{ width: '100%' }}
              min={0}
              precision={2}
              step={0.01}
            />
          </Form.Item>

          <Form.Item
            label="申报图片"
          >
            <div>
              {editingRecord?.declared_image ? (
                <div style={{ marginBottom: 16 }}>
                  <img
                    src={`${API_BASE_URL}${editingRecord.declared_image}`}
                    alt="当前申报图片"
                    style={{
                      maxWidth: '200px',
                      maxHeight: '150px',
                      objectFit: 'contain',
                      border: '1px solid #d9d9d9',
                      borderRadius: '6px',
                      padding: '8px'
                    }}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Space>
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handlePreviewImage(editingRecord.declared_image!)}
                      >
                        预览
                      </Button>
                      <Popconfirm
                        title="确定要删除当前图片吗？"
                        onConfirm={() => handleDeleteImage(editingRecord.parent_sku)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button
                          size="small"
                          icon={<DeleteOutlined />}
                          danger
                        >
                          删除当前图片
                        </Button>
                      </Popconfirm>
                    </Space>
                  </div>
                </div>
              ) : null}
              
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  if (editingRecord) {
                    handleImageUpload(editingRecord.parent_sku, file);
                  }
                  return false;
                }}
                disabled={!editingRecord || uploadingParentSku === editingRecord?.parent_sku}
              >
                <Button
                  icon={<UploadOutlined />}
                  loading={uploadingParentSku === editingRecord?.parent_sku}
                  disabled={!editingRecord}
                >
                  {editingRecord?.declared_image ? '替换图片' : '上传图片'}
                </Button>
              </Upload>
              <div style={{ marginTop: 8, color: '#666', fontSize: '12px' }}>
                支持格式：JPG、PNG、GIF等图片格式，文件大小不超过5MB
              </div>
            </div>
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

      {/* 图片预览模态框 */}
      <Modal
        title="申报图片预览"
        open={imagePreviewVisible}
        onCancel={() => {
          setImagePreviewVisible(false);
          setPreviewImageUrl('');
        }}
        footer={null}
        width={800}
        centered
      >
        {previewImageUrl && (
          <div style={{ textAlign: 'center' }}>
            <img
              src={previewImageUrl}
              alt="申报图片"
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain'
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default HsCodeManagement; 