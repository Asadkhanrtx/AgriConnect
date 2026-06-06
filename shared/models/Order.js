module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    buyer_id: { type: DataTypes.INTEGER, allowNull: false },
    listing_id: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.FLOAT, allowNull: false },
    total_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    delivery_status: { type: DataTypes.STRING, defaultValue: 'PENDING' } // PENDING, IN_TRANSIT, DELIVERED
  }, {
    tableName: 'orders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
  return Order;
};
