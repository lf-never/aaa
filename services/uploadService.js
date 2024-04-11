const log = require('../log/winston').logger('Upload Service');
const utils = require('../util/utils');
const CONTENT = require('../util/content');
const conf = require('../conf/conf');

const { Sequelize, Op, QueryTypes } = require('sequelize');
const { sequelizeObj } = require('../db/dbConf')

const path = require('path');
// const fs = require('fs');
const fs = require('graceful-fs');
const moment = require('moment');
const xlsx = require('node-xlsx');
const formidable = require('formidable');
const _ = require('lodash');

const { Driver } = require('../model/driver');
const { Device } = require('../model/device');
const { Vehicle } = require('../model/vehicle');
const { VehicleRelation } = require('../model/vehicleRelation');
const { PermitType } = require('../model/permitType');
const { User } = require('../model/user');	
const { Unit } = require('../model/unit');
const { Friend } = require('../model/friend.js');
const { Waypoint } = require('../model/waypoint.js');
const { OperationRecord } = require('../model/operationRecord.js');

/**
 * https://github.com/node-formidable/formidable
 * https://github.com/mgcrea/node-xlsx#readme
 */

module.exports.uploadDriver = async function (req, res) {
    try {
        const form = formidable({ multiples: true });
		form.parse(req, async (error, fields, files) => {
			if (error) {
				log.error(error)
				return res.json(utils.response(0, 'Upload failed!'));
			}
			log.info('fields: ', JSON.stringify(fields))
			log.info('files: ', JSON.stringify(files))
			// TODO: change to array object(allow multi files upload)
			if (files.constructor !== Array) files.file = [files.file];

			let uploadVehicleList = [], uploadVehicleRelationList = [], uploadUnitList = [];
			let indexOfDriver = 0, indexOfVehicleNo = 1, indexOfUnit = 2, indexOfSubUnit = 3, indexOfLimitSpeed = 4, indexOfDriverName = 5, indexOfPassword = 6, indexOfNric = 7;
			let warnMsgHtml = ``;
			for (let file of files.file) {
				if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
					let list = xlsx.parse(file.path, { cellDates: true });
					// TODO: First sheet's data
					log.info(JSON.stringify(list));
					list = list[0].data; 
					let rowIndex = -1;
					for (let data of list) {
						rowIndex++;
						// First row is title!
						if (rowIndex === 0) {
							if (!checkDriverFile(data, { indexOfDriver, indexOfVehicleNo, indexOfUnit, indexOfSubUnit, indexOfLimitSpeed, indexOfDriverName, indexOfPassword, indexOfNric})) {
								log.warn('Please Select Driver Excel file!')
								return res.json(utils.response(0, 'Please Select Driver Excel file!'));
							}
							continue;
						};

						let unit = data[indexOfUnit] ? data[indexOfUnit].trim() : null;
						let subUnit = data[indexOfSubUnit] ? data[indexOfSubUnit].trim() : null;

						if (!data[indexOfDriver]) {
							log.info('Driver name is empty, jump this row!')
							warnMsgHtml += `Row ${rowIndex + 1}: Driver is empty, jump this row!<br/>`
							continue;
						} else if (!data[indexOfNric]) {
							log.info('Driver nric is empty, jump this row!')
							warnMsgHtml += `Row ${rowIndex + 1}: Driver nric is empty, jump this row!<br/>`
							continue;
						} else if (!unit) {
							warnMsgHtml += `Row ${rowIndex + 1}: Driver unit is empty, jump this row!<br/>`
							continue;
						} else {
							let passwordStr = data[indexOfPassword].toString().trim();
							if (passwordStr) {
								passwordStr = utils.generateMD5Code(passwordStr).toUpperCase();
							}
							let nric = data[indexOfNric].toString().trim();
							if (nric && nric.length > 8) {
								  // 2023-08-29 Encrypt the nric.
								  nric = utils.generateAESCode(nric).toUpperCase();
							}


							uploadVehicleRelationList.push({ 
								loginName: data[indexOfDriver].toString().trim(), 
								driverName: data[indexOfDriverName].toString().trim(), 
								nric: nric,
								password: passwordStr, 
								vehicleNo: data[indexOfVehicleNo] ? data[indexOfVehicleNo].trim() : null, 
								limitSpeed: data[indexOfLimitSpeed], 
								creator: req.cookies.userId,
								unit: unit, 
								subUnit: subUnit
							})
							if (data[indexOfVehicleNo]) {
								uploadVehicleList.push({
									creator: req.cookies.userId, 
									vehicleNo: data[indexOfVehicleNo].trim(), 
									limitSpeed: data[indexOfLimitSpeed], 
									unit: unit, 
									subUnit: subUnit
								})
							}
							if (data[indexOfUnit]) {
								// uploadUnitList.push({ 
								// 	unit: data[indexOfUnit].trim(), 
								// 	subUnit: data[indexOfSubUnit] ? data[indexOfSubUnit].trim() : null 
								// })
								uploadUnitList.push(data[indexOfUnit].trim() + ',' + (data[indexOfSubUnit] ? data[indexOfSubUnit].trim() : ''))
							}
						}
					}
				} else {
					return res.json(utils.response(0, 'Please Use Excel file!'));
				}
			}	
			
			// TODO: check loginName from excel(if exist same loginName)
			let loginNameList = uploadVehicleRelationList.map(item => item.loginName.toLowerCase().trim())
			let _loginNameList = Array.from(new Set(loginNameList));
			if (loginNameList.length != _loginNameList.length) {

				// TODO: find out same loginName
				loginNameList = _.sortBy(loginNameList)
				let preItem = null, preItemList = []
				for (let item of loginNameList) {
					if (!preItem || preItem != item) preItem = item;
					else if (preItem == item) {
						preItem = null;
						preItemList.push(item)
					}
				}

				log.warn(`Excel exist same login name ${ preItemList }!`)
				return res.json(utils.response(1, `Excel exist same login name ${ preItemList }!`));
			} else {
				// If exist same loginName, will update DB

				// let result = await User.findAndCountAll({ where: { username: loginNameList } })
				// if (result.count > 0) {
				// 	let data = result.rows.map(item => item.username);
				// 	data = Array.from(new Set(data))
				// 	log.warn(`Login name ${ data } already exist!`)
				// 	return res.json(utils.response(1, `Login name ${ data } already exist!`));
				// }
			}

			await sequelizeObj.transaction(async transaction => {
				const updateUnit = async function (uploadUnitList) {
					if (!uploadUnitList.length) return;
					uploadUnitList = Array.from(new Set(uploadUnitList));
					let newUploadUnitList = []
					for (let uploadUnit of uploadUnitList) {
						newUploadUnitList.push({ 
							unit: uploadUnit.split(',')[0],
							subUnit: uploadUnit.split(',')[1] ? uploadUnit.split(',')[1] : null,
						})
					}
					uploadUnitList = newUploadUnitList;

					let unitList = await Unit.findAll();
					for (let uploadUnit of uploadUnitList) {
						for (let unit of unitList) {
							if (
								(unit.unit.toLowerCase() === uploadUnit.unit?.toLowerCase()) 
								&& 
								(unit.subUnit?.toLowerCase() === uploadUnit.subUnit?.toLowerCase())
							) {
								uploadUnit.id = unit.id;
							}
						}
					}
					await Unit.bulkCreate(uploadUnitList, { updateOnDuplicate: ['unit', 'subUnit'] })
				}
				const updateVehicle = async function (uploadVehicleList, unitList) {
					if (!uploadVehicleList.length) return;

					for (let vehicle of uploadVehicleList) {
						for (let unit of unitList) {
							if (
								(unit.unit.toLowerCase() === vehicle.unit?.toLowerCase()) 
								&& 
								(unit.subUnit?.toLowerCase() === vehicle.subUnit?.toLowerCase())
							) {
								vehicle.unitId = unit.id;
								break;
							}
						}
					}
					await Vehicle.bulkCreate(uploadVehicleList, { updateOnDuplicate: ['unitId', 'limitSpeed'] });
				}
				const updateDriver = async function (uploadVehicleRelationList, unitList) {
					if (!uploadVehicleRelationList.length) return;

					let driverList = await Driver.findAll();
					let newDriverNameList = []
					for (let uploadDriver of uploadVehicleRelationList) {
						let findDriver = false;
						for (let driver of driverList) {
							if (driver.loginName.toLowerCase() === uploadDriver.loginName.toLowerCase()) {
								// TODO: find same driverName, update driverId
								uploadDriver.driverId = driver.driverId;
								// TODO: update password
								await User.update({ password: uploadDriver.password }, { where: { driverId: driver.driverId } })
								findDriver = true;
							}
						}
						if (!findDriver) {
							newDriverNameList.push(uploadDriver.loginName)
						}
						for (let unit of unitList) {
							if (
								(unit.unit.toLowerCase() === uploadDriver.unit?.toLowerCase()) 
								&& 
								(unit.subUnit?.toLowerCase() === uploadDriver.subUnit?.toLowerCase())
							) {
								// TODO: find same unit, update unitId
								uploadDriver.unitId = unit.id;
								break;
							}
						}
					}
					await Driver.bulkCreate(uploadVehicleRelationList, { updateOnDuplicate: ['unitId', 'driverName'] })
					let latestDriverList = await Driver.findAll();
					let newDriverList = latestDriverList.filter(driver => newDriverNameList.includes(driver.loginName))

					// Init new driver password;
					newDriverList.some(newDriver => {
						uploadVehicleRelationList.some(uploadDriver => {
							if (newDriver.loginName === uploadDriver.loginName) {
								newDriver.password = uploadDriver.password
								return true;
							}
						})
					});
					
					return newDriverList
				}
				const createDriverAccount = async function (newDriverList) {
					if (!newDriverList || !newDriverList.length) return;

					// TODO: create account
					let newUserList = []
					for (let newDriver of newDriverList) {
						newUserList.push({ driverId: newDriver.driverId, username: newDriver.loginName, 
							fullName: newDriver.loginName, nric: newDriver.nric,  unitId:newDriver.unitId, 
							password: utils.generateMD5Code(newDriver.password), userType: CONTENT.USER_TYPE.MOBILE, 
							role: "TO"
						})
					}
					if (newUserList.length) {
						await User.bulkCreate(newUserList);
					}
				}
				const updateVehicleRelation = async function (uploadVehicleRelationList) {
					if (!uploadVehicleRelationList.length) return;

					let vehicleRelationList = await VehicleRelation.findAll();
					let driverList = await Driver.findAll();
					for (let uploadVehicleRelation of uploadVehicleRelationList) {
						// TODO: update driverId
						if (!uploadVehicleRelation.driverId) {
							driverList.some(driver => {
								if (driver.driverName === uploadVehicleRelation.driverName) {
									uploadVehicleRelation.driverId = driver.driverId
									return true;
								}
							})
						}
						// TODO: update uploadVehicleRelation with exist data in db
						for (let vehicleRelation of vehicleRelationList) {
							if (uploadVehicleRelation.driverId === vehicleRelation.driverId) {
								// TODO: update vehicleNo
								if (!vehicleRelation.vehicleNo) {
									uploadVehicleRelation.id = vehicleRelation.id;
								} else {
									if (uploadVehicleRelation.vehicleNo) {
										if (vehicleRelation.vehicleNo === uploadVehicleRelation.vehicleNo) {
											uploadVehicleRelation.id = vehicleRelation.id;
										} else {
											// New vehicleRelation here
										}
									} else {
										// TODO: uploadVehicleRelation.vehicleNo is null, Auto mate db data
										uploadVehicleRelation.vehicleNo = vehicleRelation.vehicleNo;
										uploadVehicleRelation.id = vehicleRelation.id;
									}
								}
								// TODO: update limitSpeed
								if (!uploadVehicleRelation.limitSpeed) uploadVehicleRelation.limitSpeed = vehicleRelation.limitSpeed;
								continue;
							}
						}
					}
					await VehicleRelation.bulkCreate(uploadVehicleRelationList, { updateOnDuplicate: ['limitSpeed', 'vehicleNo'] });
				}

				// TODO: update unit
				await updateUnit(uploadUnitList);
				let unitList = await Unit.findAll();
				// TODO: update vehicle
				await updateVehicle(uploadVehicleList, unitList);
				// TODO: update driver
				let newDriverList = await updateDriver(uploadVehicleRelationList, unitList);
				// TODO：create mobile user account
				await createDriverAccount(newDriverList);
				// TODO: update vehicleRelation
				await updateVehicleRelation(uploadVehicleRelationList);
				
				await OperationRecord.create({
					operatorId: req.cookies.userId,
					businessType: 'Upload Driver',
					businessId: null,
					optType: 'Upload',
					afterData: `${ JSON.stringify(newDriverList) }`, 
					optTime: moment().format('YYYY-MM-DD HH:mm:ss'),
					remarks: null
				})
			}).catch(error => {
				throw error
			})
			return res.json(utils.response(1, warnMsgHtml ? warnMsgHtml : 'Success'));
		});
    } catch (error) {
        log.error('(uploadDriver) : ', error);
        return res.json(utils.response(0, error));
    }
}

