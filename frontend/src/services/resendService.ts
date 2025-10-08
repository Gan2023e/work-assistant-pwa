import { apiClient } from '../config/api';

export interface ResendEmailResponse {
  success: boolean;
  message?: string;
  messageId?: string;
  error?: string;
}

export interface ProductStatusEmailData {
  action: string;
  parentSkus: string[];
}

export interface CustomEmailData {
  subject: string;
  content: string;
  htmlContent?: string;
}

export interface BulkEmailData {
  recipients: string[];
  subject: string;
  content: string;
  htmlContent?: string;
}

export interface AttachmentEmailData {
  subject: string;
  content: string;
  attachments?: Array<{
    filename: string;
    content: string; // Base64 编码
    contentType?: string;
  }>;
  htmlContent?: string;
}

class ResendService {
  private baseUrl = '/api/resend';

  /**
   * 发送产品状态邮件
   */
  async sendProductStatusEmail(data: ProductStatusEmailData): Promise<ResendEmailResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/product-status`, data);
      return response;
    } catch (error: any) {
      console.error('发送产品状态邮件失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '发送邮件失败'
      };
    }
  }

  /**
   * 发送自定义邮件
   */
  async sendCustomEmail(data: CustomEmailData): Promise<ResendEmailResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/custom`, data);
      return response;
    } catch (error: any) {
      console.error('发送自定义邮件失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '发送邮件失败'
      };
    }
  }

  /**
   * 发送批量邮件
   */
  async sendBulkEmail(data: BulkEmailData): Promise<ResendEmailResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/bulk`, data);
      return response;
    } catch (error: any) {
      console.error('发送批量邮件失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '发送邮件失败'
      };
    }
  }

  /**
   * 发送带附件的邮件
   */
  async sendEmailWithAttachments(data: AttachmentEmailData): Promise<ResendEmailResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/with-attachments`, data);
      return response;
    } catch (error: any) {
      console.error('发送带附件邮件失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '发送邮件失败'
      };
    }
  }

  /**
   * 测试 Resend 连接
   */
  async testConnection(): Promise<ResendEmailResponse> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/test`);
      return response;
    } catch (error: any) {
      console.error('Resend 连接测试失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '连接测试失败'
      };
    }
  }

  /**
   * 发送通知邮件（简化版本）
   */
  async sendNotification(subject: string, message: string): Promise<ResendEmailResponse> {
    return this.sendCustomEmail({
      subject,
      content: message,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0 0 10px 0;">${subject}</h2>
            <p style="color: #666; margin: 0;">时间: ${new Date().toLocaleString('zh-CN')}</p>
          </div>
          <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="white-space: pre-line;">${message}</div>
          </div>
        </div>
      `
    });
  }

  /**
   * 发送错误报告邮件
   */
  async sendErrorReport(error: Error, context?: string): Promise<ResendEmailResponse> {
    const subject = '系统错误报告';
    const content = `
错误信息: ${error.message}
错误堆栈: ${error.stack}
上下文: ${context || '无'}
时间: ${new Date().toLocaleString('zh-CN')}
用户代理: ${navigator.userAgent}
    `;

    return this.sendCustomEmail({
      subject,
      content,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #ffebee; padding: 20px; border-radius: 8px; border-left: 4px solid #f44336;">
            <h2 style="color: #c62828; margin: 0 0 10px 0;">🚨 系统错误报告</h2>
            <p style="color: #666; margin: 0;">时间: ${new Date().toLocaleString('zh-CN')}</p>
          </div>
          <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 20px;">
            <h3 style="color: #333; margin: 0 0 15px 0;">错误详情</h3>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 14px;">
              <div style="margin-bottom: 10px;"><strong>错误信息:</strong> ${error.message}</div>
              <div style="margin-bottom: 10px;"><strong>上下文:</strong> ${context || '无'}</div>
              <div style="margin-bottom: 10px;"><strong>用户代理:</strong> ${navigator.userAgent}</div>
              <div><strong>错误堆栈:</strong></div>
              <pre style="margin: 10px 0 0 0; white-space: pre-wrap; word-break: break-all;">${error.stack}</pre>
            </div>
          </div>
        </div>
      `
    });
  }
}

export const resendService = new ResendService();
export default resendService;
