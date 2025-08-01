import React, { useState, useRef, useEffect } from 'react';
import { 
  Button, 
  Modal, 
  Input, 
  message, 
  Space, 
  Typography,
  Spin,
  Popconfirm,
  Card,
  Progress,
  Alert
} from 'antd';
import { 
  ToolOutlined, 
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  ReloadOutlined,
  WifiOutlined
} from '@ant-design/icons';
import { API_BASE_URL } from '../config/api';

const { TextArea } = Input;
const { Text } = Typography;

interface ChildSkuGeneratorProps {
  onSuccess?: () => void;
}

interface TemplateFile {
  name: string;
  fileName: string;
  size: number;
  lastModified: string;
  url: string;
}

// 缓存配置
const CACHE_CONFIG = {
  TEMPLATE_CACHE_KEY: 'uk_template_cache',
  CACHE_DURATION: 5 * 60 * 1000, // 5分钟缓存
  MAX_RETRY_COUNT: 3,
  RETRY_DELAY: 1000, // 1秒
  REQUEST_TIMEOUT: 15000 // 15秒超时
};

// 缓存管理器
class TemplateCache {
  static set(data: TemplateFile | null) {
    const cacheData = {
      data,
      timestamp: Date.now(),
      version: '1.0'
    };
    try {
      localStorage.setItem(CACHE_CONFIG.TEMPLATE_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('缓存保存失败:', error);
    }
  }

  static get(): { data: TemplateFile | null; isValid: boolean; age: number } {
    try {
      const cached = localStorage.getItem(CACHE_CONFIG.TEMPLATE_CACHE_KEY);
      if (!cached) {
        return { data: null, isValid: false, age: 0 };
      }

      const cacheData = JSON.parse(cached);
      const age = Date.now() - cacheData.timestamp;
      const isValid = age < CACHE_CONFIG.CACHE_DURATION;

      return {
        data: cacheData.data,
        isValid,
        age
      };
    } catch (error) {
      console.warn('缓存读取失败:', error);
      return { data: null, isValid: false, age: 0 };
    }
  }

  static clear() {
    try {
      localStorage.removeItem(CACHE_CONFIG.TEMPLATE_CACHE_KEY);
    } catch (error) {
      console.warn('缓存清除失败:', error);
    }
  }

  static getAgeText(age: number): string {
    if (age < 60000) return '刚刚更新';
    if (age < 300000) return `${Math.floor(age / 60000)}分钟前更新`;
    return '需要刷新';
  }
}

// 网络请求工具
class NetworkUtil {
  static async fetchWithTimeout(url: string, options: RequestInit = {}, timeout = CACHE_CONFIG.REQUEST_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  static async fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = CACHE_CONFIG.MAX_RETRY_COUNT) {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 尝试请求 (${attempt}/${maxRetries}): ${url}`);
        const response = await this.fetchWithTimeout(url, options);
        
        if (response.ok) {
          console.log(`✅ 请求成功 (尝试 ${attempt})`);
          return response;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        lastError = error as Error;
        console.warn(`❌ 请求失败 (尝试 ${attempt}/${maxRetries}):`, error);

        if (attempt < maxRetries) {
          const delay = CACHE_CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1); // 指数退避
          console.log(`⏱️ ${delay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('网络请求失败');
  }

  static isOnline(): boolean {
    return navigator.onLine;
  }
}

const ChildSkuGenerator: React.FC<ChildSkuGeneratorProps> = ({ onSuccess }) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [skuInput, setSkuInput] = useState('');
  const [currentTemplate, setCurrentTemplate] = useState<TemplateFile | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [networkError, setNetworkError] = useState(false);
  const [cacheAge, setCacheAge] = useState(0);
  const [isUsingCache, setIsUsingCache] = useState(false);
  
  const templateFileInputRef = useRef<HTMLInputElement>(null);

