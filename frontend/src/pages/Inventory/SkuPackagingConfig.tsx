import React, { useState, useEffect } from 'react';
import { Table, Card, Input, Button, message, Space, InputNumber, Popconfirm, Tag, Statistic, Row, Col, Modal, Form, Select } from 'antd';
import { SearchOutlined, SaveOutlined, EditOutlined, UndoOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { API_BASE_URL } from '../../config/api';

interface SkuPackagingRecord {
  skuid: number;
  parent_sku: string;
  child_sku: string;
  sellercolorname?: string;
  sellersizename?: string;
  qty_per_box?: number;
}

interface EditingRecord {
  [key: number]: {
    qty_per_box?: number;
  };
}

const SkuPackagingConfig: React.FC = () => {
  const [data, setData] = useState<SkuPackagingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [editing, setEditing] = useState<EditingRecord>({});
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });

  // 统计数据
  const [stats, setStats] = useState({
    totalSkus: 0,
    configuredSkus: 0,
    unconfiguredSkus: 0,
  });

  // 批量设置装箱数量
  const [batchPackagingModalVisible, setBatchPackagingModalVisible] = useState(false);
  const [batchPackagingForm] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<SkuPackagingRecord[]>([]);

  // 通用API调用函数
  const apiCall = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  };

  useEffect(() => {
    fetchData();
  }, [pagination.current, pagination.pageSize, searchValue]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.current.toString(),
        limit: pagination.pageSize.toString(),
        ...(searchValue && { search: searchValue }),
      });

      const result = await apiCall(`${API_BASE_URL}/api/inventory/sku-packaging?${params}`);

      if (result.code === 0) {
        setData(result.data.list);
        setPagination(prev => ({
          ...prev,
          total: result.data.total,
        }));

        // 计算统计数据
        const configured = result.data.list.filter((item: SkuPackagingRecord) => item.qty_per_box && item.qty_per_box > 0).length;
        setStats({
          totalSkus: result.data.total,
          configuredSkus: configured,
          unconfiguredSkus: result.data.total - configured,
        });
      } else {
        message.error(result.message || '获取数据失败');
      }
    } catch (error) {
      console.error('获取SKU装箱配置失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: SkuPackagingRecord) => {
    setEditing({
      ...editing,
      [record.skuid]: {
        qty_per_box: record.qty_per_box || 1,
      },
    });
  };

  const handleCancel = (skuid: number) => {
    const newEditing = { ...editing };
    delete newEditing[skuid];
    setEditing(newEditing);
  };

  const handleSave = async (record: SkuPackagingRecord) => {
    const editData = editing[record.skuid];
    if (!editData || !editData.qty_per_box || editData.qty_per_box < 1) {
      message.error('装箱数量必须大于0');
      return;
    }

    try {
      const result = await apiCall(`${API_BASE_URL}/api/inventory/sku-packaging/${record.skuid}`, {
        method: 'PUT',
        body: JSON.stringify({
          qty_per_box: editData.qty_per_box,
        }),
      });
      if (result.code === 0) {
        message.success('保存成功');
        handleCancel(record.skuid);
        fetchData();
      } else {
        message.error(result.message || '保存失败');
      }
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    }
  };

  const handleBatchSave = async () => {
    const updates = Object.entries(editing).map(([skuid, data]) => ({
      skuid: parseInt(skuid),
      qty_per_box: data.qty_per_box,
    }));

    if (updates.length === 0) {
      message.warning('没有需要保存的修改');
      return;
    }

    try {
      const result = await apiCall(`${API_BASE_URL}/api/inventory/sku-packaging/batch`, {
        method: 'PUT',
        body: JSON.stringify({ updates }),
      });
      if (result.code === 0) {
        message.success(result.message);
        setEditing({});
        fetchData();
      } else {
        message.error(result.message || '批量保存失败');
      }
    } catch (error) {
      console.error('批量保存失败:', error);
      message.error('批量保存失败');
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchData();
  };

  // 批量设置装箱数量
  const handleBatchSetPackaging = async (values: any) => {
    const { qty_per_box } = values;
    
    if (selectedRows.length === 0) {
      message.warning('请先选择要设置装箱数量的SKU');
      return;
    }

    // 验证装箱数量
    const parsedQty = Number(qty_per_box);
    if (!qty_per_box || isNaN(parsedQty) || parsedQty < 1) {
      message.error('请输入有效的装箱数量（必须大于0的整数）');
      return;
    }

    try {
      console.log('准备批量更新装箱数量:', { qty_per_box: parsedQty, selectedRows });
      
      const updates = selectedRows.map(row => ({
        skuid: String(row.skuid), // 使用字符串格式传输大整数，避免精度丢失
        qty_per_box: Math.floor(parsedQty) // 确保是整数
      }));

      // 再次验证更新数据
      const invalidUpdates = updates.filter(update => !update.skuid || !update.qty_per_box || update.qty_per_box < 1);
      if (invalidUpdates.length > 0) {
        console.error('无效的更新数据:', invalidUpdates);
        message.error('数据验证失败，请检查选中的SKU');
        return;
      }

      console.log('发送批量更新请求:', { updates });
      console.log('API_BASE_URL:', API_BASE_URL);
      console.log('完整URL:', `${API_BASE_URL}/api/inventory/sku-packaging/batch`);

      // 添加更详细的请求日志
      const requestBody = { updates };
      console.log('请求体JSON:', JSON.stringify(requestBody));

      // 暂时绕过apiCall函数，直接使用fetch
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      console.log('发送请求头:', headers);

      const response = await fetch(`${API_BASE_URL}/api/inventory/sku-packaging/batch`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(requestBody),
      });

      console.log('响应状态:', response.status);
      console.log('响应头:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('错误响应内容:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();

      console.log('批量更新响应:', result);

      if (result.code === 0) {
        message.success(`成功为 ${selectedRows.length} 个SKU设置装箱数量`);
        setBatchPackagingModalVisible(false);
        (batchPackagingForm as any).resetFields();
        setSelectedRowKeys([]);
        setSelectedRows([]);
        fetchData();
      } else {
        message.error(result.message || '批量设置失败');
      }
    } catch (error) {
      console.error('批量设置装箱数量失败:', error);
      message.error(`批量设置失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[], newSelectedRows: SkuPackagingRecord[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
      setSelectedRows(newSelectedRows);
    },
    getCheckboxProps: (record: SkuPackagingRecord) => ({
      name: record.skuid.toString(),
    }),
  };

  const columns: ColumnsType<SkuPackagingRecord> = [
    {
      title: '父SKU',
      dataIndex: 'parent_sku',
      key: 'parent_sku',
      width: 150,
      fixed: 'left',
    },
    {
      title: '子SKU',
      dataIndex: 'child_sku',
      key: 'child_sku',
      width: 150,
      fixed: 'left',
    },
    {
      title: '颜色',
      dataIndex: 'sellercolorname',
      key: 'sellercolorname',
      width: 100,
      render: (value) => value || '-',
    },
    {
      title: '尺寸',
      dataIndex: 'sellersizename',
      key: 'sellersizename',
      width: 100,
      render: (value) => value || '-',
    },
    {
      title: '装箱数量',
      dataIndex: 'qty_per_box',
      key: 'qty_per_box',
      width: 150,
      render: (value, record) => {
        const isEditing = editing[record.skuid];
        
        if (isEditing) {
          return (
            <InputNumber
              min={1}
              value={isEditing.qty_per_box}
              onChange={(val) => setEditing({
                ...editing,
                [record.skuid]: { qty_per_box: val || 1 }
              })}
              style={{ width: '100%' }}
            />
          );
        }

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {value ? (
              <Tag color="blue">{value} 个/箱</Tag>
            ) : (
              <Tag color="red">未配置</Tag>
            )}
          </div>
        );
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => {
        const hasConfig = record.qty_per_box && record.qty_per_box > 0;
        return (
          <Tag color={hasConfig ? 'green' : 'orange'}>
            {hasConfig ? '已配置' : '待配置'}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => {
        const isEditing = editing[record.skuid];
        
        if (isEditing) {
          return (
            <Space>
              <Button
                type="primary"
                size="small"
                icon={<SaveOutlined />}
                onClick={() => handleSave(record)}
              >
                保存
              </Button>
              <Button
                size="small"
                icon={<UndoOutlined />}
                onClick={() => handleCancel(record.skuid)}
              >
                取消
              </Button>
            </Space>
          );
        }

        return (
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic title="总SKU数量" value={stats.totalSkus} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="已配置" value={stats.configuredSkus} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="待配置" value={stats.unconfiguredSkus} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      <Card title="SKU装箱数量配置">
        {/* 工具栏 */}
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Input
              placeholder="搜索SKU"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 200 }}
              suffix={<SearchOutlined />}
            />
            <Button onClick={handleSearch}>搜索</Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => {
                setSearchValue('');
                setPagination(prev => ({ ...prev, current: 1 }));
                fetchData();
              }}
            >
              重置
            </Button>
            {selectedRowKeys.length > 0 && (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => setBatchPackagingModalVisible(true)}
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
              >
                批量设置装箱数量 ({selectedRowKeys.length})
              </Button>
            )}
            {Object.keys(editing).length > 0 && (
              <>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleBatchSave}
                >
                  批量保存 ({Object.keys(editing).length})
                </Button>
                <Button
                  onClick={() => setEditing({})}
                >
                  取消所有编辑
                </Button>
              </>
            )}
          </Space>
        </div>

        {/* 表格 */}
        <Table
          columns={columns}
          dataSource={data}
          rowKey="skuid"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination(prev => ({
                ...prev,
                current: page,
                pageSize: pageSize || 50,
              }));
            },
          }}
          scroll={{ x: 800 }}
          size="small"
        />
      </Card>

      {/* 批量设置装箱数量模态框 */}
      <Modal
        title={`批量设置装箱数量 - 已选择 ${selectedRowKeys.length} 个SKU`}
        visible={batchPackagingModalVisible}
        onCancel={() => {
          setBatchPackagingModalVisible(false);
          (batchPackagingForm as any).resetFields();
        }}
        onOk={() => (batchPackagingForm as any).submit()}
        destroyOnClose
      >
        <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>📋 选中的SKU列表：</div>
          <div style={{ maxHeight: 100, overflowY: 'auto' }}>
            {selectedRows.map(row => (
              <Tag key={row.skuid} style={{ margin: '2px 4px 2px 0' }}>
                {row.child_sku}
              </Tag>
            ))}
          </div>
        </div>
        <Form
          form={batchPackagingForm}
          layout="vertical"
          onFinish={handleBatchSetPackaging}
        >
          <Form.Item
            name="qty_per_box"
            label="统一装箱数量 (个/箱)"
            rules={[
              { required: true, message: '请输入装箱数量' },
              { 
                validator: (_: any, value: any) => {
                  const num = Number(value);
                  if (isNaN(num) || num < 1) {
                    return Promise.reject(new Error('装箱数量必须是大于0的整数'));
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <InputNumber
              min={1}
              precision={0}
              style={{ width: '100%' }}
              placeholder="输入要设置的统一装箱数量"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SkuPackagingConfig; 