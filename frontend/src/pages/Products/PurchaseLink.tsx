import React, { useState, useRef } from 'react';
import { 
  Button, 
  Input, 
  Table, 
  message, 
  Space, 
  Select, 
  Modal, 
  Upload, 
  Popconfirm,
  Form,
  Tooltip,
  Typography
} from 'antd';
import { 
  UploadOutlined, 
  DeleteOutlined, 
  EditOutlined, 
  LinkOutlined,
  ReloadOutlined,
  SearchOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ColumnsType, TableProps } from 'antd/es/table';
import { API_BASE_URL } from '../../config/api';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

interface ProductRecord {
  id: number;
  parent_sku: string;
  weblink: string;
  update_time: string;
  check_time: string;
  status: string;
  notice: string;
  cpc_recommend: string;
  cpc_status: string;
  cpc_submit: string;
  model_number: string;
  recommend_age: string;
  ads_add: string;
  list_parent_sku: string;
  no_inventory_rate: string;
  sales_30days: string;
  seller_name: string;
}

interface EditingCell {
  id: number;
  field: string;
  value: string;
}

// 更新状态选项
const statusOptions = [
  '已经上传',
  '商品已下架',
  '手动调库存',
  '审核未通过',
  '待P图',
  '临时下架',
  '待上传'
];

