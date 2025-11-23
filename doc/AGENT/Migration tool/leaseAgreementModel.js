const mongoose = require('mongoose');
const { DateTime } = require('luxon');
const currency = require('currency.js');
const masterAccountController = require('../controllers/masterAccountController');
const PropertyModel = require('../models/propertyModel');

const leaseAgreementSchema = new mongoose.Schema({
  contrato: { type: String },
  property: {
    _id: { type: mongoose.Schema.ObjectId, ref: 'Property' },
    address: { type: String },
    city: { id: { type: String }, nombre: { type: String } },
    state: { id: { type: String }, nombre: { type: String } },
  },
  createdAt: { type: Date, default: Date.now() - 3 * 60 * 60 * 1000 },
  startDate: { type: Date, default: Date.now() - 3 * 60 * 60 * 1000 },
  startDay: { type: Number },
  paymentTerm: { type: Number },
  expiresAt: {
    type: Date,
    default: function () {
      return DateTime.fromJSDate(this.startDate)
        .plus({ months: this.length })
        .minus({ days: 1 });
    },
  },
  type: {
    type: String,
    enum: ['Vivienda Única', 'Vivienda', 'Comercial', 'Temporada'],
    required: true,
  },
  use: { type: String },
  leaseHolder: [
    {
      _id: { type: mongoose.Schema.ObjectId, ref: 'Agent' },
      fullName: { type: String },
      address: { type: String },
      email: { type: String },
      city: { id: { type: String }, nombre: { type: String } },
      state: { id: { type: String }, nombre: { type: String } },
      gender: { type: String },
      identityCard: { type: String },
      apoderado: {},
    },
  ],
  tenant: [
    {
      _id: { type: mongoose.Schema.ObjectId, ref: 'Agent' },
      fullName: { type: String },
      address: { type: String },
      email: { type: String },
      city: { id: { type: String }, nombre: { type: String } },
      state: { id: { type: String }, nombre: { type: String } },
      gender: { type: String },
      identityCard: { type: String },
      apoderado: {},
    },
  ],
  guarantor: [
    {
      _id: { type: mongoose.Schema.ObjectId, ref: 'Agent' },
      fullName: { type: String },
      address: { type: String },
      email: { type: String },
      city: { id: { type: String }, nombre: { type: String } },
      state: { id: { type: String }, nombre: { type: String } },
      gender: { type: String },
      identityCard: { type: String },
    },
  ],
  realtor: {
    _id: { type: mongoose.Schema.ObjectId, ref: 'Agent' },
    fullName: { type: String },
    address: { type: String },
    email: { type: String },
    city: { nombre: { type: String } },
    state: { nombre: { type: String } },
  },
  length: {
    type: Number,
    required: [true, 'Debe ingresar el tiempo de duración'],
  },
  rentAmount: { type: Number, required: [true, 'Debe ingresar un monto'] },
  rentIncreaseType: { type: String, required: [true, ''] },
  rentIncrease: { type: Number },
  rentIncreasePeriod: { type: Number },
  rentIncreaseFixed: { type: Boolean },
  icl: { type: Number },
  iclArray: [
    {
      icl: { type: Number },
      casapropia: { type: Number },
      date: { type: Date },
      status: { type: Boolean },
      stage: { type: Number },
    },
  ],
  startIpcRipte: { type: Number },
  adminFee: { type: Number },
  interest: { type: Number },

  leaseHolderFee: { type: Number },
  leaseHolderAmountOfFees: { type: Number },
  tenantFee: { type: Number },
  tenantAmountOfFees: { type: Number },

  depositType: { type: String },
  depositAmount: { type: Number },
  depositLength: { type: Number },

  expensesType: {
    _id: { type: mongoose.Schema.ObjectId, ref: 'Agent' },
    expenseName: { type: String },
  },
  expensesAmount: { type: Number },
  consortium: {
    _id: { type: mongoose.Schema.ObjectId, ref: 'Agent' },
    fullName: { type: String },
  },

  status: { type: Boolean, default: true },
  touched: { type: Boolean, default: false },
  changedAt: { type: Date, default: Date.now() - 3 * 60 * 60 * 1000 },
  leaseText: { type: String },
  user: { type: mongoose.Schema.ObjectId, ref: 'User' },
});

// QUERY Middleware

// Create Master accounts

