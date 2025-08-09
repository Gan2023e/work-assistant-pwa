import React, { useState, useEffect } from 'react';
import { Table, Card, Input, Button, message, Space, InputNumber, Tag, Statistic, Row, Col, Modal, Form, Select, Popconfirm } from 'antd';
import { SearchOutlined, SaveOutlined, EditOutlined, UndoOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined, DollarOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { FormInstance } from 'antd/es/form';
import { API_BASE_URL } from '../../config/api';
import dayjs from 'dayjs';

const { Option } = Select;

interface PackagePriceRecord {
  sku: string;
  一般价?: number;
  特殊价?: number;
  一般价_time?: string;
  特殊价_time?: string;
}

interface EditingRecord {
  [key: string]: {
    一般价?: number;
    特殊价?: number;
  };
}

const PackagePriceConfig: React.FC = () => {
  const [data, setData] = useState<PackagePriceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [editing, setEditing] = useState<EditingRecord>({});
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });

  // 添加新价格模态框
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [allSkus, setAllSkus] = useState<string[]>([]);

  // 统计数据
  const [stats, setStats] = useState({
    totalSkus: 0,
    hasGeneralPrice: 0,
    hasSpecialPrice: 0,
    noPriceConfig: 0,
  });

  useEffect(() => {
    fetchData();
    fetchAllSkus();
  }, [pagination.current, pagination.pageSize, searchValue]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.current.toString(),
        limit: pagination.pageSize.toString(),
        ...(searchValue && { search: searchValue }),
      });

      const response = await fetch(`${API_BASE_URL}/api/salary/package-prices?${params}`);
      const result = await response.json();

      if (result.code === 0) {
        setData(result.data.list);
        setPagination(prev => ({
          ...prev,
          total: result.data.total,
        }));

        // 计算统计数据
        const hasGeneral = result.data.list.filter((item: PackagePriceRecord) => item.一般价 && item.一般价 > 0).length;
        const hasSpecial = result.data.list.filter((item: PackagePriceRecord) => item.特殊价 && item.特殊价 > 0).length;
        setStats({
          totalSkus: result.data.total,
          hasGeneralPrice: hasGeneral,
          hasSpecialPrice: hasSpecial,
          noPriceConfig: result.data.list.filter((item: PackagePriceRecord) => !item.一般价 && !item.特殊价).length,
        });
      } else {
        message.error(result.message || '获取数据失败');
      }
    } catch (error) {
      console.error('获取打包单价配置失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSkus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/salary/skus`);
      const result = await response.json();
      if (result.code === 0) {
        setAllSkus(result.data);
      }
    } catch (error) {
      console.error('获取SKU列表失败:', error);
    }
  };

  const handleEdit = (record: PackagePriceRecord) => {
    setEditing({
      ...editing,
      [record.sku]: {
        一般价: record.一般价 || 0,
        特殊价: record.特殊价 || 0,
      },
    });
  };

  const handleCancel = (sku: string) => {
    const newEditing = { ...editing };
    delete newEditing[sku];
    setEditing(newEditing);
  };

  const handleSave = async (record: PackagePriceRecord) => {
    const editData = editing[record.sku];
    if (!editData) return;

    const updates = [];
    if (editData.一般价 && editData.一般价 > 0) {
      updates.push({ sku: record.sku, type: '一般价', price: editData.一般价 });
    }
    if (editData.特殊价 && editData.特殊价 > 0) {
      updates.push({ sku: record.sku, type: '特殊价', price: editData.特殊价 });
    }

    if (updates.length === 0) {
      message.error('至少需要设置一种价格类型');
      return;
    }

    try {
      for (const update of updates) {
        const response = await fetch(`${API_BASE_URL}/api/salary/package-prices`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(update),
        });

        const result = await response.json();
        if (result.code !== 0) {
          throw new Error(result.message);
        }
      }

      message.success('保存成功');
      handleCancel(record.sku);
      fetchData();
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    }
  };

  const handleBatchSave = async () => {
    const updates: any[] = [];
    
    Object.entries(editing).forEach(([sku, data]) => {
      if (data.一般价 && data.一般价 > 0) {
        updates.push({ sku, type: '一般价', price: data.一般价 });
      }
      if (data.特殊价 && data.特殊价 > 0) {
        updates.push({ sku, type: '特殊价', price: data.特殊价 });
      }
    });

    if (updates.length === 0) {
      message.warning('没有需要保存的修改');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/salary/package-prices/batch`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      });

      const result = await response.json();
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

  const handleDelete = async (sku: string, type: '一般价' | '特殊价') => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/salary/package-prices`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sku, type }),
      });

      const result = await response.json();
      if (result.code === 0) {
        message.success('删除成功');
        fetchData();
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleAddPrice = async (values: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/salary/package-prices`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();
      if (result.code === 0) {
        message.success('添加成功');
        setAddModalVisible(false);
        (form as any).resetFields();
        fetchData();
      } else {
        message.error(result.message || '添加失败');
      }
    } catch (error) {
      console.error('添加失败:', error);
      message.error('添加失败');
    }
  };

  const columns: ColumnsType<PackagePriceRecord> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 200,
      fixed: 'left',
    },
    {
      title: '一般价 (元)',
      key: 'general_price',
      width: 200,
      render: (_, record) => {
        const isEditing = editing[record.sku];
        
        if (isEditing) {
          return (
            <InputNumber
              min={0}
              precision={2}
              value={isEditing.一般价}
              onChange={(val) => setEditing({
                ...editing,
                [record.sku]: { 
                  ...editing[record.sku],
                  一般价: val || 0 
                }
              })}
              style={{ width: '100%' }}
              placeholder="输入一般价"
            />
          );
        }

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {record.一般价 ? (
              <div>
                <Tag color="blue">¥{record.一般价}</Tag>
                {record.一般价_time && (
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {dayjs(record.一般价_time).format('YYYY-MM-DD HH:mm')}
                  </div>
                )}
              </div>
            ) : (
              <Tag color="default">未设置</Tag>
            )}
          </div>
        );
      },
    },
    {
      title: '特殊价 (元)',
      key: 'special_price',
      width: 200,
      render: (_, record) => {
        const isEditing = editing[record.sku];
        
        if (isEditing) {
          return (
            <InputNumber
              min={0}
              precision={2}
              value={isEditing.特殊价}
              onChange={(val) => setEditing({
                ...editing,
                [record.sku]: { 
                  ...editing[record.sku],
                  特殊价: val || 0 
                }
              })}
              style={{ width: '100%' }}
              placeholder="输入特殊价"
            />
          );
        }

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {record.特殊价 ? (
              <div>
                <Tag color="orange">¥{record.特殊价}</Tag>
                {record.特殊价_time && (
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {dayjs(record.特殊价_time).format('YYYY-MM-DD HH:mm')}
                  </div>
                )}
              </div>
            ) : (
              <Tag color="default">未设置</Tag>
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
        const hasGeneral = record.一般价 && record.一般价 > 0;
        const hasSpecial = record.特殊价 && record.特殊价 > 0;
        
        if (hasGeneral && hasSpecial) {
          return <Tag color="green">完整配置</Tag>;
        } else if (hasGeneral || hasSpecial) {
          return <Tag color="orange">部分配置</Tag>;
        } else {
          return <Tag color="red">未配置</Tag>;
        }
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        const isEditing = editing[record.sku];
        
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
                onClick={() => handleCancel(record.sku)}
              >
                取消
              </Button>
            </Space>
          );
        }

        return (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            {(record.一般价 || record.特殊价) && (
              <Popconfirm
                title="确定删除所有价格配置吗？"
                onConfirm={() => {
                  if (record.一般价) handleDelete(record.sku, '一般价');
                  if (record.特殊价) handleDelete(record.sku, '特殊价');
                }}
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
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总SKU数量" value={stats.totalSkus} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="有一般价" value={stats.hasGeneralPrice} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="有特殊价" value={stats.hasSpecialPrice} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="未配置" value={stats.noPriceConfig} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      <Card title="SKU打包单价配置">
        {/* 工具栏 */}
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Input
              placeholder="搜索SKU"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onPressEnter={() => {
                setPagination(prev => ({ ...prev, current: 1 }));
                fetchData();
              }}
              style={{ width: 200 }}
              suffix={<SearchOutlined />}
            />
            <Button onClick={() => {
              setPagination(prev => ({ ...prev, current: 1 }));
              fetchData();
            }}>搜索</Button>
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
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddModalVisible(true)}
            >
              新增价格
            </Button>
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
          rowKey="sku"
          loading={loading}
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
          scroll={{ x: 900 }}
          size="small"
        />
      </Card>

      {/* 添加价格模态框 */}
      <Modal
        title="新增SKU打包单价"
        visible={addModalVisible}
        onCancel={() => {
          setAddModalVisible(false);
          (form as any).resetFields();
        }}
        onOk={() => (form as any).submit()}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddPrice}
        >
          <Form.Item
            name="sku"
            label="SKU"
            rules={[{ required: true, message: '请选择SKU' }]}
          >
            <Select
              placeholder="选择或输入SKU"
              showSearch
              allowClear
              optionFilterProp="children"
            >
              {allSkus.map(sku => (
                <Option key={sku} value={sku}>{sku}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="type"
            label="价格类型"
            rules={[{ required: true, message: '请选择价格类型' }]}
          >
            <Select placeholder="选择价格类型">
              <Option value="一般价">一般价</Option>
              <Option value="特殊价">特殊价</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="price"
            label="单价 (元)"
            rules={[
              { required: true, message: '请输入单价' },
              { type: 'number', min: 0.01, message: '单价必须大于0' }
            ]}
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="输入单价"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PackagePriceConfig; 