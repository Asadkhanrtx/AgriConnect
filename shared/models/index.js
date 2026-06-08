const { DataTypes } = require('sequelize');

function initModels(sequelize) {
  // Import models
  const User = require('./User')(sequelize, DataTypes);
  const Farmer = require('./Farmer')(sequelize, DataTypes);
  const Buyer = require('./Buyer')(sequelize, DataTypes);
  const ProduceListing = require('./ProduceListing')(sequelize, DataTypes);
  const Bid = require('./Bid')(sequelize, DataTypes);
  const Order = require('./Order')(sequelize, DataTypes);
  const Transaction = require('./Transaction')(sequelize, DataTypes);
  const Notification = require('./Notification')(sequelize, DataTypes);
  const Payment = require('./Payment')(sequelize, DataTypes);

  // Define Associations
  User.hasOne(Farmer, { foreignKey: 'user_id', as: 'farmer_profile' });
  Farmer.belongsTo(User, { foreignKey: 'user_id' });

  User.hasOne(Buyer, { foreignKey: 'user_id', as: 'buyer_profile' });
  Buyer.belongsTo(User, { foreignKey: 'user_id' });

  Farmer.hasMany(ProduceListing, { foreignKey: 'farmer_id', as: 'listings' });
  ProduceListing.belongsTo(Farmer, { foreignKey: 'farmer_id' });

  Buyer.hasMany(Bid, { foreignKey: 'buyer_id', as: 'bids' });
  Bid.belongsTo(Buyer, { foreignKey: 'buyer_id' });

  ProduceListing.hasMany(Bid, { foreignKey: 'listing_id', as: 'bids' });
  Bid.belongsTo(ProduceListing, { foreignKey: 'listing_id' });

  Buyer.hasMany(Order, { foreignKey: 'buyer_id', as: 'orders' });
  Order.belongsTo(Buyer, { foreignKey: 'buyer_id' });

  ProduceListing.hasMany(Order, { foreignKey: 'listing_id', as: 'orders' });
  Order.belongsTo(ProduceListing, { foreignKey: 'listing_id' });

  Order.hasMany(Transaction, { foreignKey: 'order_id', as: 'transactions' });
  Transaction.belongsTo(Order, { foreignKey: 'order_id' });

  User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
  Notification.belongsTo(User, { foreignKey: 'user_id' });

  Order.hasOne(Payment, { foreignKey: 'order_id', as: 'payment' });
  Payment.belongsTo(Order, { foreignKey: 'order_id' });

  // Expose models on sequelize.models
  return sequelize.models;
}

module.exports = initModels;