const Purchase: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProductRecord[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editForm] = Form.useForm();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [skuQueryModalVisible, setSkuQueryModalVisible] = useState(false);
  const [skuPrefix, setSkuPrefix] = useState('');
  const [latestSku, setLatestSku] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 搜索功能
  const handleSearch = async () => {
    const keywords = input
      .split('\n')
      .map(i => i.trim())
      .filter(Boolean);
    if (keywords.length === 0) {
      message.warning('请输入parent_sku或weblink');
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keywords }),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const result = await res.json();
      setData(result.data || []);
      
      if (!result.data || result.data.length === 0) {
        message.info('未找到匹配的产品信息');
      } else {
        message.success(`找到 ${result.data.length} 条产品信息`);
      }
    } catch (e) {
      console.error('搜索失败:', e);
      message.error(`查询失败: ${e instanceof Error ? e.message : '未知错误'}`);
    }
    setLoading(false);
  };

  // 批量更新状态
  const handleBatchUpdateStatus = async (status: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要更新的记录');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/batch-update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedRowKeys, status }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      message.success('批量更新成功');
      setSelectedRowKeys([]);
      // 刷新数据
      handleSearch();
    } catch (e) {
      console.error('批量更新失败:', e);
      message.error('批量更新失败');
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的记录');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/batch-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedRowKeys }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      message.success('批量删除成功');
      setSelectedRowKeys([]);
      // 刷新数据
      handleSearch();
    } catch (e) {
      console.error('批量删除失败:', e);
      message.error('批量删除失败');
    }
  };

  // 修复批量打开链接功能
  const handleBatchOpenLinks = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要打开的记录');
      return;
    }

    const selectedRecords = data.filter(record => selectedRowKeys.includes(record.id));
    const validLinks = selectedRecords.filter(record => record.weblink && record.weblink.trim() !== '');

    if (validLinks.length === 0) {
      message.warning('所选记录中没有有效的产品链接');
      return;
    }

    if (validLinks.length > 10) {
      Modal.confirm({
        title: '确认打开链接',
        content: `您将要打开 ${validLinks.length} 个链接，这可能会影响浏览器性能。是否继续？`,
        onOk: () => {
          // 修复：使用延时打开，防止浏览器阻止弹窗
          validLinks.forEach((record, index) => {
            setTimeout(() => {
              window.open(record.weblink, '_blank', 'noopener,noreferrer');
            }, index * 100); // 每个链接间隔100ms打开
          });
          message.success(`已打开 ${validLinks.length} 个产品链接`);
        },
      });
    } else {
      // 修复：使用延时打开，防止浏览器阻止弹窗
      validLinks.forEach((record, index) => {
        setTimeout(() => {
          window.open(record.weblink, '_blank', 'noopener,noreferrer');
        }, index * 100); // 每个链接间隔100ms打开
      });
      message.success(`已打开 ${validLinks.length} 个产品链接`);
    }
  };

  // 双击编辑单元格
  const handleCellDoubleClick = (record: ProductRecord, field: string) => {
    if (field === 'id' || field === 'update_time' || field === 'check_time') {
      return; // 这些字段不允许编辑
    }

    setEditingCell({
      id: record.id,
      field,
      value: record[field as keyof ProductRecord] as string || ''
    });
    setEditModalVisible(true);
    editForm.setFieldsValue({ value: record[field as keyof ProductRecord] || '' });
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingCell) return;

    try {
      const values = await editForm.validateFields();
      const updateData = { [editingCell.field]: values.value };

      const res = await fetch(`${API_BASE_URL}/api/product_weblink/update/${editingCell.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      message.success('更新成功');
      setEditModalVisible(false);
      setEditingCell(null);
      editForm.resetFields();
      // 刷新数据
      handleSearch();
    } catch (e) {
      console.error('更新失败:', e);
      message.error('更新失败');
    }
  };

  // 新的Excel上传处理（支持SKU, 链接, 备注）
  const handleExcelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    fetch(`${API_BASE_URL}/api/product_weblink/upload-excel-new`, {
      method: 'POST',
      body: formData,
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then(result => {
        message.success(result.message);
        setUploadModalVisible(false);
        if (result.count > 0) {
          // 刷新数据
          handleSearch();
        }
      })
      .catch(e => {
        console.error('上传失败:', e);
        message.error('上传失败: ' + e.message);
      })
      .finally(() => {
        setLoading(false);
        // 清空文件选择
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      });
  };

  // SKU查询功能
  const handleSkuQuery = async () => {
    if (!skuPrefix.trim()) {
      message.warning('请输入SKU前缀');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/latest-sku`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: skuPrefix.trim() }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      setLatestSku(result.latestSku || '未找到该前缀的SKU');
    } catch (e) {
      console.error('查询失败:', e);
      message.error('查询失败');
      setLatestSku('查询失败');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  // 表格排序处理
  const handleTableChange: TableProps<ProductRecord>['onChange'] = (pagination, filters, sorter) => {
    // 这里可以实现服务端排序，或者让antd Table自动处理客户端排序
  };

  // 表格列配置（添加排序功能）
  const columns: ColumnsType<ProductRecord> = [
    { 
      title: '母SKU', 
      dataIndex: 'parent_sku', 
      key: 'parent_sku', 
      align: 'center',
      width: 120,
      sorter: (a, b) => a.parent_sku.localeCompare(b.parent_sku),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'parent_sku'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: '产品链接', 
      dataIndex: 'weblink', 
      key: 'weblink', 
      align: 'center',
      width: 200,
      render: (text: string) => text ? (
        <Tooltip title={text}>
          <a href={text} target="_blank" rel="noopener noreferrer" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
            {text}
          </a>
        </Tooltip>
      ) : '',
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'weblink'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: '上传时间', 
      dataIndex: 'update_time', 
      key: 'update_time', 
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '', 
      align: 'center',
      width: 160,
      sorter: (a, b) => dayjs(a.update_time).unix() - dayjs(b.update_time).unix(),
    },
    { 
      title: '检查时间', 
      dataIndex: 'check_time', 
      key: 'check_time', 
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '', 
      align: 'center',
      width: 160,
      sorter: (a, b) => dayjs(a.check_time || 0).unix() - dayjs(b.check_time || 0).unix(),
    },
    { 
      title: '产品状态', 
      dataIndex: 'status', 
      key: 'status', 
      align: 'center',
      width: 100,
      sorter: (a, b) => (a.status || '').localeCompare(b.status || ''),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'status'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: '备注', 
      dataIndex: 'notice', 
      key: 'notice', 
      align: 'center',
      width: 120,
      sorter: (a, b) => (a.notice || '').localeCompare(b.notice || ''),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'notice'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: 'CPC测试推荐', 
      dataIndex: 'cpc_recommend', 
      key: 'cpc_recommend', 
      align: 'center',
      width: 120,
      sorter: (a, b) => (a.cpc_recommend || '').localeCompare(b.cpc_recommend || ''),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'cpc_recommend'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: 'CPC测试情况', 
      dataIndex: 'cpc_status', 
      key: 'cpc_status', 
      align: 'center',
      width: 120,
      sorter: (a, b) => (a.cpc_status || '').localeCompare(b.cpc_status || ''),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'cpc_status'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: 'CPC提交情况', 
      dataIndex: 'cpc_submit', 
      key: 'cpc_submit', 
      align: 'center',
      width: 120,
      sorter: (a, b) => (a.cpc_submit || '').localeCompare(b.cpc_submit || ''),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'cpc_submit'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: '型号', 
      dataIndex: 'model_number', 
      key: 'model_number', 
      align: 'center',
      width: 120,
      sorter: (a, b) => (a.model_number || '').localeCompare(b.model_number || ''),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'model_number'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: '推荐年龄', 
      dataIndex: 'recommend_age', 
      key: 'recommend_age', 
      align: 'center',
      width: 100,
      sorter: (a, b) => (a.recommend_age || '').localeCompare(b.recommend_age || ''),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'recommend_age'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: '广告是否创建', 
      dataIndex: 'ads_add', 
      key: 'ads_add', 
      align: 'center',
      width: 120,
      sorter: (a, b) => (a.ads_add || '').localeCompare(b.ads_add || ''),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'ads_add'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: '上架母SKU', 
      dataIndex: 'list_parent_sku', 
      key: 'list_parent_sku', 
      align: 'center',
      width: 120,
      sorter: (a, b) => (a.list_parent_sku || '').localeCompare(b.list_parent_sku || ''),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'list_parent_sku'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: '缺货率', 
      dataIndex: 'no_inventory_rate', 
      key: 'no_inventory_rate', 
      align: 'center',
      width: 100,
      sorter: (a, b) => (parseFloat(a.no_inventory_rate) || 0) - (parseFloat(b.no_inventory_rate) || 0),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'no_inventory_rate'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: '30天销量', 
      dataIndex: 'sales_30days', 
      key: 'sales_30days', 
      align: 'center',
      width: 100,
      sorter: (a, b) => (parseInt(a.sales_30days) || 0) - (parseInt(b.sales_30days) || 0),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'sales_30days'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: '供应商', 
      dataIndex: 'seller_name', 
      key: 'seller_name', 
      align: 'center',
      width: 120,
      sorter: (a, b) => (a.seller_name || '').localeCompare(b.seller_name || ''),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'seller_name'),
        style: { cursor: 'pointer' }
      })
    },
  ];

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    getCheckboxProps: (record: ProductRecord) => ({
      disabled: false,
      name: record.parent_sku,
    }),
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {/* 搜索区域 */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <TextArea
              rows={6}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="请输入parent_sku或weblink（每行一个，支持部分内容模糊查询）"
              style={{ width: 400 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Button type="primary" onClick={handleSearch} loading={loading}>
                搜索
              </Button>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={() => {
                  setInput('');
                  setData([]);
                  setSelectedRowKeys([]);
                }}
              >
                清空
              </Button>
            </div>
          </div>

          {/* 批量操作区域 */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span>批量操作：</span>
              
              {/* 状态批量更新 */}
              <Select
                placeholder="批量修改状态"
                style={{ width: 140 }}
                onSelect={(value) => handleBatchUpdateStatus(value)}
                disabled={selectedRowKeys.length === 0}
              >
                {statusOptions.map(status => (
                  <Option key={status} value={status}>{status}</Option>
                ))}
              </Select>

              {/* 批量打开链接 */}
              <Button 
                icon={<LinkOutlined />}
                onClick={handleBatchOpenLinks}
                disabled={selectedRowKeys.length === 0}
              >
                批量打开链接
              </Button>

              {/* 批量上传新品 */}
              <Button 
                icon={<UploadOutlined />}
                onClick={() => setUploadModalVisible(true)}
                loading={loading}
              >
                批量上传新品
              </Button>

              {/* SKU最新编号查询 */}
              <Button 
                icon={<SearchOutlined />}
                onClick={() => setSkuQueryModalVisible(true)}
              >
                SKU最新编号查询
              </Button>

              {/* 选择状态提示 */}
              {selectedRowKeys.length > 0 && (
                <span style={{ color: '#1890ff', marginLeft: '16px' }}>
                  已选择 {selectedRowKeys.length} 条记录
                </span>
              )}
            </div>

            {/* 批量删除 - 放在最右边 */}
            <Popconfirm
              title="确定要删除选中的记录吗？"
              onConfirm={handleBatchDelete}
              okText="确定"
              cancelText="取消"
              disabled={selectedRowKeys.length === 0}
            >
              <Button 
                danger
                icon={<DeleteOutlined />}
                disabled={selectedRowKeys.length === 0}
              >
                批量删除
              </Button>
            </Popconfirm>
          </div>
        </Space>
      </div>

      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
        scroll={{ x: 'max-content' }}
        bordered
        onChange={handleTableChange}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
          pageSize: 50,
          pageSizeOptions: ['20', '50', '100', '200'],
        }}
        title={() => (
          <div style={{ textAlign: 'left' }}>
            <span style={{ fontWeight: 'bold' }}>
              采购链接管理 
            </span>
            <span style={{ marginLeft: '16px', color: '#666', fontSize: '12px' }}>
              提示：双击单元格可编辑内容（除ID、时间字段外），点击列名可排序
            </span>
          </div>
        )}
      />

      {/* 编辑对话框 */}
      <Modal
        title="编辑字段"
        open={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingCell(null);
          editForm.resetFields();
        }}
        okText="保存"
        cancelText="取消"
        width={400}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            label={`编辑 ${editingCell?.field}`}
            name="value"
            rules={[{ required: false }]}
          >
            {editingCell?.field === 'status' ? (
              <Select placeholder="请选择状态">
                {statusOptions.map(status => (
                  <Option key={status} value={status}>{status}</Option>
                ))}
              </Select>
            ) : editingCell?.field === 'notice' ? (
              <TextArea rows={3} placeholder="请输入备注" />
            ) : editingCell?.field === 'weblink' ? (
              <Input placeholder="请输入产品链接" type="url" />
            ) : (
              <Input placeholder="请输入内容" />
            )}
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量上传新品对话框 */}
      <Modal
        title="批量上传新品"
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={null}
        width={500}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ marginBottom: '16px' }}>
            <Text strong>Excel表格要求：</Text>
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              <li>A列：SKU</li>
              <li>B列：产品链接</li>
              <li>C列：备注</li>
              <li>从第一行开始，无需表头</li>
            </ul>
          </div>
          
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              style={{ display: 'none' }}
            />
            <Button 
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => fileInputRef.current?.click()}
              loading={loading}
              block
            >
              选择Excel文件上传
            </Button>
          </div>
        </Space>
      </Modal>

      {/* SKU查询对话框 */}
      <Modal
        title="SKU最新编号查询"
        open={skuQueryModalVisible}
        onOk={handleSkuQuery}
        onCancel={() => {
          setSkuQueryModalVisible(false);
          setSkuPrefix('');
          setLatestSku('');
        }}
        okText="查询"
        cancelText="取消"
        width={400}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text>请输入SKU前缀：</Text>
            <Input
              value={skuPrefix}
              onChange={e => setSkuPrefix(e.target.value)}
              placeholder="例如：XBC"
              style={{ marginTop: '8px' }}
            />
          </div>
          
          {latestSku && (
            <div style={{ marginTop: '16px' }}>
              <Text strong>最新SKU：</Text>
              <div style={{ 
                padding: '8px 12px', 
                backgroundColor: '#f5f5f5', 
                borderRadius: '4px',
                marginTop: '8px',
                fontFamily: 'monospace',
                fontSize: '14px'
              }}>
                {latestSku}
              </div>
            </div>
          )}
        </Space>
      </Modal>
    </div>
  );
};

export default Purchase; 