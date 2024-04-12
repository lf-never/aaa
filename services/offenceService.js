const log = require('../log/winston').logger('Offence Service');

const utils = require('../util/utils');
const moment = require('moment');
const CONTENT = require('../util/content');

const { Sequelize, Op, QueryTypes } = require('sequelize');
const { sequelizeObj } = require('../db/dbConf')

const { VehicleRelation } = require('../model/vehicleRelation');
const { Device } = require('../model/device');
const { Track } = require('../model/event/track');
const { TrackHistory } = require('../model/event/trackHistory');
const { DriverOffenceHistory } = require('../model/event/driverOffenceHistory');
const { DeviceOffenceHistory } = require('../model/event/deviceOffenceHistory');

module.exports.getEventDashboardInfo = async function (req, res) {
    try {
		const getGroupUserIdList = async function (userId) {
			return await sequelizeObj.query(`
                SELECT userId 
                FROM user_group 
                WHERE groupName = (SELECT groupName FROM user_group WHERE userId = ${ userId });
            `, { type: QueryTypes.SELECT })
		}
		const getLatestTrackList = async function (groupUserIdList) {
			let latestTrackList = await sequelizeObj.query(`
				SELECT t2.*, d.vehicleNo, d.driver, t2.vehicleNo AS mobileVehicleNo, pr.convoy_no AS mobileDriver, pr.sub_appoint  
				FROM track t2 
				LEFT JOIN device d ON d.deviceId = t2.deviceId
				LEFT JOIN position_record pr ON pr.user_id = t2.deviceId AND t2.vehicleNo = pr.vehicleNo
				LEFT JOIN convoy c ON c.convoy_no = pr.convoy_no AND c.vehicleNo = pr.vehicleNo
				WHERE t2.violationType NOT IN ('${ CONTENT.ViolationType.IDLETime }')
				AND (d.creator IN (${ groupUserIdList }) OR c.creator IN (${ groupUserIdList }))
				ORDER BY t2.occTime DESC
			`, { type: QueryTypes.SELECT })

			let differentDeviceIdAndVehicleNoList = [];
			for (let latestTrack of latestTrackList) {
				let ifExist = differentDeviceIdAndVehicleNoList.some(obj => {
					if (obj.deviceId === latestTrack.deviceId && obj.vehicleNo === (latestTrack.dataFrom === 'obd' ? latestTrack.vehicleNo : latestTrack.mobileVehicleNo)) {
						return true;
					}
				})
				if (!ifExist) {
					differentDeviceIdAndVehicleNoList.push({ deviceId: latestTrack.deviceId, vehicleNo: latestTrack.dataFrom === 'obd' ? latestTrack.vehicleNo : latestTrack.mobileVehicleNo });
				}
			}
			
			let resultLatestTrackList = [];
			for (let deviceIdAndVehicleNo of differentDeviceIdAndVehicleNoList) {
				let device = { 
					deviceId: deviceIdAndVehicleNo.deviceId, 
					vehicleNo: deviceIdAndVehicleNo.vehicleNo, 
					hardBraking: {
						eventCount: 0,
						occTime: null
					},
					rapidAcc: {
						eventCount: 0,
						occTime: null
					},
					speeding: {
						eventCount: 0,
						occTime: null
					},
					idle: {
						eventCount: 0,
						occTime: null
					}
				};
				for (let latestTrack of latestTrackList) {
					if (latestTrack.deviceId === deviceIdAndVehicleNo.deviceId 
						&& deviceIdAndVehicleNo.vehicleNo === (latestTrack.dataFrom === 'obd' ? latestTrack.vehicleNo : latestTrack.mobileVehicleNo)) {
						device.mobileVehicleNo = latestTrack.mobileVehicleNo;
						device.driver = latestTrack.driver;
						device.mobileDriver = latestTrack.mobileDriver;
						device.sub_appoint = latestTrack.sub_appoint;
						device.dataFrom = latestTrack.dataFrom;
						
						if (latestTrack.violationType === CONTENT.ViolationType.HardBraking) {
							device.hardBraking = latestTrack
						} else if (latestTrack.violationType === CONTENT.ViolationType.RapidAcc) {
							device.rapidAcc = latestTrack
						} else if (latestTrack.violationType === CONTENT.ViolationType.Speeding) {
							device.speeding = latestTrack
						} else if (latestTrack.violationType === CONTENT.ViolationType.IDLETime) {
							device.idle = latestTrack
						}
					}
				}
				resultLatestTrackList.push(device)
			}

			return resultLatestTrackList;
		}

        let userId = req.cookies.userId;
		let groupUserIdList = await getGroupUserIdList(userId);
        let resultLatestTrackList = await getLatestTrackList(groupUserIdList);

        let result = { list: resultLatestTrackList, hardBraking: 0, rapidAcc: 0, speeding: 0, idleTime: 0, outOfService: 0, parked: 0, onRoad: 0 };
        // calculate different offence count
		for (let track of latestTrackList) {
            if (track.violationType === CONTENT.ViolationType.HardBraking) result.hardBraking += track.count;
            else if (track.violationType === CONTENT.ViolationType.RapidAcc) result.rapidAcc += track.count;
            else if (track.violationType === CONTENT.ViolationType.Speeding) result.speeding += track.count;
            else if (track.violationType === CONTENT.ViolationType.IDLETime) result.idleTime += track.count;
        }
		// find out latest different device & mobile
        let devicePositionList = await Device.findAll({
            where: {
                updatedAt: {
                    [Op.gte]: moment().subtract(5, 'm').format('YYYY-MM-DD HH:mm:ss')
                },
                creator: {
                    [Op.or]: groupUserIdList
                }
            }
        });
		let mobilePositionList = await Driver.findAll({
            where: {
                updatedAt: {
                    [Op.gte]: moment().subtract(5, 'm').format('YYYY-MM-DD HH:mm:ss')
                },
                creator: {
                    [Op.or]: groupUserIdList
                }
            }
        });
		// calculate different device & mobile state count
        for (let position of devicePositionList) {
            if (position.state === CONTENT.DEVICE_STATE.PARKED) result.parked++;
            else if (position.state === CONTENT.DEVICE_STATE.ON_ROAD) result.onRoad++;
        }
        for (let position of mobilePositionList) {
            if (position.state === CONTENT.DEVICE_STATE.PARKED) result.parked++;
            else if (position.state === CONTENT.DEVICE_STATE.ON_ROAD) result.onRoad++;
        }
        return res.json(utils.response(1, result));
    } catch (error) {
        log.error('(getTrackDashboardInfo) : ', error);
        return res.json(utils.response(0, 'Server Error!'));
    }
}