leaseAgreementSchema.pre('save', async function (next) {
  const data = {
    startDate: this.startDate,
    dueDate: DateTime.fromJSDate(this.startDate)
      .plus({
        days: this.paymentTerm,
      })
      .toJSDate(),
    length: this.length,
    target: this.leaseHolder[0],
    source: this.tenant[0],
    localTarget: this.realtor,
    amount: this.rentAmount,
    fee: this.adminFee,
    type: 'Alquiler Devengado',
    detail: '',
    increase: typeof this.rentIncrease !== 'undefined' ? this.rentIncrease : 0,
    increasePeriod: this.rentIncreasePeriod,
    period: true,
    startPeriod: 0,
    fixed: this.rentIncreaseFixed,
    realtor: this.realtor,
    origin: this._id,
    // upgradeable: this.rentIncreaseType === 'ICL' ? true : false,
    upgradeable:
      this.rentIncreaseType === 'ICL' ||
      this.rentIncreaseType === 'CASA PROPIA',
  };
  masterAccountController.createMaster(data);

  //Generate GUARANTY DEPOSITS
  if (this.depositType === 'Efectivo') {
    const depositAccounts = {
      startDate: this.startDate,
      dueDate: this.startDate,
      length: this.depositLength,
      target: this.leaseHolder[0],
      source: this.tenant[0],
      amount: currency(this.depositAmount).divide(this.depositLength).value,
      fee: 0,
      type: 'Deposito en Garantía',
      detail: '',
      increase: 0,
      increasePeriod: 1,
      realtor: this.realtor,
      period: false,
      startPeriod: 0,
      origin: this._id,
    };
    masterAccountController.createMaster(depositAccounts);
  }

  //Generate Expenses Accounts
  if (this.consortium._id) {
    // Set property consortium

    // console.log('Consortium', this.consortium);
    const expensesAccounts = {
      startDate: this.startDate,
      dueDate: this.startDate,
      length: this.length,
      target: this.consortium,
      source: this.tenant[0],
      amount: this.expensesAmount,
      fee: 0,
      type: 'Expensas',
      detail: '',
      increase: 0,
      increasePeriod: 1,
      realtor: this.realtor,
      period: true,
      startPeriod: 0,
      origin: this._id,
    };
    masterAccountController.createMaster(expensesAccounts);
  }

  if (this.leaseHolderFee > 0) {
    // console.log(
    //   (this.rentAmount * this.length * (this.leaseHolderFee / 100)) /
    //     this.leaseHolderAmountOfFees
    // );
    // console.log(this);
    const leaseHolderFee = {
      startDate: this.startDate,
      dueDate: this.startDate,
      length: this.leaseHolderAmountOfFees,
      target: this.realtor,
      source: this.leaseHolder[0],
      amount: currency(this.rentAmount)
        .multiply(this.length)
        .multiply(this.leaseHolderFee)
        .divide(100)
        .divide(this.leaseHolderAmountOfFees).value,
      fee: 0,
      type: 'Honorarios',
      detail: this.property.address,
      increase: 0,
      increasePeriod: 1,
      period: false,
      origin: this._id,
    };
    masterAccountController.createMaster(leaseHolderFee);
  }

  if (this.tenantFee > 0) {
    const tenantFee = {
      startDate: this.startDate,
      dueDate: this.startDate,
      length: this.tenantAmountOfFees,
      target: this.realtor,
      source: this.tenant[0],
      amount: currency(this.rentAmount)
        .multiply(this.length)
        .multiply(this.tenantFee)
        .divide(100)
        .divide(this.tenantAmountOfFees).value,
      fee: 0,
      type: 'Honorarios',
      detail: this.property.address,
      increase: 0,
      increasePeriod: 1,
      period: false,
      origin: this._id,
    };
    masterAccountController.createMaster(tenantFee);
  }

  const PropertyDoc = await PropertyModel.updateOne(
    { _id: this.property },
    {
      $set: {
        tenant: { _id: this.tenant[0]._id, fullName: this.tenant[0].fullName },
        leaseAgreement: this._id,
        availableAt: DateTime.fromJSDate(this.expiresAt),
        consortium: {
          _id: this.consortium._id,
          fullName: this.consortium.fullName,
        },
        expensesType: {
          _id: this.expensesType._id,
          expenseName: this.expensesType.expenseName,
        },
      },
    }
  );
  next();
});

const LeaseAgreement = mongoose.model('LeaseAgreement', leaseAgreementSchema);
module.exports = LeaseAgreement;