  // 网络状态监听
  useEffect(() => {
    const handleOnline = () => {
      setNetworkError(false);
      console.log('🌐 网络已连接');
    };

    const handleOffline = () => {
      setNetworkError(true);
      console.log('📶 网络已断开');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 重置组件状态
  const resetState = () => {
    setSkuInput('');
    setUploadProgress(0);
    setUploadStatus('');
    setNetworkError(false);
    if (templateFileInputRef.current) {
      templateFileInputRef.current.value = '';
    }
  };

  // 优化的模板加载函数
  const loadCurrentTemplate = async (forceRefresh = false) => {
    setTemplateLoading(true);
    setNetworkError(false);

    try {
      // 1. 先检查缓存
      if (!forceRefresh) {
        const cache = TemplateCache.get();
        if (cache.isValid && cache.data !== undefined) {
          console.log('📋 使用缓存的模板数据', `(${TemplateCache.getAgeText(cache.age)})`);
          setCurrentTemplate(cache.data);
          setCacheAge(cache.age);
          setIsUsingCache(true);
          setTemplateLoading(false);

          // 后台静默更新缓存
          if (NetworkUtil.isOnline()) {
            loadTemplateFromNetwork(true);
          }
          return;
        }
      }

      // 2. 网络请求
      await loadTemplateFromNetwork(false);

    } catch (error) {
      console.error('🔥 模板加载失败:', error);
      
      // 3. 尝试使用过期缓存作为降级策略
      const cache = TemplateCache.get();
      if (cache.data !== undefined) {
        console.log('🔄 使用过期缓存作为降级策略');
        setCurrentTemplate(cache.data);
        setCacheAge(cache.age);
        setIsUsingCache(true);
        message.warning('使用缓存数据，建议检查网络后刷新');
      } else {
        setNetworkError(true);
        message.error('模板加载失败，请检查网络连接');
      }
    } finally {
      setTemplateLoading(false);
    }
  };

  // 从网络加载模板
  const loadTemplateFromNetwork = async (isSilent = false) => {
    try {
      if (!isSilent) {
        console.log('🌐 从网络加载模板...');
      }

      const response = await NetworkUtil.fetchWithRetry(`${API_BASE_URL}/api/product_weblink/uk-templates`);
      const result = await response.json();

      if (response.ok) {
        const templates = result.data || [];
        const templateData = templates.length > 0 ? templates[0] : null;
        
        // 更新状态和缓存
        setCurrentTemplate(templateData);
        TemplateCache.set(templateData);
        setCacheAge(0);
        setIsUsingCache(false);
        
        if (!isSilent) {
          console.log('✅ 模板加载成功');
        }
      } else {
        throw new Error(result.message || '获取模板失败');
      }
    } catch (error) {
      if (!isSilent) {
        throw error;
      }
      console.warn('⚠️ 后台更新失败:', error);
    }
  };

  // 手动刷新模板
  const handleRefreshTemplate = () => {
    if (!NetworkUtil.isOnline()) {
      message.error('网络未连接，无法刷新');
      return;
    }
    
    console.log('🔄 手动刷新模板');
    TemplateCache.clear();
    loadCurrentTemplate(true);
  };

  // 上传模板文件
  const handleTemplateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('📁 选择的文件:', file.name, '大小:', (file.size / 1024).toFixed(1), 'KB');

    // 文件大小检查
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      message.error(`文件过大，请选择小于 ${MAX_FILE_SIZE / 1024 / 1024}MB 的文件`);
      return;
    }

    // 验证文件类型
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.ms-excel.sheet.macroEnabled.12'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
      message.error('请选择有效的Excel文件（.xlsx、.xls或.xlsm格式）');
      return;
    }

    setUploadLoading(true);
    setUploadProgress(0);
    setUploadStatus('准备上传...');
    
    try {
      // 如果存在当前模板，先删除OSS中的原文件
      if (currentTemplate) {
        setUploadStatus('删除旧模板文件...');
        try {
          const deleteResponse = await fetch(`${API_BASE_URL}/api/product_weblink/uk-template/${currentTemplate.name}`, {
            method: 'DELETE',
          });

          if (!deleteResponse.ok) {
            const deleteResult = await deleteResponse.json();
            console.warn('删除原模板文件失败:', deleteResult.message);
            // 继续上传，不阻断流程
          } else {
            console.log('✅ 原模板文件已从OSS删除');
          }
        } catch (deleteError) {
          console.warn('删除原模板文件时出错:', deleteError);
          // 继续上传，不阻断流程
        }
      }

      setUploadStatus(`正在上传文件 (${(file.size / 1024).toFixed(1)} KB)...`);
      setUploadProgress(10);

      // 创建XMLHttpRequest来支持进度跟踪
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      
      // 修复：显式设置文件名以确保正确的UTF-8编码
      const encodedFileName = encodeURIComponent(file.name);
      console.log('🔤 原始文件名:', file.name);
      console.log('🔤 编码后文件名:', encodedFileName);
      
      // 创建带有正确文件名的新File对象
      const renamedFile = new File([file], file.name, {
        type: file.type,
        lastModified: file.lastModified,
      });
      
      formData.append('template', renamedFile, file.name);
      
      // 同时添加显式的文件名参数确保后端能正确获取
      formData.append('originalFileName', file.name);

      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(Math.max(10, percentComplete)); // 确保至少显示10%
            setUploadStatus(`上传中... ${percentComplete}%`);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            try {
              const result = JSON.parse(xhr.responseText);
              resolve(result);
            } catch (e) {
              reject(new Error('响应解析失败'));
            }
          } else {
            try {
              const errorResult = JSON.parse(xhr.responseText);
              reject(new Error(errorResult.message || `HTTP ${xhr.status} 错误`));
            } catch (e) {
              reject(new Error(`HTTP ${xhr.status} 错误`));
            }
          }
        };

