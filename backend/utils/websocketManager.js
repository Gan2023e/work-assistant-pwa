const WebSocket = require('ws');

class WebSocketManager {
  constructor() {
    this.clients = new Map(); // 存储客户端连接
    this.rooms = new Map(); // 存储房间（按用户ID分组）
  }

  // 添加客户端连接
  addClient(ws, userId) {
    const clientId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.clients.set(clientId, {
      ws,
      userId,
      connectedAt: new Date(),
      lastPing: new Date()
    });

    // 如果用户还没有房间，创建一个
    if (!this.rooms.has(userId)) {
      this.rooms.set(userId, new Set());
    }
    this.rooms.get(userId).add(clientId);

    // 设置心跳检测
    this.setupHeartbeat(clientId);

    console.log(`客户端 ${clientId} 已连接 (用户: ${userId})`);
    return clientId;
  }

  // 移除客户端连接
  removeClient(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      const { userId } = client;
      
      // 从房间中移除
      if (this.rooms.has(userId)) {
        this.rooms.get(userId).delete(clientId);
        if (this.rooms.get(userId).size === 0) {
          this.rooms.delete(userId);
        }
      }

      this.clients.delete(clientId);
      console.log(`客户端 ${clientId} 已断开连接`);
    }
  }

  // 设置心跳检测
  setupHeartbeat(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const heartbeat = setInterval(() => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping();
        client.lastPing = new Date();
      } else {
        clearInterval(heartbeat);
        this.removeClient(clientId);
      }
    }, 30000); // 30秒心跳

    // 监听pong响应
    client.ws.on('pong', () => {
      client.lastPing = new Date();
    });
  }

  // 向特定用户发送消息
  sendToUser(userId, message) {
    const userClients = this.rooms.get(userId);
    if (userClients) {
      const messageStr = JSON.stringify(message);
      let sentCount = 0;
      
      userClients.forEach(clientId => {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.send(messageStr);
            sentCount++;
          } catch (error) {
            console.error(`发送消息到客户端 ${clientId} 失败:`, error);
            this.removeClient(clientId);
          }
        }
      });

      console.log(`向用户 ${userId} 发送消息，成功发送到 ${sentCount} 个客户端`);
    }
  }

  // 向所有客户端广播消息
  broadcast(message) {
    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(messageStr);
          sentCount++;
        } catch (error) {
          console.error(`广播消息到客户端 ${clientId} 失败:`, error);
          this.removeClient(clientId);
        }
      }
    });

    console.log(`广播消息，成功发送到 ${sentCount} 个客户端`);
  }

  // 发送任务进度更新
  sendTaskProgress(userId, taskId, progress, message) {
    this.sendToUser(userId, {
      type: 'taskProgress',
      taskId,
      progress,
      message,
      timestamp: new Date().toISOString()
    });
  }

  // 发送任务完成通知
  sendTaskCompleted(userId, taskId, result) {
    this.sendToUser(userId, {
      type: 'taskCompleted',
      taskId,
      result,
      timestamp: new Date().toISOString()
    });
  }

  // 发送任务失败通知
  sendTaskFailed(userId, taskId, error) {
    this.sendToUser(userId, {
      type: 'taskFailed',
      taskId,
      error,
      timestamp: new Date().toISOString()
    });
  }

  // 获取连接统计
  getStats() {
    return {
      totalClients: this.clients.size,
      totalUsers: this.rooms.size,
      clientsByUser: Array.from(this.rooms.entries()).map(([userId, clientIds]) => ({
        userId,
        clientCount: clientIds.size
      }))
    };
  }

  // 清理无效连接
  cleanup() {
    const now = new Date();
    const timeout = 5 * 60 * 1000; // 5分钟超时

    this.clients.forEach((client, clientId) => {
      if (now - client.lastPing > timeout) {
        console.log(`清理超时客户端: ${clientId}`);
        this.removeClient(clientId);
      }
    });
  }
}

// 创建全局WebSocket管理器实例
const wsManager = new WebSocketManager();

// 定期清理无效连接
setInterval(() => {
  wsManager.cleanup();
}, 60000); // 每分钟清理一次

module.exports = wsManager;
