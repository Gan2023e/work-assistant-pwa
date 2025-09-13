import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Form, 
  InputNumber, 
  Row, 
  Col, 
  Card, 
  Statistic, 
  Divider, 
  Typography,
  Space,
  Alert
} from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface ProfitCalculatorProps {
  visible: boolean;
  onClose: () => void;
}

interface CalculationResult {
  totalCostUSD: number;      // 总成本（美元）
  grossProfit: number;       // 毛利润（美元）
  grossProfitMargin: number; // 毛利率（百分比）
  netProfit: number;         // 净利润（美元）
  netProfitMargin: number;   // 净利率（百分比）
}

const ProfitCalculator: React.FC<ProfitCalculatorProps> = ({ visible, onClose }) => {
  const [form] = Form.useForm();
  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [exchangeRate, setExchangeRate] = useState(7.1); // 默认汇率

  const calculateProfit = (values: any) => {
    const { sellingPrice, productCost, weight = 1 } = values;
    
    if (!sellingPrice || !productCost) {
      setCalculation(null);
      return;
    }

    // 常量定义
    const FBA_FEE = 7; // USD
    const SHIPPING_COST_PER_KG = 10; // RMB
    const AMAZON_FEE_RATE = 0.15; // 15% 亚马逊佣金
    const ADDITIONAL_COSTS_RATE = 0.05; // 5% 其他费用（包装、标签等）

    // 计算各项成本
    const productCostUSD = productCost / exchangeRate; // 产品成本（美元）
    const shippingCostUSD = (SHIPPING_COST_PER_KG * weight) / exchangeRate; // 头程运费（美元）
    const amazonFee = sellingPrice * AMAZON_FEE_RATE; // 亚马逊佣金
    const additionalCosts = sellingPrice * ADDITIONAL_COSTS_RATE; // 其他费用

    // 总成本
    const totalCostUSD = productCostUSD + shippingCostUSD + FBA_FEE + amazonFee + additionalCosts;

    // 毛利润（不包括亚马逊佣金和其他费用）
    const grossProfit = sellingPrice - productCostUSD - shippingCostUSD - FBA_FEE;
    const grossProfitMargin = (grossProfit / sellingPrice) * 100;

    // 净利润
    const netProfit = sellingPrice - totalCostUSD;
    const netProfitMargin = (netProfit / sellingPrice) * 100;

    setCalculation({
      totalCostUSD,
      grossProfit,
      grossProfitMargin,
      netProfit,
      netProfitMargin
    });
  };

  const onValuesChange = (changedValues: any, allValues: any) => {
    calculateProfit(allValues);
  };

  const handleClose = () => {
    form.resetFields();
    setCalculation(null);
    onClose();
  };

  return (
    <Modal
      title={
        <Space>
          <CalculatorOutlined />
          <span>亚马逊产品利润推算器</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={800}
      style={{ top: 20 }}
    >
      <Row gutter={24}>
        <Col span={12}>
          <Card title="📝 产品信息" size="small" style={{ marginBottom: 16 }}>
            <Form
              form={form}
              layout="vertical"
              onValuesChange={onValuesChange}
            >
              <Form.Item
                label="在线产品价格 (USD)"
                name="sellingPrice"
                rules={[{ required: true, message: '请输入产品价格' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  precision={2}
                  placeholder="例如: 29.99"
                />
              </Form.Item>

              <Form.Item
                label="产品成本 (RMB)"
                name="productCost"
                rules={[{ required: true, message: '请输入产品成本' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  precision={2}
                  placeholder="例如: 50.00"
                />
              </Form.Item>

              <Form.Item
                label="产品重量 (KG)"
                name="weight"
                initialValue={1}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0.1}
                  step={0.1}
                  precision={1}
                  placeholder="例如: 1.5"
                />
              </Form.Item>

              <Form.Item label="美元汇率">
                <InputNumber
                  value={exchangeRate}
                  onChange={(value) => setExchangeRate(value || 7.1)}
                  style={{ width: '100%' }}
                  min={6}
                  max={8}
                  step={0.01}
                  precision={2}
                />
              </Form.Item>
            </Form>
          </Card>

          <Alert
            message="计算方法"
            description={
              <div>
                <p><strong>净利润 = 销售价格 - 总成本</strong></p>
                <p><strong>总成本包括：</strong></p>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  <li>产品成本：人民币成本 ÷ 汇率</li>
                  <li>头程运费：10元/KG ÷ 汇率</li>
                  <li>FBA运费：固定 $7.00</li>
                  <li>亚马逊佣金：销售价格 × 15%</li>
                  <li>其他费用：销售价格 × 5%（包装、标签等）</li>
                </ul>
              </div>
            }
            type="info"
            showIcon
          />
        </Col>

        <Col span={12}>
          <Card title="💰 利润计算结果" size="small">
            {calculation ? (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="总成本 (USD)"
                      value={calculation.totalCostUSD}
                      precision={2}
                      prefix="$"
                      valueStyle={{ color: '#cf1322', fontSize: '18px' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="净利润 (USD)"
                      value={calculation.netProfit}
                      precision={2}
                      prefix="$"
                      valueStyle={{ 
                        color: calculation.netProfit > 0 ? '#3f8600' : '#cf1322',
                        fontSize: '18px'
                      }}
                    />
                  </Col>
                </Row>

                <Divider style={{ margin: '16px 0' }} />

                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="净利率"
                      value={calculation.netProfitMargin}
                      precision={1}
                      suffix="%"
                      valueStyle={{ 
                        color: calculation.netProfitMargin > 0 ? '#3f8600' : '#cf1322',
                        fontSize: '18px'
                      }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="净利润 (RMB)"
                      value={calculation.netProfit * exchangeRate}
                      precision={2}
                      prefix="¥"
                      valueStyle={{ 
                        color: calculation.netProfit > 0 ? '#3f8600' : '#cf1322',
                        fontSize: '18px'
                      }}
                    />
                  </Col>
                </Row>

                <Divider style={{ margin: '12px 0' }} />

                {calculation.netProfitMargin < 10 && (
                  <Alert
                    message="利润率偏低"
                    description="净利率低于10%，建议重新评估产品定价或成本控制"
                    type="warning"
                    showIcon
                    style={{ marginTop: 8 }}
                  />
                )}

                {calculation.netProfitMargin >= 20 && (
                  <Alert
                    message="利润率良好"
                    description="净利率超过20%，该产品具有良好的盈利潜力"
                    type="success"
                    showIcon
                    style={{ marginTop: 8 }}
                  />
                )}
              </Space>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px 20px',
                color: '#999'
              }}>
                <CalculatorOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <div>请输入产品价格和成本进行计算</div>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Modal>
  );
};

export default ProfitCalculator; 