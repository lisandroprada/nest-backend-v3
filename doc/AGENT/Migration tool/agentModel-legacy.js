const mongoose = require('mongoose');
const validator = require('validator');

const agentSchema = new mongoose.Schema({
  agentType: {
    type: String,
    enum: [
      'Cliente',
      'Proveedor',
      'Empresa de Servicios',
      'Consorcio',
      'Inmobiliaria',
    ],
  },
  personType: { type: String, enum: ['Física', 'Jurídica'] },
  name: { type: String, required: true },
  lastName: { type: String },
  fullName: {
    type: String,
    default: function () {
      if (this.personType === 'Jurídica') this.lastName = '';
      return `${this.name} ${this.lastName}`;
    },
  },
  gender: { type: String, enum: ['Femenino', 'Masculino'] },
  maritalStatus: { type: String },
  postalCode: { type: String },
  city: {
    id: { type: String },
    nombre: { type: String },
    _id: false,
  },
  state: {
    id: { type: String },
    nombre: { type: String },
    _id: false,
  },

  email: {
    type: String,
    required: [true, 'User must have a email'],
    // unique: true,
    lowerCase: true,
    validate: [validator.isEmail, 'Please provide a valid email'],
  },
  bankAccount: [
    {
      bank: { type: String },
      cbu: { type: String },
      bankId: { type: mongoose.Schema.ObjectId, ref: 'Bank' },
      description: { type: String },
      _id: false,
    },
  ],
  photo: { type: String },
  uid: { type: String },
  identityCard: { type: String, required: true },
  taxId: { type: String },
  taxType: { type: String },
  taxIdType: { type: String },
  taxAddress: { type: String },
  address: { type: String, required: false },
  workAddress: { type: String },

  iva: { type: String },
  billing: { type: Boolean },

  supplierMask: { type: String },
  consortiumDetails: [
    {
      expenseName: { type: String },
      expenseAmount: { type: Number },
      consortiumId: { type: String },
    },
  ],
  phone: [],
  active: { type: Boolean },
  createdAt: { type: Date, default: Date.now() - 3 * 60 * 60 * 1000 },

  apoderado: {
    _id: { type: mongoose.Schema.ObjectId, ref: 'Agent' },
    fullName: { type: String },
    address: { type: String },
    email: { type: String },
    city: { id: { type: String }, nombre: { type: String } },
    state: { id: { type: String }, nombre: { type: String } },
    gender: { type: String },
    identityCard: { type: String },
  },

  user: { type: mongoose.Schema.ObjectId, ref: 'User' },
});

agentSchema.post(/^find/, function (doc) {
  if (doc !== null) {
    doc.fullName = `${doc.name} ${doc.lastName}`;
  }
});

const Agent = mongoose.model('Agent', agentSchema);
module.exports = Agent;
