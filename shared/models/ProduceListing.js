module.exports = (sequelize, DataTypes) => {
  const ProduceListing = sequelize.define('ProduceListing', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    farmer_id: { type: DataTypes.INTEGER, allowNull: false },
    product_name: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.STRING, allowNull: false },
    quantity: { type: DataTypes.FLOAT, allowNull: false },
    unit: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    harvest_date: { type: DataTypes.DATEONLY, allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    image_url: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.STRING, defaultValue: 'ACTIVE' } // ACTIVE, SOLD, INACTIVE
  }, {
    tableName: 'produce_listings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
  return ProduceListing;
};
