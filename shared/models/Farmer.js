module.exports = (sequelize, DataTypes) => {
  const Farmer = sequelize.define('Farmer', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    farm_name: { type: DataTypes.STRING, allowNull: false },
    location: { type: DataTypes.STRING, allowNull: true },
    city: { type: DataTypes.STRING, allowNull: true },
    state: { type: DataTypes.STRING, allowNull: true },
    latitude: { type: DataTypes.FLOAT, allowNull: true },
    longitude: { type: DataTypes.FLOAT, allowNull: true },
    bank_secret_reference: { type: DataTypes.STRING, allowNull: true }
  }, {
    tableName: 'farmers',
    timestamps: false
  });
  return Farmer;
};
