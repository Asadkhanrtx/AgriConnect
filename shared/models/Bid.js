module.exports = (sequelize, DataTypes) => {
  const Bid = sequelize.define('Bid', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    buyer_id: { type: DataTypes.INTEGER, allowNull: false },
    listing_id: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'PENDING' } // PENDING, ACCEPTED, REJECTED
  }, {
    tableName: 'bids',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
  return Bid;
};
