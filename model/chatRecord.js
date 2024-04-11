const { DataTypes } = require('sequelize');
const dbConf = require('../db/dbConf');

module.exports.ChatRecord = dbConf.sequelizeObj.define('chatRecord', {
    msgId: {
        type: DataTypes.INTEGER(11),
        primaryKey: true,
    },
    userId: {
        type: DataTypes.INTEGER(55),
        primaryKey: true,
    }
}, {
    tableName: 'chat_record',
    timestamps: true,
});
