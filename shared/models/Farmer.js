module.exports = (sequelize, DataTypes) => {
  const Farmer = sequelize.define('Farmer', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    farm_name: { type: DataTypes.STRING, allowNull: false },
    location: { type: DataTypes.STRING, allowNull: true },
    bank_secret_reference: { type: DataTypes.STRING, allowNull: true }
  }, {
    tableName: 'farmers',
    timestamps: false
  });
  return Farmer;
};
