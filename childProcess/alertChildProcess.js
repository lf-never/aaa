const log = require('../log/winston').logger('Alert Child Process');
const CONTENT = require('../util/content');
const moment = require('moment');
const { Sequelize, Op, QueryTypes } = require('sequelize');
const { sequelizeObj } = require('../db/dbConf')
const { sequelizeSystemObj } = require('../db/dbConf_system')

const { TaskUtils } = require('../services/taskService')

process.on('message', async deviceProcess => {
    log.info(`Message from parent (${moment().format('YYYY-MM-DD HH:mm:ss')}): `, JSON.stringify(deviceProcess, null, 4))
    try {

        const user = deviceProcess.user
        const timeSelected = deviceProcess.timeSelected
        const hub = deviceProcess.hub
        const hubNodeIdList = deviceProcess.hubNodeIdList
        const groupIdList = deviceProcess.groupIdList

        // Driver
        let driverSql = `
            SELECT dph.*, dph.updatedAt as createdAt,
            d.driverName, v.limitSpeed, tt.vehicleNumber, tt.hub, tt.node, tt.groupId, tt.mobileStartTime, tt.mobileEndTime 
            FROM driver_position dph
            LEFT JOIN (
                select vehicleNo, unitId, vehicleType, limitSpeed, deviceId FROM vehicle 
                UNION ALL 
                select vehicleNo, unitId, vehicleType, limitSpeed, deviceId FROM vehicle_history
            ) v ON v.vehicleNo = dph.vehicleNo
            LEFT JOIN (
                select driverId, unitId, nric, driverName, contactNumber, state FROM driver 
                UNION ALL 
                select driverId, unitId, nric, driverName, contactNumber, state FROM driver_history
            ) d ON d.driverId = dph.driverId
            LEFT JOIN (
                SELECT t.hub, t.node, t.groupId, t.driverId, t.vehicleNumber, t.mobileStartTime, t.mobileEndTime FROM task t WHERE 1=1
                ${ user.userType == CONTENT.USER_TYPE.CUSTOMER ? ` AND t.groupId = ${ user.unitId } ` : ` ` }
                AND (
                    ( (Date('${ timeSelected }') BETWEEN Date(t.mobileStartTime) AND Date(t.mobileEndTime)) and t.mobileStartTime is not null )
                    OR 
                    t.driverStatus = 'started'
                )

                union

                select ui.hub, ui.node, ui.groupId, ui.driverId, ui.vehicleNo as vehicleNumber, ui.mobileStartTime, ui.mobileEndTime from urgent_indent ui where 1=1
                ${ user.userType == CONTENT.USER_TYPE.CUSTOMER ? ` AND ui.groupId = ${ user.unitId } ` : ` ` }
                AND (
                    ( (Date('${ timeSelected }') BETWEEN Date(ui.mobileStartTime) AND Date(ui.mobileEndTime)) and ui.mobileStartTime is not null )
                    OR 
                    ui.status = 'started'
                )

            ) tt ON tt.driverId = dph.driverId 
            left join unit u on u.unit = tt.hub and u.subUnit <=> tt.node
            WHERE Date(dph.updatedAt) = ? 
        `
        // if (user.userType.toLowerCase() == 'customer') {
        if (CONTENT.USER_TYPE.CUSTOMER == user.userType) {
            driverSql += ` AND tt.groupId = ${ user.unitId } `
        // } else if (user.userType.toLowerCase() == 'hq' || user.userType.toLowerCase() == 'administrator') {
        } else if ([ CONTENT.USER_TYPE.HQ, CONTENT.USER_TYPE.ADMINISTRATOR, CONTENT.USER_TYPE.LICENSING_OFFICER ].includes(user.userType)) {
            if (hub) {
                driverSql += ` AND tt.hub = '${ hub }' `
            }
            if (hub == null) {
                driverSql += ` AND tt.groupId IN ( ${ groupIdList.join(',') } ) `
            }
        // } else if (user.userType.toLowerCase() == 'unit') {
        } else if (CONTENT.USER_TYPE.UNIT == user.userType) {
            driverSql += ` AND ( u.id IN ( ${ hubNodeIdList.map(item => `'${ item }'`).join(',') } ) AND tt.groupId IS NULL ) `
        }
        
        driverSql += ` AND (dph.updatedAt >= tt.mobileStartTime AND (tt.mobileEndTime is null or tt.mobileEndTime >= dph.updatedAt )) `
        driverSql += ` group by driverId, vehicleNo `

        let driverPositionList = await sequelizeObj.query(driverSql, { type: QueryTypes.SELECT, replacements: [timeSelected] });
        let driverOffenceList = []
        for (let driverPosition of driverPositionList) {
            let alertResult = await TaskUtils.checkoutAlertEvent(
                [ driverPosition ], 
                { 
                    hub: driverPosition.hub, 
                    node: driverPosition.node, 
                    groupId: driverPosition.groupId 
                } 
            )
            driverOffenceList = driverOffenceList.concat(alertResult)
        }

        // Vehicle
        // let vehicleNoList = driverOffenceList.map(item => item.vehicleNo);
        // vehicleNoList = Array.from(new Set(vehicleNoList))
        let deviceSql = `
            SELECT dph.*, dph.updatedAt as createdAt, v.vehicleNo, d.driverName, tt.vehicleNumber, tt.hub, tt.node, tt.groupId, 
            tt.mobileStartTime, tt.mobileEndTime 
            FROM device dph
            LEFT JOIN (
                select vehicleNo, unitId, vehicleType, limitSpeed, deviceId FROM vehicle 
                UNION ALL 
                select vehicleNo, unitId, vehicleType, limitSpeed, deviceId FROM vehicle_history
            ) v ON v.deviceId = dph.deviceId
            LEFT JOIN (
                SELECT t.hub, t.node, t.groupId, t.driverId, t.vehicleNumber, t.mobileStartTime, t.mobileEndTime 
                FROM task t WHERE 1=1
                ${ user.userType == CONTENT.USER_TYPE.CUSTOMER ? ` AND t.groupId = ${ user.unitId } ` : ` ` }
                AND (
                    ( (Date('${ timeSelected }') BETWEEN Date(t.mobileStartTime) AND Date(t.mobileEndTime)) and t.mobileStartTime is not null )
                    OR 
                    t.driverStatus = 'started'
                )

                union

                select ui.hub, ui.node, ui.groupId, ui.driverId, ui.vehicleNo as vehicleNumber, ui.mobileStartTime, ui.mobileEndTime 
                from urgent_indent ui where 1=1
                ${ user.userType == CONTENT.USER_TYPE.CUSTOMER ? ` AND ui.groupId = ${ user.unitId } ` : ` ` }
                AND (
                    ( (Date('${ timeSelected }') BETWEEN Date(ui.mobileStartTime) AND Date(ui.mobileEndTime)) and ui.mobileStartTime is not null )
                    OR 
                    ui.status = 'started'
                )
            ) tt ON tt.vehicleNumber = v.vehicleNo 
            LEFT JOIN (
                select driverId, unitId, nric, driverName, contactNumber, state FROM driver 
                UNION ALL 
                select driverId, unitId, nric, driverName, contactNumber, state FROM driver_history
            ) d ON d.driverId = tt.driverId
            left join unit u on u.unit = tt.hub and u.subUnit <=> tt.node
            WHERE DATE(dph.updatedAt) = ? 
        `
        // if (user.userType.toLowerCase() == 'customer') {
        if (CONTENT.USER_TYPE.CUSTOMER == user.userType) {
            deviceSql += ` AND tt.groupId = ${ user.unitId } `
        // } else if (user.userType.toLowerCase() == 'hq' || user.userType.toLowerCase() == 'administrator') {
        } else if ([ CONTENT.USER_TYPE.HQ, CONTENT.USER_TYPE.ADMINISTRATOR, CONTENT.USER_TYPE.LICENSING_OFFICER ].includes(user.userType)) {
            if (hub) {
                deviceSql += ` AND tt.hub = '${ hub }' `
            }
            if (hub == null) {
                deviceSql += ` AND tt.groupId IS NOT NULL `
            }
        // } else if (user.userType.toLowerCase() == 'unit') {
        } else if (CONTENT.USER_TYPE.UNIT == user.userType) {
            deviceSql += ` AND ( u.id IN ( ${ hubNodeIdList.map(item => `'${ item }'`).join(',') } ) AND tt.groupId IS NULL ) `
        }

        // if (vehicleNoList.length) {
        //     deviceSql += ` AND v.vehicleNo IN (${ vehicleNoList.map(item => `'${ item }'`).join(',') }) `
        // } else {
        //     deviceSql += ` AND 1 = 2 `
        // }

        deviceSql += ` AND (dph.updatedAt >= tt.mobileStartTime AND (tt.mobileEndTime is null or tt.mobileEndTime >= dph.updatedAt)) ` 
        deviceSql += ` group by deviceId `

        
        let deviceOffenceList = []
        let devicePositionList = await sequelizeObj.query(deviceSql, { type: QueryTypes.SELECT, replacements: [timeSelected] });
        for (let devicePosition of devicePositionList) {
            let alertResult = await TaskUtils.checkoutAlertEvent(
                [devicePosition], 
                { 
                    hub: devicePosition.hub, 
                    node: devicePosition.node, 
                    groupId: devicePosition.groupId
                }
            )
            deviceOffenceList = deviceOffenceList.concat(alertResult)
        }
        
        process.send({ driverOffenceList, deviceOffenceList })
        process.exit(0)
    } catch (error) {
        log.error(error);
        process.send({ success: false, error })
    }
})