module.exports.uploadVehicle = async function (req, res) {
	const form = formidable({ multiples: true, maxFileSize: 10 * 1024 * 1024, keepExtensions: true });
	form.parse(req, async (error, fields, files) => {
		if (error) {
			log.error(error)
			return res.json(utils.response(0, 'Upload failed!'));
		}
		log.info('fields: ', JSON.stringify(fields))
		log.info('files: ', JSON.stringify(files))
		// TODO: change to array object(allow multi files upload)
		if (files.file.constructor !== Array) files.file = [files.file];

		let uploadVehicleList = [], uploadVehicleRelationList = [], uploadDeviceList = [], uploadUnitList = [], permitTypeList = [];
		let indexOfVehicleNo = 0, indexOfHardWareID = 1, indexOfUnit = 2, indexOfSubUnit = 3, indexOfLimitSpeed = 4;
		let indexOfVehicleType = 5, indexOfPermitType = 6, indexOfTotalMileage = 7, indexOfDimensions = 8, indesOfAvidate = 9;
		try {
			let warnMsgHtml = ``;
			for (let file of files.file) {
				if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
					let list = xlsx.parse(file.path, { cellDates: true });
					// TODO: First sheet's data
					log.info(JSON.stringify(list));
					list = list[0].data; 
					let rowIndex = -1;
					for (let data of list) {
						rowIndex++;

						// First row is title!
						if (rowIndex === 0) {
							if (!checkVehicleFile(data, { indexOfVehicleNo, indexOfHardWareID, indexOfUnit, indexOfSubUnit, indexOfLimitSpeed, indexOfVehicleType, indexOfPermitType, indexOfTotalMileage, indexOfDimensions, indesOfAvidate})) {
								log.warn('Please Select Vehicle Excel file!')
								return res.json(utils.response(0, 'Please Select Vehicle Excel file!'));
							}
							continue;
						}
						let vehicleNo = data[indexOfVehicleNo] ? data[indexOfVehicleNo].trim() : '';
						let unit = data[indexOfUnit] ? data[indexOfUnit].trim() : null;
						let subUnit = data[indexOfSubUnit] ? data[indexOfSubUnit].trim() : null;

						if (!vehicleNo) {
							log.info('Vehicle No is empty, jump this row!')
							warnMsgHtml += `Row ${rowIndex + 1}: Vehicle No is empty, jump this row!<br/>`
							continue;
						} else if (!unit) {
							warnMsgHtml += `Row ${rowIndex + 1}: Vehicle unit is empty, jump this row!<br/>`
							continue;
						} else {
							let hardWareID = data[indexOfHardWareID] ? data[indexOfHardWareID].trim() : null;
							let totalMileage = data[indexOfTotalMileage];
							if (totalMileage) {
								totalMileage += '';
							} else {
								totalMileage = '0';
							}

							let limitSpeed = data[indexOfLimitSpeed];
							if (limitSpeed) {
								limitSpeed += '';
							} else {
								limitSpeed = '60';
							}

							let existVehicle = uploadVehicleList.find(item => item.vehicleNo == vehicleNo);
							if (!existVehicle) {
								uploadVehicleList.push({ 
									vehicleNo: vehicleNo, 
									unit: unit, 
									subUnit: subUnit, 
									deviceId: hardWareID ? hardWareID : null, 
									vehicleType: data[indexOfVehicleType].trim(), 
									limitSpeed: limitSpeed.trim(), // While xlsx is null here
									permitType: data[indexOfPermitType].trim(), 
									totalMileage: totalMileage.trim(), 
									dimensions: data[indexOfDimensions].trim(), 
									nextAviTime: data[indesOfAvidate] ? data[indesOfAvidate].trim() : null, 
									creator: req.cookies.userId 
								})
								uploadVehicleRelationList.push({ 
									vehicleNo: vehicleNo, 
									deviceId: hardWareID ? hardWareID : null, 
									limitSpeed: limitSpeed.trim(),  // While xlsx is null here
									unit: unit, 
									subUnit: subUnit
								})
								permitTypeList.push({
									vehicleType: data[indexOfVehicleType].trim(), 
									permitType: data[indexOfPermitType].trim()
								});
							}

							if (data[indexOfUnit]) {
								let existUnit = uploadUnitList.find(item => (item.unit == unit && item.subUnit == subUnit));
								if (!existUnit) {
									// uploadUnitList.push({
									// 	unit: data[indexOfUnit].trim(),
									// 	subUnit: data[indexOfSubUnit] ? data[indexOfSubUnit].trim() : null
									// })
									uploadUnitList.push(data[indexOfUnit].trim() + ',' + (data[indexOfSubUnit] ? data[indexOfSubUnit].trim() : ''))
								}
							}
							if (hardWareID) {
								let existDevice = uploadDeviceList.find(item => (item.deviceId == hardWareID));
								if (!existDevice) {
									uploadDeviceList.push({  
										deviceId: hardWareID,
										creator: req.cookies.userId
									})
								}
							}
						}
					}
				} else {
					return res.json(utils.response(0, 'Please Use Excel file!'));
				}
			}
			await sequelizeObj.transaction(async transaction => {
				const updateUnit = async function (uploadUnitList) {
					if (!uploadUnitList.length) return;

					uploadUnitList = Array.from(new Set(uploadUnitList));
					let newUploadUnitList = []
					for (let uploadUnit of uploadUnitList) {
						newUploadUnitList.push({ 
							unit: uploadUnit.split(',')[0],
							subUnit: uploadUnit.split(',')[1] ? uploadUnit.split(',')[1] : null,
						})
					}
					uploadUnitList = newUploadUnitList;
					
					let unitList = await Unit.findAll();
					for (let uploadUnit of uploadUnitList) {
						for (let unit of unitList) {
							if (
								(unit.unit.toLowerCase() === uploadUnit.unit?.toLowerCase()) 
								&& 
								(unit.subUnit?.toLowerCase() === uploadUnit.subUnit?.toLowerCase())
							) {
								uploadUnit.id = unit.id;
							}
						}
					}
					await Unit.bulkCreate(uploadUnitList, { updateOnDuplicate: ['unit', 'subUnit'] })
				}
				const updateVehicle = async function (uploadVehicleList, unitList) {
					if (!uploadVehicleList.length) return;

					for (let vehicle of uploadVehicleList) {
						for (let unit of unitList) {
							if (
								(unit.unit.toLowerCase() === vehicle.unit?.toLowerCase()) 
								&& 
								(unit.subUnit?.toLowerCase() === vehicle.subUnit?.toLowerCase())
							) {
								vehicle.unitId = unit.id;
								break;
							}
						}
					}
					await Vehicle.bulkCreate(uploadVehicleList, { updateOnDuplicate: ['unitId', 'deviceId', 'limitSpeed', 'vehicleType', 'permitType', 'dimensions', 'totalMileage', 'nextAviTime'] });
				}
				const updateDevice = async function (uploadDeviceList) {
					if (!uploadDeviceList.length) return;

					await Device.bulkCreate(uploadDeviceList, { updateOnDuplicate: ['deviceId'] });
				}
				const updateVehicleRelation = async function (uploadVehicleRelationList) {
					if (!uploadVehicleRelationList.length) return;

					let vehicleRelationList = await VehicleRelation.findAll();
					for (let uploadVehicleRelation of uploadVehicleRelationList) { 
						for (let vehicleRelation of vehicleRelationList) {
							if (uploadVehicleRelation.vehicleNo === vehicleRelation.vehicleNo) {
								// TODO: once find same vehicleNo, just overwrite the db
								uploadVehicleRelation.id = vehicleRelation.id;
								break;
							} 
						}
					}
					await VehicleRelation.bulkCreate(uploadVehicleRelationList, { updateOnDuplicate: ['limitSpeed', 'deviceId'] })
				}

				const updatePermittype = async function (permitTypeList) {
					if (permitTypeList.length == 0) return

					let newPermitList = [];
					for (let temp of permitTypeList) { 
						let permit = temp.permitType;
						let vehicleType = temp.vehicleType;
						
						let vehicleTaskList = await sequelizeObj.query(`
							SELECT * FROM permittype p
							WHERE p.permitType = ? AND FIND_IN_SET(?, p.vehicleType)
						`, { 
							type: QueryTypes.SELECT, 
							replacements: [
								permit, vehicleType
						]})
						if (vehicleTaskList && vehicleTaskList.length > 0) {
							continue;
						} else {
							let oldPermitType = await PermitType.findOne({where: {permitType: permit}});
							let permitType = {};
							if (oldPermitType) {
								permitType = {permitType: permit, vehicleType: oldPermitType.vehicleType + ',' + vehicleType};
							} else {
								permitType = {permitType: permit, vehicleType: vehicleType};
							}

							newPermitList.push(permitType);
						}
					}

					await PermitType.bulkCreate(newPermitList, { updateOnDuplicate: ['vehicleType'] })
				}

				// TODO: update unit
				await updateUnit(uploadUnitList);
				let unitList = await Unit.findAll();
				// TODO: update vehicle
				await updateVehicle(uploadVehicleList, unitList);
				// TODO: update device
				await updateDevice(uploadDeviceList);
				// TODO: update vehicleRelation
				await updateVehicleRelation(uploadVehicleRelationList);

				await updatePermittype(permitTypeList);

				await OperationRecord.create({
					operatorId: req.cookies.userId,
					businessType: 'Upload Vehicle',
					businessId: null,
					optType: 'Upload',
					afterData: `${ JSON.stringify(uploadDeviceList) }`, 
					optTime: moment().format('YYYY-MM-DD HH:mm:ss'),
					remarks: null
				})

				return res.json(utils.response(1, warnMsgHtml ? warnMsgHtml : 'Success'));
			}).catch(error => {
				log.error('(uploadVehicle) : ', error);
				return res.json(utils.response(0, error));
			});
		} catch (error) {
			log.error('(uploadVehicle) : ', error);
			return res.json(utils.response(0, error));
		}			
	});
}

