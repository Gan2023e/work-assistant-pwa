const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const Logistics = sequelize.define('Logistics', {
  shippingId: {
    type: DataTypes.STRING,
    primaryKey: true,
    field: 'shipping_id',
  },
  logisticsProvider: {
    type: DataTypes.STRING,
    field: 'logistics_provider',
  },
  trackingNumber: {
    type: DataTypes.STRING,
    field: 'tracking_number',
  },
  packageCount: {
    type: DataTypes.INTEGER,
    field: 'package_count',
  },
  productCount: {
    type: DataTypes.INTEGER,
    field: 'product_count',
  },
  channel: {
    type: DataTypes.STRING,
  },
  status: {
    type: DataTypes.STRING,
  },
  departureDate: {
    type: DataTypes.DATE,
    field: 'departure_date',
  },
  sailingDate: {
    type: DataTypes.DATE,
    field: 'sailing_date',
  },
  estimatedArrivalDate: {
    type: DataTypes.DATE,
    field: 'estimated_arrival_date',
  },
  estimatedWarehouseDate: {
    type: DataTypes.DATE,
    field: 'estimated_warehouse_date',
  },
  logisticsNode: {
    type: DataTypes.STRING,
    field: 'logistics_node',
  },
  destinationCountry: {
    type: DataTypes.STRING,
    field: 'destination_country',
  },
  destinationWarehouse: {
    type: DataTypes.STRING,
    field: 'destination_warehouse',
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
  },
  billingWeight: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'billing_weight',
  },
  mrn: {
    type: DataTypes.STRING,
    field: 'vat_receipt_mrn',
  },
  customsDuty: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'customs_duty',
  },
  taxPaymentStatus: {
    type: DataTypes.STRING,
    field: 'tax_payment_status',
  },
  taxDeclarationStatus: {
    type: DataTypes.STRING,
    field: 'tax_declaration_status',
  },
  dimensions: {
    type: DataTypes.STRING,
  },
  paymentStatus: {
    type: DataTypes.STRING,
    field: 'payment_status',
  },
  // VAT税单相关字段
  vatReceiptUrl: {
    type: DataTypes.STRING,
    field: 'vat_receipt_url',
  },
  vatReceiptObjectName: {
    type: DataTypes.STRING,
    field: 'vat_receipt_object_name',
  },
  vatReceiptFileName: {
    type: DataTypes.STRING,
    field: 'vat_receipt_file_name',
  },
  vatReceiptFileSize: {
    type: DataTypes.INTEGER,
    field: 'vat_receipt_file_size',
  },
  vatReceiptUploadTime: {
    type: DataTypes.DATE,
    field: 'vat_receipt_upload_time',
  },
  vatReceiptTaxAmount: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'vat_receipt_tax_amount',
  },
  vatReceiptTaxDate: {
    type: DataTypes.DATE,
    field: 'vat_receipt_tax_date',
  },
}, {
  tableName: 'logistics',
  timestamps: false
});

module.exports = Logistics; 