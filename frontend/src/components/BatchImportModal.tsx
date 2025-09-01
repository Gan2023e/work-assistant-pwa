import React, { useState } from 'react';
import { Modal, Upload, Button, message, Table, Tag, Alert, Space } from 'antd';
import { UploadOutlined, FileExcelOutlined, DeleteOutlined } from '@ant-design/icons';
import { RcFile } from 'antd/lib/upload';
import * as XLSX from 'xlsx';
import { BatchMappingData } from '../types/listings';

interface BatchImportModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (mappings: BatchMappingData[]) => Promise<void>;
  siteList: string[];
}

const BatchImportModal: React.FC<BatchImportModalProps> = ({
  visible,
  onCancel,
  onConfirm,
  siteList
}) => {
  const [mappings, setMappings] = useState<BatchMappingData[]>([]);
  const [loading, setLoading] = useState(false);

  // 处理文件上传
  const handleFileUpload = (file: RcFile) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (!['xlsx', 'xls', 'csv'].includes(fileExtension || '')) {
      message.error('请上传 Excel 或 CSV 文件');
      return false;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let data: any[] = [];
        
        if (fileExtension === 'csv') {
          // 处理CSV文件
          const text = e.target?.result as string;
          const lines = text.split('\n');
          const headers = lines[0].split(',').map(h => h.trim());
          
          for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
              const values = lines[i].split(',').map(v => v.trim());
              const row: any = {};
              headers.forEach((header, index) => {
                row[header] = values[index] || '';
              });
              data.push(row);
            }
          }
        } else {
          // 处理Excel文件
          const workbook = XLSX.read(e.target?.result, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          data = XLSX.utils.sheet_to_json(worksheet);
        }

        // 转换数据格式
        const parsedMappings: BatchMappingData[] = data
          .filter(row => row.local_sku && row.amz_sku && row.site && row.country)
          .map(row => ({
            local_sku: String(row.local_sku || row['本地SKU'] || row['Local SKU']).trim(),
            amz_sku: String(row.amz_sku || row['Amazon SKU'] || row['ASIN']).trim(),
            site: String(row.site || row['站点'] || row['Site']).trim(),
            country: String(row.country || row['国家'] || row['Country']).trim(),
            sku_type: String(row.sku_type || row['SKU类型'] || row['Type'] || 'FBA SKU').trim()
          }));

        if (parsedMappings.length === 0) {
          message.error('文件中没有找到有效的映射数据，请检查文件格式');
          return;
        }

        setMappings(parsedMappings);
        message.success(`成功解析 ${parsedMappings.length} 条映射记录`);
      } catch (error) {
        console.error('文件解析失败:', error);
        message.error('文件解析失败，请检查文件格式');
      }
    };

    if (fileExtension === 'csv') {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsBinaryString(file);
    }

    return false; // 阻止自动上传
  };

  // 删除映射记录
  const handleDeleteMapping = (index: number) => {
    const newMappings = [...mappings];
    newMappings.splice(index, 1);
    setMappings(newMappings);
  };

  // 确认导入
  const handleConfirm = async () => {
    if (mappings.length === 0) {
      message.error('请先上传文件');
      return;
    }

    setLoading(true);
    try {
      await onConfirm(mappings);
      setMappings([]);
    } finally {
      setLoading(false);
    }
  };

  // 下载模板文件
  const downloadTemplate = () => {
    const templateData = [
      {
        'local_sku': 'SKU001-001',
        'amz_sku': 'B08XXXXX01',
        'site': 'Amazon.com',
        'country': '美国',
        'sku_type': 'FBA SKU'
      },
      {
        'local_sku': 'SKU001-002', 
        'amz_sku': 'B08XXXXX02',
        'site': 'Amazon.co.uk',
        'country': '英国',
        'sku_type': 'FBA SKU'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SKU映射模板');
    XLSX.writeFile(workbook, 'sku_mapping_template.xlsx');
  };

  // 表格列配置
  const columns = [
    {
      title: '本地SKU',
      dataIndex: 'local_sku',
      key: 'local_sku',
      width: 150,
    },
    {
      title: 'Amazon SKU',
      dataIndex: 'amz_sku',
      key: 'amz_sku',
      width: 150,
    },
    {
      title: '站点',
      dataIndex: 'site',
      key: 'site',
      width: 120,
      render: (site: string) => (
        <Tag color={siteList.includes(site) ? 'blue' : 'red'}>
          {site}
        </Tag>
      ),
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 100,
    },
    {
      title: 'SKU类型',
      dataIndex: 'sku_type',
      key: 'sku_type',
      width: 100,
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: any, __: any, index: number) => (
        <Button
          type="text"
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteMapping(index)}
          danger
        />
      ),
    },
  ];

  return (
    <Modal
      title="批量导入SKU映射"
      open={visible}
      onCancel={() => {
        onCancel();
        setMappings([]);
      }}
      width={1000}
      footer={[
        <Button key="template" icon={<FileExcelOutlined />} onClick={downloadTemplate}>
          下载模板
        </Button>,
        <Button key="cancel" onClick={() => {
          onCancel();
          setMappings([]);
        }}>
          取消
        </Button>,
        <Button
          key="confirm"
          type="primary"
          loading={loading}
          onClick={handleConfirm}
          disabled={mappings.length === 0}
        >
          确认导入 ({mappings.length}条)
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Alert
          message="导入说明"
          description={
            <div>
              <p>1. 支持上传 Excel(.xlsx, .xls) 或 CSV 文件</p>
              <p>2. 文件必须包含以下列：local_sku（本地SKU）、amz_sku（Amazon SKU）、site（站点）、country（国家）</p>
              <p>3. 可选列：sku_type（SKU类型，默认为FBA SKU）</p>
              <p>4. 建议先下载模板文件，按照模板格式填写数据</p>
            </div>
          }
          type="info"
          showIcon
        />

        <Upload
          beforeUpload={handleFileUpload}
          showUploadList={false}
          accept=".xlsx,.xls,.csv"
        >
          <Button icon={<UploadOutlined />} size="large" block>
            选择文件上传
          </Button>
        </Upload>

        {mappings.length > 0 && (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>解析结果 ({mappings.length} 条记录)</h3>
              <Button onClick={() => setMappings([])} danger>
                清空数据
              </Button>
            </div>
            
            <Table
              columns={columns}
              dataSource={mappings}
              rowKey={(record, index) => `${record.local_sku}-${record.amz_sku}-${index}`}
              pagination={{ pageSize: 10 }}
              scroll={{ y: 300 }}
              size="small"
            />
          </div>
        )}
      </Space>
    </Modal>
  );
};

export default BatchImportModal; 