module.exports.uploadWaypoint = async function (req, res) {
    try {
        const form = formidable({ multiples: true, maxFileSize: 10 * 1024 * 1024, keepExtensions: true });
		form.parse(req, async (error, fields, files) => {
			if (error) {
				log.error(error)
				return res.json(utils.response(0, 'Upload failed!'));
			}
			log.info('fields: ', JSON.stringify(fields))
			log.info('files: ', JSON.stringify(files))
			// TODO: change to array object(allow multi files upload)
			if (files.file.constructor !== Array) files.file = [files.file];

			let uploadWaypointList = [];
			let indexOfWaypointName = 0, indexOfLat = 1, indexOfLng = 2;
			for (let file of files.file) {
				if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
					let list = xlsx.parse(file.path, { cellDates: true });
					// TODO: First sheet's data
					log.info(JSON.stringify(list));
					list = list[0].data; 
					let rowIndex = -1;
					for (let data of list) {
						rowIndex++;
						// First row is title!
						if (rowIndex === 0) {
							if (!checkWaypointFile(data, { indexOfWaypointName, indexOfLat, indexOfLng })) {
								log.warn('Please Select Waypoint Excel file!')
								return res.json(utils.response(0, 'Please Select Waypoint Excel file!'));
							}
							continue;
						}

						if (!data[indexOfWaypointName]) {
							log.info('Waypoint is empty, jump this row!')
							continue;
						} else {
							uploadWaypointList.push({ 
								waypointName: data[indexOfWaypointName].trim(),
								lat: data[indexOfLat],
								lng: data[indexOfLng],
								creator: req.cookies.userId,
							});
						}
					}
				} else {
					return res.json(utils.response(0, 'Please Use Excel file!'));
				}
			}
			await sequelizeObj.transaction(async transaction => {
				const updateWaypointList = async function (uploadWaypointList) {
					if (!uploadWaypointList.length) return;

					let waypointList = await Waypoint.findAll();
					for (let uploadWaypoint of uploadWaypointList) {
						for (let waypoint of waypointList) {
							if (uploadWaypoint.waypointName.toLowerCase() === waypoint.waypointName.toLowerCase()) {
								uploadWaypoint.id = waypoint.id;
								break
							}
						}
					}
					await Waypoint.bulkCreate(uploadWaypointList, { updateOnDuplicate: ['lat', 'lng', 'creator'] });
				}

				// TODO: update waypoint
				await updateWaypointList(uploadWaypointList);
			}).catch(error => {
				throw error
			});
			return res.json(utils.response(1, 'Success'));			
		});
    } catch (err) {
        log.error('(uploadVehicle) : ', err);
        return res.json(utils.response(0, 'Server error!'));
    }
}

