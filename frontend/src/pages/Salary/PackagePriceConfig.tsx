import React, { useState, useEffect } from 'react';
import { Table, Card, Input, Button, message, Space, InputNumber, Tag, Statistic, Row, Col, Modal, Form, Select, Popconfirm, Divider } from 'antd';
import { SearchOutlined, SaveOutlined, EditOutlined, UndoOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined, DollarOutlined, MinusCircleOutlined, AppstoreAddOutlined } from '@ant-design/icons';
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
  const [parentSkuInput, setParentSkuInput] = useState('');
  const [loadingChildSkus, setLoadingChildSkus] = useState(false);

  // 批量设置价格模态框
  const [batchPriceModalVisible, setBatchPriceModalVisible] = useState(false);
  const [batchPriceForm] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<PackagePriceRecord[]>([]);

  // 统计数据
  const [stats, setStats] = useState({
    totalSkus: 0,
    hasGeneralPrice: 0,
    hasSpecialPrice: 0,
    noPriceConfig: 0,
  });

  // 批量新增模态框中选中的SKU配置项
  const [selectedBatchItems, setSelectedBatchItems] = useState<number[]>([]);

  // 批量设置状态（在批量新增中）
  const [batchSetType, setBatchSetType] = useState<string | undefined>(undefined);
  const [batchSetPrice, setBatchSetPrice] = useState<number | undefined>(undefined);

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

      const url = `${API_BASE_URL}/api/salary/package-prices?${params}`;
      console.log('请求URL:', url);
      console.log('搜索参数:', searchValue);
      
      const result = await apiCall(url);
      console.log('API响应:', result);

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
      const result = await apiCall(`${API_BASE_URL}/api/salary/skus`);
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
        const result = await apiCall(`${API_BASE_URL}/api/salary/package-prices`, {
          method: 'PUT',
          body: JSON.stringify(update),
        });

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
      const result = await apiCall(`${API_BASE_URL}/api/salary/package-prices/batch`, {
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

  const handleDelete = async (sku: string, type: '一般价' | '特殊价') => {
    try {
      const result = await apiCall(`${API_BASE_URL}/api/salary/package-prices`, {
        method: 'DELETE',
        body: JSON.stringify({ sku, type }),
      });
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
      const { priceList } = values;
      
      if (!priceList || priceList.length === 0) {
        message.warning('请至少添加一个SKU价格配置');
        return;
      }

      // 验证数据完整性
      const invalidItems = priceList.filter((item: any) => !item.sku || !item.type || !item.price || item.price <= 0);
      if (invalidItems.length > 0) {
        message.error('请确保所有SKU信息完整且价格大于0');
        return;
      }

      // 检查重复SKU+价格类型组合
      const duplicateCheck = new Set();
      for (const item of priceList) {
        const key = `${item.sku}-${item.type}`;
        if (duplicateCheck.has(key)) {
          message.error(`SKU "${item.sku}" 的 "${item.type}" 配置重复，请检查`);
          return;
        }
        duplicateCheck.add(key);
      }

      // 使用批量API提交
      const result = await apiCall(`${API_BASE_URL}/api/salary/package-prices/batch`, {
        method: 'PUT',
        body: JSON.stringify({ updates: priceList }),
      });

      if (result.code === 0) {
        message.success(`成功添加 ${priceList.length} 个SKU价格配置`);
        setAddModalVisible(false);
        (form as any).resetFields();
        setSelectedBatchItems([]);
        setParentSkuInput('');
        setBatchSetType(undefined);
        setBatchSetPrice(undefined);
        fetchData();
      } else {
        message.error(result.message || '批量添加失败');
      }
    } catch (error) {
      console.error('添加失败:', error);
      message.error('添加失败');
    }
  };

  // 批量设置价格
  const handleBatchSetPrice = async (values: any) => {
    const { priceType, price } = values;
    
    if (selectedRows.length === 0) {
      message.warning('请先选择要设置价格的SKU');
      return;
    }

    try {
      const updates = selectedRows.map(row => ({
        sku: row.sku,
        type: priceType,
        price: parseFloat(price)
      }));

      const result = await apiCall(`${API_BASE_URL}/api/salary/package-prices/batch`, {
        method: 'PUT',
        body: JSON.stringify({ updates }),
      });

      if (result.code === 0) {
        message.success(`成功为 ${selectedRows.length} 个SKU设置${priceType}`);
        setBatchPriceModalVisible(false);
        (batchPriceForm as any).resetFields();
        setSelectedRowKeys([]);
        setSelectedRows([]);
        fetchData();
      } else {
        message.error(result.message || '批量设置失败');
      }
    } catch (error) {
      console.error('批量设置价格失败:', error);
      message.error('批量设置失败');
    }
  };

  // 批量添加子SKU到表单
  const handleBatchAddChildSkus = async () => {
    if (!parentSkuInput.trim()) {
      message.warning('请输入父SKU');
      return;
    }

    setLoadingChildSkus(true);
    try {
      const result = await apiCall(`${API_BASE_URL}/api/salary/child-skus/${encodeURIComponent(parentSkuInput.trim())}`);
      if (result.code === 0 && result.data.length > 0) {
        const currentPriceList = (form as any).getFieldValue('priceList') || [];
        const newSkuConfigs = result.data.map((childSku: any) => ({
          sku: childSku.child_sku,
          type: '一般价',
          price: undefined
        }));
        
        // 检查第一行是否为空（没有SKU），如果是空的就删除第一行
        let finalPriceList;
        if (currentPriceList.length > 0 && !currentPriceList[0].sku) {
          // 第一行为空，用新的SKU配置替换整个列表（去掉第一行空行）
          finalPriceList = [...newSkuConfigs];
        } else {
          // 第一行不为空，追加到现有列表后面
          finalPriceList = [...currentPriceList, ...newSkuConfigs];
        }
        
        (form as any).setFieldsValue({
          priceList: finalPriceList
        });
        
        message.success(`成功添加 ${result.data.length} 个子SKU配置`);
        setParentSkuInput('');
        setSelectedBatchItems([]); // 清空选中项
        setBatchSetType(undefined);
        setBatchSetPrice(undefined);
      } else {
        message.info('未找到该父SKU对应的子SKU');
      }
    } catch (error) {
      console.error('获取子SKU失败:', error);
      message.error('获取子SKU失败');
    } finally {
      setLoadingChildSkus(false);
    }
  };

  // 批量设置SKU配置项的价格类型和单价
  const handleBatchSetSkuConfig = async () => {
    if (!batchSetType && !batchSetPrice) {
      message.warning('请至少选择价格类型或输入单价');
      return;
    }

    try {
      const currentPriceList = (form as any).getFieldValue('priceList') || [];
      const updatedList = currentPriceList.map((item: any, index: number) => {
        if (selectedBatchItems.includes(index)) {
          return {
            ...item,
            ...(batchSetType && { type: batchSetType }),
            ...(batchSetPrice && { price: batchSetPrice })
          };
        }
        return item;
      });
      
      (form as any).setFieldsValue({ priceList: updatedList });
      
      const changeCount = selectedBatchItems.length;
      setSelectedBatchItems([]);
      setBatchSetType(undefined);
      setBatchSetPrice(undefined);
      
      message.success(`成功批量设置 ${changeCount} 个SKU配置`);
    } catch (error) {
      console.error('批量设置失败:', error);
      message.error('批量设置失败');
    }
  };

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[], newSelectedRows: PackagePriceRecord[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
      setSelectedRows(newSelectedRows);
    },
    getCheckboxProps: (record: PackagePriceRecord) => ({
      name: record.sku,
    }),
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
              批量新增价格
            </Button>
            {selectedRowKeys.length > 0 && (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => setBatchPriceModalVisible(true)}
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
              >
                批量设置价格 ({selectedRowKeys.length})
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
          rowKey="sku"
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
          scroll={{ x: 900 }}
          size="small"
        />
      </Card>

      {/* 批量设置价格模态框 */}
      <Modal
        title={`批量设置价格 - 已选择 ${selectedRowKeys.length} 个SKU`}
        visible={batchPriceModalVisible}
        onCancel={() => {
          setBatchPriceModalVisible(false);
          (batchPriceForm as any).resetFields();
        }}
        onOk={() => (batchPriceForm as any).submit()}
        destroyOnClose
      >
        <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>📋 选中的SKU列表：</div>
          <div style={{ maxHeight: 100, overflowY: 'auto' }}>
            {selectedRows.map(row => (
              <Tag key={row.sku} style={{ margin: '2px 4px 2px 0' }}>
                {row.sku}
              </Tag>
            ))}
          </div>
        </div>
        <Form
          form={batchPriceForm}
          layout="vertical"
          onFinish={handleBatchSetPrice}
        >
          <Form.Item
            name="priceType"
            label="价格类型"
            rules={[{ required: true, message: '请选择价格类型' }]}
          >
            <Select placeholder="选择要设置的价格类型">
              <Option value="一般价">一般价</Option>
              <Option value="特殊价">特殊价</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="price"
            label="统一单价 (元)"
            rules={[
              { required: true, message: '请输入单价' },
              { type: 'number', min: 0.01, message: '单价必须大于0' }
            ]}
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="输入要设置的统一单价"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量添加价格模态框 */}
      <Modal
        title="批量新增SKU打包单价"
        visible={addModalVisible}
        onCancel={() => {
          setAddModalVisible(false);
          (form as any).resetFields();
          setSelectedBatchItems([]);
          setParentSkuInput('');
        }}
        onOk={() => (form as any).submit()}
        destroyOnClose
        width={800}
        bodyStyle={{ maxHeight: '70vh', overflow: 'auto' }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddPrice}
          initialValues={{
            priceList: [{ sku: '', type: '一般价', price: undefined }]
          }}
        >
          {/* 父SKU批量添加区域 */}
          <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f8f9fa' }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                🚀 批量添加子SKU
              </span>
            </div>
            <Row gutter={8} align="middle">
              <Col flex="auto">
                <Input
                  placeholder="输入父SKU，例如：BC070A"
                  value={parentSkuInput}
                  onChange={(e) => setParentSkuInput(e.target.value)}
                  onPressEnter={handleBatchAddChildSkus}
                />
              </Col>
              <Col>
                <Button
                  type="primary"
                  icon={<AppstoreAddOutlined />}
                  onClick={handleBatchAddChildSkus}
                  loading={loadingChildSkus}
                  size="middle"
                >
                  批量添加子SKU
                </Button>
              </Col>
            </Row>
            <div style={{ marginTop: 8, color: '#666', fontSize: '12px' }}>
              💡 输入父SKU后，系统会自动获取所有对应的子SKU并添加到下方配置列表中
            </div>
          </Card>

          <Divider orientation="left" style={{ margin: '16px 0' }}>SKU价格配置</Divider>

          <Form.List name="priceList">
            {(fields, { add, remove }) => (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ color: '#666', fontSize: '14px' }}>
                      💡 提示：可以添加多个SKU的价格配置，支持不同的价格类型
                    </span>
                    <Button
                      type="dashed"
                      onClick={() => add({ sku: '', type: '一般价', price: undefined })}
                      icon={<PlusOutlined />}
                      size="small"
                    >
                      添加SKU
                    </Button>
                  </div>
                  
                  {/* 批量设置工具栏 */}
                  {selectedBatchItems.length > 0 && (
                    <div style={{ 
                      padding: '8px 12px', 
                      backgroundColor: '#e6f7ff', 
                      border: '1px solid #91d5ff', 
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{ color: '#1890ff', fontWeight: 'bold', fontSize: '13px' }}>
                        已选择 {selectedBatchItems.length} 项
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <span style={{ fontSize: '13px' }}>批量设置：</span>
                        <Select
                          placeholder="价格类型"
                          allowClear
                          size="small"
                          style={{ width: 90 }}
                          value={batchSetType}
                          onChange={setBatchSetType}
                        >
                          <Option value="一般价">一般价</Option>
                          <Option value="特殊价">特殊价</Option>
                        </Select>
                                                 <InputNumber
                           placeholder="单价"
                           min={0}
                           precision={2}
                           size="small"
                           style={{ width: 80 }}
                           value={batchSetPrice}
                           onChange={(value) => setBatchSetPrice(value || undefined)}
                         />
                        <Button
                          type="primary"
                          size="small"
                          onClick={handleBatchSetSkuConfig}
                          disabled={!batchSetType && !batchSetPrice}
                        >
                          应用
                        </Button>
                        <Button
                          size="small"
                          onClick={() => {
                            setSelectedBatchItems([]);
                            setBatchSetType(undefined);
                            setBatchSetPrice(undefined);
                          }}
                        >
                          取消选择
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Excel式表格布局 */}
                <div style={{ border: '1px solid #d9d9d9', borderRadius: '6px' }}>
                  {/* 表头 */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '40px 1fr 120px 120px 60px',
                    backgroundColor: '#fafafa',
                    borderBottom: '1px solid #d9d9d9',
                    padding: '8px',
                    fontWeight: 'bold',
                    fontSize: '13px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedBatchItems.length === fields.length && fields.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBatchItems(fields.map((_, index) => index));
                          } else {
                            setSelectedBatchItems([]);
                          }
                        }}
                      />
                    </div>
                    <div>SKU</div>
                    <div>价格类型</div>
                    <div>单价 (元)</div>
                    <div>操作</div>
                  </div>

                  {/* 表格行 */}
                  {fields.map(({ key, name, ...restField }, index) => (
                    <div 
                      key={key}
                      style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '40px 1fr 120px 120px 60px',
                        borderBottom: index < fields.length - 1 ? '1px solid #f0f0f0' : 'none',
                        padding: '8px',
                        backgroundColor: selectedBatchItems.includes(index) ? '#e6f7ff' : 'transparent'
                      }}
                    >
                      {/* 勾选框 */}
                      <div style={{ textAlign: 'center', paddingTop: '6px' }}>
                        <input
                          type="checkbox"
                          checked={selectedBatchItems.includes(index)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBatchItems([...selectedBatchItems, index]);
                            } else {
                              setSelectedBatchItems(selectedBatchItems.filter(i => i !== index));
                            }
                          }}
                        />
                      </div>

                      {/* SKU选择 */}
                      <div style={{ paddingRight: '8px' }}>
                        <Form.Item
                          {...restField}
                          name={[name, 'sku']}
                          rules={[{ required: true, message: '请选择SKU' }]}
                          style={{ margin: 0 }}
                        >
                          <Select
                            placeholder="选择或输入SKU"
                            showSearch
                            allowClear
                            size="small"
                            optionFilterProp="children"
                            filterOption={(input, option) =>
                              option?.value?.toString().toLowerCase().includes(input.toLowerCase()) || false
                            }
                          >
                            {allSkus.map(sku => (
                              <Option key={sku} value={sku}>{sku}</Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </div>

                      {/* 价格类型 */}
                      <div style={{ paddingRight: '8px' }}>
                        <Form.Item
                          {...restField}
                          name={[name, 'type']}
                          rules={[{ required: true, message: '请选择价格类型' }]}
                          style={{ margin: 0 }}
                        >
                          <Select placeholder="价格类型" size="small">
                            <Option value="一般价">一般价</Option>
                            <Option value="特殊价">特殊价</Option>
                          </Select>
                        </Form.Item>
                      </div>

                      {/* 单价 */}
                      <div style={{ paddingRight: '8px' }}>
                        <Form.Item
                          {...restField}
                          name={[name, 'price']}
                          rules={[
                            { required: true, message: '请输入单价' },
                            { type: 'number', min: 0.01, message: '单价必须大于0' }
                          ]}
                          style={{ margin: 0 }}
                        >
                          <InputNumber
                            min={0}
                            precision={2}
                            size="small"
                            style={{ width: '100%' }}
                            placeholder="单价"
                          />
                        </Form.Item>
                      </div>

                      {/* 删除按钮 */}
                      <div style={{ textAlign: 'center', paddingTop: '2px' }}>
                        {fields.length > 1 && (
                          <Button
                            type="text"
                            icon={<MinusCircleOutlined />}
                            onClick={() => {
                              remove(name);
                              // 更新选中项索引
                              setSelectedBatchItems(prev => 
                                prev.filter(i => i !== index).map(i => i > index ? i - 1 : i)
                              );
                            }}
                            danger
                            size="small"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>


    </div>
  );
};

export default PackagePriceConfig; 