        xhr.onerror = () => {
          reject(new Error('网络连接失败'));
        };

        xhr.ontimeout = () => {
          reject(new Error('上传超时'));
        };

        xhr.timeout = 120000; // 2分钟超时
        xhr.open('POST', `${API_BASE_URL}/api/product_weblink/upload-uk-template`);
        xhr.send(formData);
      });

      const result = await uploadPromise;
      
      setUploadProgress(100);
      setUploadStatus('上传完成！');

      if (result.data?.processingTime) {
        console.log(`📊 上传性能: ${result.data.processingTime}ms`);
      }

      message.success('模板文件上传成功');
      
      // 清除缓存并重新加载
      TemplateCache.clear();
      loadCurrentTemplate(true); // 强制刷新
      
      if (templateFileInputRef.current) {
        templateFileInputRef.current.value = '';
      }

      // 延迟重置状态以显示完成状态
      setTimeout(() => {
        setUploadProgress(0);
        setUploadStatus('');
      }, 2000);

    } catch (error) {
      console.error('上传模板文件失败:', error);
      setUploadProgress(0);
      setUploadStatus('');
      
      const errorMessage = error instanceof Error ? error.message : '上传失败';
      message.error(errorMessage);
    } finally {
      setUploadLoading(false);
    }
  };

  // 下载模板文件
  const handleTemplateDownload = async () => {
    if (!currentTemplate) {
      message.warning('没有可下载的模板文件');
      return;
    }

    if (!NetworkUtil.isOnline()) {
      message.error('网络未连接，无法下载');
      return;
    }

    try {
      message.loading('正在下载模板文件...', 0);
      
      const response = await NetworkUtil.fetchWithRetry(
        `${API_BASE_URL}/api/product_weblink/uk-template/download/${currentTemplate.name}`,
        { method: 'GET' }
      );

      message.destroy();

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = currentTemplate.fileName;
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
        message.success('模板文件下载成功');
      } else {
        const errorData = await response.json();
        message.error(errorData.message || '下载失败');
      }
    } catch (error) {
      message.destroy();
      console.error('下载模板文件失败:', error);
      const errorMessage = error instanceof Error ? error.message : '下载失败';
      if (errorMessage.includes('timeout') || errorMessage.includes('网络')) {
        message.error('网络超时，请检查网络连接后重试');
      } else {
        message.error('下载失败，请稍后重试');
      }
    }
  };

  // 删除模板文件
  const handleTemplateDelete = async () => {
    if (!currentTemplate) {
      message.warning('没有可删除的模板文件');
      return;
    }

    // 显示确认对话框
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除模板文件 "${currentTemplate.fileName}" 吗？删除后无法恢复。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          console.log('🗑️ 准备删除模板:', {
            fileName: currentTemplate.fileName,
            ossPath: currentTemplate.name,
            size: currentTemplate.size
          });

          const response = await NetworkUtil.fetchWithRetry(
            `${API_BASE_URL}/api/product_weblink/uk-template/${encodeURIComponent(currentTemplate.name)}`,
            { method: 'DELETE' }
          );

          const result = await response.json();

          if (response.ok) {
            console.log('✅ 模板删除成功:', result);
            message.success('模板文件删除成功');
            
            // 清除缓存和当前模板
            TemplateCache.clear();
            setCurrentTemplate(null);
            setCacheAge(0);
            setIsUsingCache(false);
            
            // 重新加载模板列表以确保界面同步
            loadCurrentTemplate(true);
          } else {
            console.error('❌ 模板删除失败:', result);
            message.error(result.message || '删除失败');
          }
        } catch (error) {
          console.error('❌ 删除模板文件失败:', error);
          message.error('删除失败: ' + (error instanceof Error ? error.message : '网络错误'));
        }
      }
    });
  };

  // 验证输入数据
  const validateInput = (): boolean => {
    if (!skuInput.trim()) {
      message.warning('请输入需要整理的SKU');
      return false;
    }

    if (!currentTemplate) {
      message.warning('请先上传英国资料表模板');
      return false;
    }

    // 验证SKU格式（基本验证）
    const skuList = skuInput
      .split('\n')
      .map(sku => sku.trim())
      .filter(Boolean);

    if (skuList.length === 0) {
      message.warning('请输入有效的SKU');
      return false;
    }

    return true;
  };

  // 处理文件下载
  const downloadFile = (blob: Blob, originalFileName: string, response?: Response) => {
    // 从响应头获取正确的文件扩展名
    let extension = '.xlsx'; // 默认扩展名
    
    if (response) {
      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition) {
        // 从Content-Disposition中提取文件扩展名
        const filenameMatch = contentDisposition.match(/filename\*?=[^;]*\.([^.;\s]+)/);
        if (filenameMatch && filenameMatch[1]) {
          extension = '.' + filenameMatch[1];
        }
      }
    }
    
    // 如果无法从响应头获取，则从原文件名提取
    if (extension === '.xlsx') {
      const lastDotIndex = originalFileName.lastIndexOf('.');
      if (lastDotIndex > 0) {
        extension = originalFileName.substring(lastDotIndex);
      }
    }
    
    // 从原文件名提取名称（无扩展名）
    const lastDotIndex = originalFileName.lastIndexOf('.');
    const nameWithoutExt = lastDotIndex > 0 ? originalFileName.substring(0, lastDotIndex) : originalFileName;
    
    // 生成时间戳
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
    
    // 构建新文件名：原名称_时间戳.正确扩展名
    const newFileName = `${nameWithoutExt}_${timestamp}${extension}`;
    
    console.log(`📁 下载文件: ${newFileName} (扩展名: ${extension})`);
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = newFileName;
    document.body.appendChild(link);
    link.click();
    
    // 清理
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  };

  // 显示详细错误对话框
  const showErrorDialog = (error: string, details?: string) => {
    Modal.error({
      title: '处理失败',
      content: (
        <div>
          <p style={{ marginBottom: '12px', fontWeight: 'bold', color: '#ff4d4f' }}>
            {error}
          </p>
          {details && (
            <div>
              <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>详细信息：</p>
              <div style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '8px 12px', 
                borderRadius: '4px',
                border: '1px solid #d9d9d9',
                maxHeight: '200px',
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: '12px',
                whiteSpace: 'pre-wrap'
              }}>
                {details}
              </div>
            </div>
          )}
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
            <p>可能的解决方案：</p>
            <ul style={{ marginLeft: '16px' }}>
              <li>检查输入的SKU是否存在于数据库中</li>
              <li>确认模板文件格式正确（包含Template工作表）</li>
              <li>验证网络连接是否正常</li>
              <li>联系管理员检查服务器状态</li>
            </ul>
          </div>
        </div>
      ),
      width: 500
    });
  };

  // 主要处理函数
  const handleProcess = async () => {
    if (!validateInput()) {
      return;
    }

    setLoading(true);
    
    // 设置请求超时控制器
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 180000); // 3分钟超时
    
    try {
      // 显示处理开始提示
      message.loading('正在处理子SKU生成请求...', 0);
      
      console.log('🚀 开始子SKU生成处理');
      
      const response = await fetch(`${API_BASE_URL}/api/product_weblink/child-sku-generator-from-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parentSkus: skuInput.trim(),
          templateObjectName: currentTemplate!.name
        }),
        signal: controller.signal // 添加取消信号
      });

      // 清除超时计时器
      clearTimeout(timeoutId);
      
      // 关闭loading提示
      message.destroy();

      if (!response.ok) {
        let errorMessage = `请求失败 (HTTP ${response.status})`;
        let errorDetails = '';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          
          // 添加更多错误详情
          if (response.status === 500) {
            errorDetails = `服务器内部错误\n状态码: ${response.status}\n错误信息: ${errorData.message || '未知错误'}\n处理时间: ${errorData.processingTime || '未知'}ms\n时间戳: ${errorData.timestamp || '未知'}`;
          } else if (response.status === 408) {
            errorDetails = `处理超时\n状态码: ${response.status}\n建议: 减少SKU数量或稍后重试\n处理时间: ${errorData.processingTime || '未知'}ms`;
          } else if (response.status === 404) {
            errorDetails = `资源未找到\n状态码: ${response.status}\n可能原因: 模板文件不存在或SKU数据未找到\n详情: ${errorData.details || '无'}`;
          } else if (response.status === 400) {
            errorDetails = `请求参数错误\n状态码: ${response.status}\n错误信息: ${errorData.message || '请检查输入的SKU和模板文件'}\n错误代码: ${errorData.errorCode || '未知'}`;
          } else if (response.status === 503) {
            errorDetails = `服务不可用\n状态码: ${response.status}\n建议: 服务器正忙，请稍后重试`;
          } else {
            errorDetails = `HTTP错误\n状态码: ${response.status}\n状态文本: ${response.statusText}\n处理时间: ${errorData.processingTime || '未知'}ms`;
          }
        } catch (parseError) {
          // 如果无法解析JSON响应
          errorDetails = `无法解析服务器响应\n状态码: ${response.status}\n状态文本: ${response.statusText}\n响应类型: ${response.headers.get('content-type') || '未知'}`;
        }
        
        showErrorDialog(errorMessage, errorDetails);
        return;
      }

      console.log('📥 开始下载生成的文件');
      message.loading('正在准备下载文件...', 0);

      // 处理文件下载
      const blob = await response.blob();
      
      message.destroy();
      
      if (blob.size === 0) {
        showErrorDialog(
          '返回的文件为空', 
          '可能的原因：\n1. 输入的SKU在数据库中不存在\n2. 数据库查询未返回任何结果\n3. Excel处理过程中出现错误\n4. 服务器内存不足\n\n建议：\n1. 检查SKU是否正确\n2. 减少一次处理的SKU数量\n3. 稍后重试'
        );
        return;
      }

      console.log(`📁 文件大小: ${(blob.size / 1024).toFixed(1)} KB`);
      
      // 获取处理时间信息
      const processingTime = response.headers.get('X-Processing-Time');
      if (processingTime) {
        console.log(`📊 服务器处理时间: ${processingTime}ms`);
      }
      
      // 使用模板文件名+时间戳，传递response对象以获取正确的文件扩展名
      downloadFile(blob, currentTemplate!.fileName, response);
      
      message.success(`子SKU生成器处理完成，文件已下载${processingTime ? ` (处理时间: ${processingTime}ms)` : ''}`);
      
      // 成功后关闭弹窗并重置状态
      setVisible(false);
      resetState();
      
      // 调用成功回调
      onSuccess?.();
      
    } catch (error) {
      // 清除超时计时器
      clearTimeout(timeoutId);
      message.destroy();
      
      console.error('子SKU生成器失败:', error);
      
      // 检查是否是取消操作
      if (error instanceof Error && error.name === 'AbortError') {
        showErrorDialog(
          '操作已超时', 
          '处理时间超过3分钟，操作已被取消。\n\n可能原因：\n1. SKU数量过多\n2. 数据库查询耗时过长\n3. 网络连接不稳定\n4. 服务器负载过高\n\n建议：\n1. 减少一次处理的SKU数量（建议不超过20个）\n2. 检查网络连接\n3. 稍后重试\n4. 联系管理员检查服务器状态'
        );
        return;
      }
      
      // 显示详细错误对话框
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      let errorDetails = `错误类型: ${error instanceof Error ? error.name : 'Unknown'}\n错误信息: ${errorMessage}\n发生时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
      
      // 根据错误类型提供具体建议
      if (errorMessage.includes('fetch')) {
        errorDetails += '网络连接问题：\n1. 检查网络连接是否正常\n2. 确认服务器地址正确\n3. 检查防火墙设置\n4. 稍后重试';
      } else if (errorMessage.includes('timeout')) {
        errorDetails += '请求超时：\n1. 减少一次处理的SKU数量\n2. 检查网络连接速度\n3. 稍后重试';
      } else {
        errorDetails += '请检查：\n1. 网络连接和输入数据的正确性\n2. SKU格式是否正确\n3. 模板文件是否完整\n4. 联系管理员获取技术支持';
      }
      
      showErrorDialog('处理过程中发生错误', errorDetails);
    } finally {
      setLoading(false);
    }
  };

  // 打开弹窗
  const handleOpen = () => {
    setVisible(true);
    loadCurrentTemplate(false); // 优先使用缓存，后台更新
  };

  // 关闭弹窗
  const handleCancel = () => {
    if (loading || uploadLoading) {
      message.warning('正在处理中，请稍候...');
      return;
    }
    
    setVisible(false);
    resetState();
  };

  return (
    <>
      {/* 触发按钮 */}
      <Button 
        icon={<ToolOutlined />}
        onClick={handleOpen}
        type="default"
      >
        子SKU生成器
      </Button>

      {/* 主弹窗 */}
      <Modal
        title="子SKU生成器"
        open={visible}
        onCancel={handleCancel}
        footer={null}
        width={700}
        destroyOnClose
        maskClosable={!loading && !uploadLoading}
      >
        <Spin spinning={loading} tip={
          loading ? "正在生成子SKU，请耐心等待..." : "正在处理，请稍候..."
        }>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            
            {/* SKU输入区域 */}
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                输入需要整理的SKU：
              </Text>
              <TextArea
                rows={6}
                value={skuInput}
                onChange={(e) => setSkuInput(e.target.value)}
                placeholder="请输入需要整理的母SKU，一行一个&#10;例如：&#10;ABC001&#10;DEF002&#10;GHI003"
                style={{ fontFamily: 'monospace' }}
                disabled={loading}
              />
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 16 }}>
                支持多个SKU，每行输入一个
              </Text>
              
              {/* 操作按钮 */}
              <Space style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}>
                <Button onClick={handleCancel} disabled={loading}>
                  取消
                </Button>
                <Button 
                  type="primary" 
                  onClick={handleProcess}
                  loading={loading}
                >
                  开始处理
                </Button>
              </Space>
            </div>

            {/* 管理英国资料表模板区域 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text strong>
                  管理英国资料表模板：
                </Text>
                <Space>
                  {/* 网络状态指示器 */}
                  {networkError ? (
                    <Text type="danger" style={{ fontSize: '12px' }}>
                      <WifiOutlined /> 网络异常
                    </Text>
                  ) : (
                    <Text type="success" style={{ fontSize: '12px' }}>
                      <WifiOutlined /> 网络正常
                    </Text>
                  )}
                  
                  {/* 刷新按钮 */}
                  <Button
                    type="text"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={handleRefreshTemplate}
                    disabled={templateLoading || !NetworkUtil.isOnline()}
                    title="刷新模板信息"
                  >
                    刷新
                  </Button>
                </Space>
              </div>

              {/* 缓存状态提示 */}
              {isUsingCache && (
                <Alert
                  message={`使用缓存数据 (${TemplateCache.getAgeText(cacheAge)})`}
                  type="info"
                  showIcon
                  style={{ marginBottom: 8, fontSize: '12px' }}
                  action={
                    <Button size="small" type="link" onClick={handleRefreshTemplate}>
                      更新
                    </Button>
                  }
                />
              )}

              {/* 网络错误提示 */}
              {networkError && !currentTemplate && (
                <Alert
                  message="网络连接异常"
                  description="无法加载模板信息，请检查网络连接后刷新重试"
                  type="error"
                  showIcon
                  style={{ marginBottom: 12 }}
                  action={
                    <Button size="small" onClick={handleRefreshTemplate} disabled={!NetworkUtil.isOnline()}>
                      重试
                    </Button>
                  }
                />
              )}
              
              <Spin spinning={templateLoading} tip="正在加载模板信息...">
                {currentTemplate ? (
                  // 显示当前模板
                  <Card
                    size="small"
                    style={{ marginBottom: 12 }}
                  >
                    <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <FileExcelOutlined style={{ color: '#52c41a', fontSize: '20px' }} />
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{currentTemplate.fileName}</div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            {(currentTemplate.size / 1024).toFixed(1)} KB • {new Date(currentTemplate.lastModified).toLocaleString('zh-CN')}
                            {isUsingCache && (
                              <Text type="secondary" style={{ marginLeft: 8 }}>
                                (缓存)
                              </Text>
                            )}
                          </div>
                        </div>
                      </Space>
                      <Space>
                        <Button
                          type="link"
                          icon={<DownloadOutlined />}
                          onClick={handleTemplateDownload}
                          size="small"
                          disabled={loading || networkError}
                        >
                          下载
                        </Button>
                        <Popconfirm
                          title="确定要删除这个模板文件吗？删除后将同步从阿里云OSS中移除。"
                          onConfirm={handleTemplateDelete}
                          okText="确定"
                          cancelText="取消"
                          disabled={loading || networkError}
                        >
                          <Button
                            type="link"
                            danger
                            icon={<DeleteOutlined />}
                            size="small"
                            disabled={loading || networkError}
                          >
                            删除
                          </Button>
                        </Popconfirm>
                      </Space>
                    </Space>
                  </Card>
                ) : (
                  // 显示上传区域
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '20px', 
                    border: '2px dashed #d9d9d9',
                    borderRadius: '6px',
                    marginBottom: 12
                  }}>
                    <FileExcelOutlined style={{ fontSize: '32px', color: '#d9d9d9', marginBottom: 8 }} />
                    <div style={{ color: '#999', marginBottom: 12 }}>
                      {networkError ? '网络异常，无法加载模板信息' : '暂未上传英国资料表模板'}
                    </div>
                  </div>
                )}
              </Spin>

              {/* 上传按钮 */}
              <input
                ref={templateFileInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={handleTemplateUpload}
                style={{ display: 'none' }}
                disabled={uploadLoading || loading}
              />
              
              <Button 
                icon={<UploadOutlined />}
                onClick={() => templateFileInputRef.current?.click()}
                loading={uploadLoading}
                block
                style={{ marginBottom: 8 }}
                disabled={loading}
              >
                {currentTemplate ? '重新上传模板文件' : '上传Excel模板文件'}
              </Button>

              {/* 上传进度显示 */}
              {uploadLoading && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 4 }}>
                    <Text style={{ fontSize: '12px', color: '#666' }}>
                      {uploadStatus}
                    </Text>
                  </div>
                  <Progress 
                    percent={uploadProgress} 
                    size="small" 
                    status={uploadProgress === 100 ? 'success' : 'active'}
                    strokeColor={{
                      '0%': '#87d068',
                      '100%': '#52c41a',
                    }}
                  />
                </div>
              )}
              
              <Text type="secondary" style={{ fontSize: '12px' }}>
                • 支持.xlsx、.xls和.xlsm格式的Excel文件<br />
                • 模板将上传到阿里云OSS的"templates/excel/amazon/UK/"文件夹<br />
                • 模板必须包含名为"Template"的工作表，第3行必须包含：item_sku、color_name、size_name列<br />
                • 文件大小限制：50MB以内<br />
                • <strong>🚀 新特性：智能缓存，上传后立即可用，无需重复下载</strong><br />
                • <strong>🌐 网络优化：支持断点重试，弱网络环境下更稳定</strong>
              </Text>
            </div>

            {/* 处理中状态提示 */}
            {loading && (
              <div style={{ 
                backgroundColor: '#e6f7ff', 
                padding: '16px', 
                borderRadius: '6px',
                border: '1px solid #91d5ff',
                textAlign: 'center'
              }}>
                <Text style={{ color: '#1890ff' }}>
                  <strong>正在处理中，请耐心等待...</strong><br />
                  • 正在下载并解析模板文件<br />
                  • 正在查询数据库中的子SKU信息<br />
                  • 正在生成包含子SKU数据的Excel文件<br />
                  • 处理完成后将自动下载文件
                </Text>
              </div>
            )}



          </Space>
        </Spin>
      </Modal>
    </>
  );
};

export default ChildSkuGenerator; 