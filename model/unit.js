const { DataTypes, QueryTypes } = require('sequelize');
const dbConf = require('../db/dbConf');

module.exports.Unit = dbConf.sequelizeObj.define('unit', {
    id: {
        type: DataTypes.INTEGER(11), 
        primaryKey: true,
        autoIncrement: true,
    },
    unit: {
        type: DataTypes.STRING(55),
        allowNull: false,
    },
    subUnit: {
        type: DataTypes.STRING(55),
        default: null,
    },
    group: {
        type: DataTypes.STRING(255),
        default: null,
    },
    lat: {
        type: DataTypes.STRING(55),
        default: null,
    },
    lng: {
        type: DataTypes.STRING(55),
        default: null,
    },
    operation: {
        type: DataTypes.VIRTUAL
    }
}, {
    tableName: 'unit',
    timestamps: false,
}
);
