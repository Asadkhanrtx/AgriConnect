module.exports = (sequelize, DataTypes) => {
  const Buyer = sequelize.define('Buyer', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    company_name: { type: DataTypes.STRING, allowNull: true }
  }, {
    tableName: 'buyers',
    timestamps: false
  });
  return Buyer;
};
