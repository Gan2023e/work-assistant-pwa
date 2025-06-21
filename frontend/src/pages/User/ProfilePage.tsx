import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  message, 
  Row, 
  Col, 
  Divider,
  Typography,
  Tag 
} from 'antd';
import { UserOutlined, MailOutlined, KeyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL } from '../../config/api';

const { Title, Text } = Typography;

interface UserProfile {
  id: number;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

const ProfilePage: React.FC = () => {
  const { user: currentUser, login } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  // 获取用户详细信息
  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (response.ok) {
        setUserProfile(result.user);
        profileForm.setFieldsValue({
          email: result.user.email,
        });
      } else {
        message.error(result.message || '获取用户信息失败');
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      message.error('网络错误');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  // 更新个人信息
  const handleUpdateProfile = async (values: any) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();
      if (response.ok) {
        message.success('个人信息更新成功');
        setUserProfile(result.user);
        
        // 更新本地存储的用户信息
        if (currentUser) {
          const updatedUser = { ...currentUser, email: result.user.email };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          login(localStorage.getItem('token') || '', updatedUser);
        }
      } else {
        message.error(result.message || '更新个人信息失败');
      }
    } catch (error) {
      console.error('更新个人信息失败:', error);
      message.error('网络错误');
    }
    setLoading(false);
  };

  // 修改密码
  const handleChangePassword = async (values: any) => {
    setPasswordLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();
      if (response.ok) {
        message.success('密码修改成功');
        passwordForm.resetFields();
      } else {
        message.error(result.message || '修改密码失败');
      }
    } catch (error) {
      console.error('修改密码失败:', error);
      message.error('网络错误');
    }
    setPasswordLoading(false);
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={2}>个人资料</Title>
      
      <Row gutter={24}>
        <Col span={24}>
          {/* 基本信息卡片 */}
          <Card 
            title={
              <span>
                <UserOutlined style={{ marginRight: 8 }} />
                基本信息
              </span>
            } 
            style={{ marginBottom: 24 }}
            loading={loading}
          >
            {userProfile && (
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ marginBottom: 16 }}>
                    <Text strong>用户名：</Text>
                    <Text>{userProfile.username}</Text>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <Text strong>角色：</Text>
                    <Tag color={userProfile.role === 'admin' ? 'red' : 'blue'}>
                      {userProfile.role === 'admin' ? '管理员' : '普通用户'}
                    </Tag>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <Text strong>状态：</Text>
                    <Tag color={userProfile.isActive ? 'green' : 'red'}>
                      {userProfile.isActive ? '激活' : '禁用'}
                    </Tag>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ marginBottom: 16 }}>
                    <Text strong>注册时间：</Text>
                    <Text>{dayjs(userProfile.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Text>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <Text strong>最后登录：</Text>
                    <Text>
                      {userProfile.lastLogin 
                        ? dayjs(userProfile.lastLogin).format('YYYY-MM-DD HH:mm:ss') 
                        : '从未登录'
                      }
                    </Text>
                  </div>
                </Col>
              </Row>
            )}
          </Card>

          {/* 修改邮箱卡片 */}
          <Card 
            title={
              <span>
                <MailOutlined style={{ marginRight: 8 }} />
                修改邮箱
              </span>
            } 
            style={{ marginBottom: 24 }}
          >
            <Form
              form={profileForm}
              layout="vertical"
              onFinish={handleUpdateProfile}
            >
              <Form.Item
                name="email"
                label="邮箱地址"
                rules={[
                  { type: 'email', message: '请输入有效的邮箱地址' }
                ]}
              >
                <Input 
                  placeholder="请输入邮箱地址" 
                  style={{ width: '100%', maxWidth: 400 }}
                />
              </Form.Item>
              
              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading}
                >
                  更新邮箱
                </Button>
              </Form.Item>
            </Form>
          </Card>

          {/* 修改密码卡片 */}
          <Card 
            title={
              <span>
                <KeyOutlined style={{ marginRight: 8 }} />
                修改密码
              </span>
            }
          >
            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={handleChangePassword}
            >
              <Form.Item
                name="currentPassword"
                label="当前密码"
                rules={[
                  { required: true, message: '请输入当前密码' }
                ]}
              >
                <Input.Password 
                  placeholder="请输入当前密码" 
                  style={{ width: '100%', maxWidth: 400 }}
                />
              </Form.Item>
              
              <Form.Item
                name="newPassword"
                label="新密码"
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 6, message: '密码至少6个字符' }
                ]}
              >
                <Input.Password 
                  placeholder="请输入新密码" 
                  style={{ width: '100%', maxWidth: 400 }}
                />
              </Form.Item>
              
              <Form.Item
                name="confirmPassword"
                label="确认新密码"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: '请确认新密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password 
                  placeholder="请确认新密码" 
                  style={{ width: '100%', maxWidth: 400 }}
                />
              </Form.Item>
              
              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={passwordLoading}
                >
                  修改密码
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProfilePage; 