module.exports.getEventHistory = async function (req, res) {
    try {
        let deviceId = req.body.deviceId;
        let trackHistoryList = await TrackHistory.findAll({
            where: {
                deviceId,
                violationType: {
                    [Op.ne]: CONTENT.ViolationType.IDLETime,
                }
            },
            order: [
                ['occTime', 'DESC']
            ]
        })
        return res.json(utils.response(1, trackHistoryList));
    } catch (error) {
        log.error('(getEventHistory) : ', error);
        return res.json(utils.response(0, 'Server Error!'));
    }
}

module.exports.getEventLatestSpeedInfo = async function (req, res) {
    try {
        let deviceId = req.body.deviceId;
        let type = req.body.type;
        let occTime = req.body.occTime;
        let startTime = req.body.startTime;
        let endTime = req.body.endTime;
        let list = [], limitSpeed = 0;
        if (type.toLowerCase() === 'mobile') {
            list = await DriverOffenceHistory.findAll({
                where: {
                    driverId: deviceId,
                    createdAt: {
                        [Op.gte]: moment(startTime).subtract(15, 's').format('YYYY-MM-DD HH:mm:ss'),
                        [Op.lte]: moment(endTime).add(15, 's').format('YYYY-MM-DD HH:mm:ss')
                    },
                },
                order: [
                    ['createdAt', 'ASC']
                ]
            })
            let vehicleRelation = await VehicleRelation.findOne({ where: { driverId: deviceId } })
            limitSpeed = vehicleRelation.limitSpeed
        } else if (type.toLowerCase() === 'obd') {
            list = await DeviceOffenceHistory.findAll({
                where: {
                    deviceId,
                    createdAt: {
                        [Op.gte]: moment(startTime).subtract(15, 's').format('YYYY-MM-DD HH:mm:ss'),
                        [Op.lte]: moment(endTime).add(15, 's').format('YYYY-MM-DD HH:mm:ss')
                    }
                },
                order: [
                    ['createdAt', 'ASC']
                ]
            })
            let vehicleRelation = await VehicleRelation.findOne({ where: { deviceId } })
            limitSpeed = vehicleRelation.limitSpeed
        }
        return res.json(utils.response(1, { list, limitSpeed }));
    } catch (err) {
        log.error('(getEventLatestSpeedInfo) : ', err);
        return res.json(utils.response(0, 'Server Error!'));
    }
}