const checkFilePath = function (path) {
    try {
        if (!fs.existsSync(path)) fs.mkdirSync(path);
    } catch (error) {
        throw error
    }
}
const checkFileExist = function (filePath) {
    try {
        return fs.existsSync(filePath);
    } catch (error) {
        throw error
    }
}

module.exports.uploadImage = async function (req, res) {
	try {
		const form = formidable({ multiples: false, maxFileSize: 10 * 1024 * 1024, keepExtensions: true });
		form.parse(req, async (error, fields, files) => {
			if (error) {
				log.error(error)
				return res.json(utils.response(0, 'Upload failed!'));
			}
			log.info('fields: ', JSON.stringify(fields))
			log.info('files: ', JSON.stringify(files))

			let folderPath = './public/resources/upload/notification';
			checkFilePath(folderPath);
	
			try {
				let newFileName = `${ utils.generateUniqueKey() }.${ files.file.type.split('/')[1] }`
				let filePath = `${ folderPath }/${ newFileName }`
				let result = checkFileExist(filePath)
				if (result) {
					return res.json(utils.response(0, 'File name already exist.'));
				} else {
					fs.copyFileSync(files.file.path, filePath)
					fs.unlinkSync(files.file.path)
					return res.json(utils.response(1, newFileName));
				}
			} catch (error) {
				log.error('(uploadVehicle) : ', error);
				return res.json(utils.response(0, error));
			}			
		});
	} catch (error) {
		log.error(error)
		return res.json(utils.response(0, 'Server error!')); 
	}
}

