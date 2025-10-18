interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface TaskProgressMessage extends WebSocketMessage {
  type: 'taskProgress';
  taskId: string;
  progress: number;
  message: string;
  timestamp: string;
}

interface TaskCompletedMessage extends WebSocketMessage {
  type: 'taskCompleted';
  taskId: string;
  result: any;
  timestamp: string;
}

interface TaskFailedMessage extends WebSocketMessage {
  type: 'taskFailed';
  taskId: string;
  error: string;
  timestamp: string;
}

interface ConnectedMessage extends WebSocketMessage {
  type: 'connected';
  clientId: string;
  userId: string;
  timestamp: string;
}

type WebSocketEventHandler = (message: any) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000; // 3秒
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private eventHandlers = new Map<string, WebSocketEventHandler[]>();
  private isConnecting = false;

  constructor(private userId: string = 'anonymous') {}

  // 连接WebSocket
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        // 如果正在连接，等待连接完成
        const checkConnection = () => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            resolve();
          } else if (!this.isConnecting) {
            reject(new Error('连接失败'));
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
        return;
      }

      this.isConnecting = true;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?userId=${this.userId}`;

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('🔌 WebSocket连接已建立');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ WebSocket消息解析失败:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket连接已关闭:', event.code, event.reason);
          this.isConnecting = false;
          this.stopHeartbeat();
          
          if (event.code !== 1000) { // 非正常关闭
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket连接错误:', error);
          this.isConnecting = false;
          reject(error);
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  // 断开连接
  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, '主动断开连接');
      this.ws = null;
    }
  }

  // 发送消息
  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ WebSocket未连接，无法发送消息');
    }
  }

  // 发送ping消息
  ping() {
    this.send({ type: 'ping', timestamp: new Date().toISOString() });
  }

  // 开始心跳
  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.ping();
    }, 30000); // 30秒心跳
  }

  // 停止心跳
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // 安排重连
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ WebSocket重连次数已达上限，停止重连');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1); // 指数退避
    
    console.log(`🔄 ${delay}ms后尝试重连WebSocket (第${this.reconnectAttempts}次)`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('❌ WebSocket重连失败:', error);
      });
    }, delay);
  }

  // 处理消息
  private handleMessage(message: WebSocketMessage) {
    const handlers = this.eventHandlers.get(message.type) || [];
    handlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error(`❌ 处理WebSocket消息失败 (${message.type}):`, error);
      }
    });
  }

  // 添加事件监听器
  on(eventType: string, handler: WebSocketEventHandler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  // 移除事件监听器
  off(eventType: string, handler: WebSocketEventHandler) {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // 监听任务进度
  onTaskProgress(handler: (message: TaskProgressMessage) => void) {
    this.on('taskProgress', handler as WebSocketEventHandler);
  }

  // 监听任务完成
  onTaskCompleted(handler: (message: TaskCompletedMessage) => void) {
    this.on('taskCompleted', handler as WebSocketEventHandler);
  }

  // 监听任务失败
  onTaskFailed(handler: (message: TaskFailedMessage) => void) {
    this.on('taskFailed', handler as WebSocketEventHandler);
  }

  // 监听连接状态
  onConnected(handler: (message: ConnectedMessage) => void) {
    this.on('connected', handler as WebSocketEventHandler);
  }

  // 获取连接状态
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // 获取重连次数
  get reconnectCount(): number {
    return this.reconnectAttempts;
  }
}

// 创建全局WebSocket管理器实例
let wsManagerInstance: WebSocketManager | null = null;

export const getWebSocketManager = (userId?: string): WebSocketManager => {
  if (!wsManagerInstance) {
    wsManagerInstance = new WebSocketManager(userId);
  }
  return wsManagerInstance;
};

export default WebSocketManager;
