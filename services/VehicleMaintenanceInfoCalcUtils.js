const log = require('../log/winston').logger('VehicleMaintenanceInfoCalcUtils');
const { Sequelize, Op, QueryTypes } = require('sequelize');
const { sequelizeObj } = require('../db/dbConf');
const { Vehicle } = require('../model/vehicle');
const moment = require('moment');

module.exports.reCalcVehicleMaintenanceInfo = async function(vehicleNo, taskStartTime, taskEndTime) {
    // try {
    //     if (vehicleNo) {
    //         let vehicle = await Vehicle.findByPk(vehicleNo);
    //         if (vehicle) {
    //             await reCaclVehicleWptTime(vehicle, taskStartTime, taskEndTime);
    //             await reCaclVehicleMptTime(vehicle, taskStartTime, taskEndTime);
    //         }
    //     }
    // } catch (error) {
    //     log.error(`(reCalcVehicleMaintenanceInfo ${moment().format('YYYY-MM-DD HH:mm:ss')} ): working failed, vehicleNo: ${vehicleNo},  ${error}`);
    //     log.error(error);
    // }
}

const reCaclVehicleWptTime = async function(vehicle, taskStartTime, taskEndTime) {
    if (vehicle.nextWpt1Time) {
        let wptStartTime = moment(vehicle.nextWpt1Time + ' 00:00:00', 'YYYY-MM-DD HH:mm:ss').subtract(6, 'd');
        let wptEndTime = moment(vehicle.nextWpt1Time + ' 23:59:59', 'YYYY-MM-DD HH:mm:ss');
        // log.info(`wptStartTime: ` + wptStartTime.format('YYYY-MM-DD HH:mm:ss'))
        // log.info(`wptEndTime: ` + wptEndTime.format('YYYY-MM-DD HH:mm:ss'))
        taskStartTime = moment(taskStartTime);
        taskEndTime = moment(taskEndTime);
        //check task is in the wpt cycle
        // wptStartTime <=  taskStartTime <= wptEndTime  ||  wptStartTime <=  taskEndTime <= wptEndTime || (taskStartTime <= wptStartTime and  taskEndTime >= wptEndTime)
        if (wptEndTime.isBefore(moment())
            || (taskStartTime.isSameOrAfter(wptStartTime) && taskStartTime.isSameOrBefore(wptEndTime)) 
            || (taskEndTime.isSameOrAfter(wptStartTime) && taskStartTime.isSameOrBefore(wptEndTime))
            || (taskStartTime.isSameOrBefore(wptStartTime) && taskEndTime.isSameOrAfter(wptEndTime))) {
            await Vehicle.update({nextWpt1Time: null}, {where: {vehicleNo: vehicle.vehicleNo}});
        }
    }
}

const reCaclVehicleMptTime = async function(vehicle, taskStartTime, taskEndTime) {
    if (vehicle.nextMptTime) {
        let mptStartTime = moment(vehicle.nextMptTime + ' 00:00:00', 'YYYY-MM-DD HH:mm:ss').subtract(20, 'd');
        let mptEndTime = moment(vehicle.nextMptTime + ' 23:59:59', 'YYYY-MM-DD HH:mm:ss');
        // log.info(`mptStartTime: ` + mptStartTime.format('YYYY-MM-DD HH:mm:ss'))
        // log.info(`mptEndTime: ` + mptEndTime.format('YYYY-MM-DD HH:mm:ss'))
        taskStartTime = moment(taskStartTime);
        taskEndTime = moment(taskEndTime);
        //check task is in the wpt cycle
        // mptStartTime <=  taskStartTime <= mptEndTime  ||  mptStartTime <=  taskEndTime <= mptEndTime || (taskStartTime <= mptStartTime and  taskEndTime >= mptEndTime)
        if (mptEndTime.isBefore(moment())
            || (taskStartTime.isSameOrAfter(mptStartTime) && taskStartTime.isSameOrBefore(mptEndTime)) 
            || (taskEndTime.isSameOrAfter(mptStartTime) && taskStartTime.isSameOrBefore(mptEndTime))
            || (taskStartTime.isSameOrBefore(mptStartTime) && taskEndTime.isSameOrAfter(mptEndTime))) {
            await Vehicle.update({nextMptTime: null}, {where: {vehicleNo: vehicle.vehicleNo}});
        }
    }
}