const checkDriverFile = function (titleData, indexObj) {
	if (!titleData[indexObj.indexOfDriver]?.trim().toLowerCase().includes('driver')) return false;
	if (!titleData[indexObj.indexOfVehicleNo]?.trim().toLowerCase().includes('vehicle')) return false;
	if (!titleData[indexObj.indexOfUnit]?.trim().toLowerCase().includes('unit')) return false;
	if (!titleData[indexObj.indexOfSubUnit]?.trim().toLowerCase().includes('sub-unit')) return false;
	if (!titleData[indexObj.indexOfLimitSpeed]?.trim().toLowerCase().includes('speed')) return false;
	if (!titleData[indexObj.indexOfDriverName]?.trim().toLowerCase().includes('name')) return false;
	if (!titleData[indexObj.indexOfPassword]?.trim().toLowerCase().includes('password')) return false;
	if (!titleData[indexObj.indexOfNric]?.trim().toLowerCase().includes('nric')) return false;
	return true;
}

const checkVehicleFile = function (titleData, indexObj) {
	if (!titleData[indexObj.indexOfVehicleNo]?.trim().toLowerCase().includes('vehicle')) return false;
	if (!titleData[indexObj.indexOfHardWareID]?.trim().toLowerCase().includes('hardware')) return false;
	if (!titleData[indexObj.indexOfUnit]?.trim().toLowerCase().includes('unit')) return false;
	if (!titleData[indexObj.indexOfSubUnit]?.trim().toLowerCase().includes('sub-unit')) return false;
	if (!titleData[indexObj.indexOfLimitSpeed]?.trim().toLowerCase().includes('speed')) return false;

	if (!titleData[indexObj.indexOfVehicleType]?.trim().toLowerCase().includes('vehicletype')) return false;
	if (!titleData[indexObj.indexOfPermitType]?.trim().toLowerCase().includes('permittype')) return false;
	if (!titleData[indexObj.indexOfTotalMileage]?.trim().toLowerCase().includes('totalmileage')) return false;
	if (!titleData[indexObj.indexOfDimensions]?.trim().toLowerCase().includes('dimensions')) return false;
	if (!titleData[indexObj.indesOfAvidate]?.trim().toLowerCase().includes('avi')) return false;
	return true;
}

const checkWaypointFile = function (titleData, indexObj) {
	if (!titleData[indexObj.indexOfWaypointName]?.trim().toLowerCase().includes('name')) return false;
	if (!titleData[indexObj.indexOfLat]?.trim().toLowerCase().includes('latitude')) return false;
	if (!titleData[indexObj.indexOfLng]?.trim().toLowerCase().includes('longitude')) return false;
	return true;
}