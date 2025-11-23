const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  address: {
    type: String,
    required: [true, 'La propiedad debe poseer una dirección válida'],
  },
  state: {
    id: { type: String },
    nombre: { type: String },
  },
  city: {
    id: { type: String },
    nombre: { type: String },
  },
  lat: { type: Number },
  lng: { type: Number },
  gmaps: {
    address: { type: String },
    city: { type: String },
  },
  owner: [
    {
      _id: { type: mongoose.Schema.ObjectId, ref: 'Agent' },
      fullName: { type: String },
    },
  ],
  tenant: {
    _id: { type: mongoose.Schema.ObjectId, ref: 'Agent' },
    fullName: { type: String },
  },
  leaseAgreement: { type: mongoose.Schema.ObjectId, ref: 'LeaseAgreement' },
  consortium: {
    _id: { type: mongoose.Schema.ObjectId, ref: 'Agent' },
    fullName: { type: String },
  },

  supplierId: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'Supplier',
      rate: { type: Number },
      mask: { type: String },
      supplierId: String,
    },
  ],
  specs: [{ type: String }],

  type: { type: String },
  purpose: { type: String },

  status: { type: String }, // Disponible | No disponible
  availableForSale: { type: Boolean },
  publishForRent: { type: Boolean }, //
  publishForSale: { type: Boolean }, //

  valueForSale: {
    amount: { type: Number },
    currency: { type: String },
    symbol: { type: String },
    pricePublic: { type: Boolean },
    paymentMethod: { type: String },
    description: { type: String },
    date: { type: Date, default: Date.now() - 3 * 60 * 60 * 1000 },
  },

  valueForRent: {
    amount: { type: Number },
    currency: { type: String },
    symbol: { type: String },
    pricePublic: { type: Boolean },
    paymentMethod: { type: String },
    description: { type: String },
    date: { type: Date, default: Date.now() - 3 * 60 * 60 * 1000 },
  },

  availableAt: { type: Date },
  associatedServices: [],
  inventory: [
    {
      item: { type: String },
      cantidad: { type: Number },
      ambiente: { type: String },
      estado: { type: String },
      _id: false,
    },
  ],
  description: [
    { ambiente: { type: String }, cantidad: { type: Number }, _id: false },
  ],

  detailedDescription: {
    availableServices: [], // Servicios disponibles
    sqFt: { type: Number }, // Metros 2
    buildSqFt: { type: Number }, //
    age: { type: Number }, // Antiguedad
    petFriendly: { type: Boolean }, //
    rooms: { type: Number }, //
    bathrooms: { type: Number }, //
    locations: [],
    miscellaneous: [],
    orientation: { type: String }, //
    title: { type: String }, //
    brief: { type: String },
  },
  consortium: {
    _id: { type: mongoose.Schema.ObjectId, ref: 'Agent' },
    fullName: { type: String },
  },
  expensesType: {
    _id: { type: mongoose.Schema.ObjectId, ref: 'Expense' },
    expenseName: { type: String },
  },
  img: [
    {
      name: { type: String },
      thumb: { type: String },
      thumbWeb: { type: String },
      imgSlider: { type: String },
      title: { type: String },
      description: { type: String },
      createdAt: { type: Date, default: Date.now() - 3 * 60 * 60 * 1000 },
    },
  ],
  imgCover: {
    name: { type: String },
    thumbWeb: { type: String },
    createdAt: { type: Date, default: Date.now() - 3 * 60 * 60 * 1000 },
  },
  createdAt: {
    type: Date,
    default: function () {
      return Date.now() - 3 * 60 * 60 * 1000;
    },
  },
  active: { type: Boolean, default: true },
  user: { type: mongoose.Schema.ObjectId, ref: 'User' },
});

const Property = mongoose.model('Property', propertySchema);
module.exports = Property;
