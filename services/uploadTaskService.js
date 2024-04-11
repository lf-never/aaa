const log = require('../log/winston').logger('Upload Service');
const utils = require('../util/utils');
const CONTENT = require('../util/content');
const conf = require('../conf/conf');

const { Sequelize, Op, QueryTypes } = require('sequelize');
const { sequelizeObj } = require('../db/dbConf')

const { sequelizeSystemObj } = require('../db/dbConf_system')

const path = require('path');
// const fs = require('fs');
const fs = require('graceful-fs');
const moment = require('moment');
const xlsx = require('node-xlsx');
const formidable = require('formidable');

const { CheckList } = require('../model/checkList');
const { Driver } = require('../model/driver');
const { Vehicle } = require('../model/vehicle');
const { User } = require('../model/user');	
const { Unit } = require('../model/unit');
const { MtAdmin } = require('../model/mtAdmin');
const { Task } = require('../model/task');
const { loan } = require('../model/loan');

const _SystemLocation = require('../model/system/location');
const { MT_RAC } = require('../model/mtRac');

/**
 * https://github.com/node-formidable/formidable
 * https://github.com/mgcrea/node-xlsx#readme
 */

const SUPPORT_PURPOSE = ["Training"];

module.exports = {
    uploadMBTask: function (req, res) {
        try {
            const form = formidable({ multiples: true });
            form.parse(req, async (error, fields, files) => {
                if (error) {
                    log.error(error)
                    return res.json(utils.response(0, 'Upload failed!'));
                }
                // log.info('fields: ', JSON.stringify(fields))
                // log.info('files: ', JSON.stringify(files))
                // TODO: change to array object(allow multi files upload)
                if (files.constructor !== Array) files.file = [files.file];

                let fileDataList = [];
                for (let file of files.file) {
                    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                        let list = xlsx.parse(file.path, { cellDates: true });
                        // log.info(JSON.stringify(list));
                        list = list[0].data; 
                        let sheetData = await parseMBTaskData(list, false);
                        fileDataList = fileDataList.concat(sheetData);
                    } else {
                        return res.json(utils.response(0, 'Please Use Excel file!'));
                    }
                }
                if (fileDataList.length > 0) {
                    let mbTaskList = await checkMBTask(fileDataList, false);
                    let errorTaskList = mbTaskList.filter(item => item.errorMsg != null && item.errorMsg !='');
                    let errorMsgHtml = ``;
                    if (errorTaskList && errorTaskList.length > 0) {
                        for (let errorTask of errorTaskList) {
                            errorMsgHtml += `Row ${errorTask.row}: ${errorTask.errorMsg}<br/>`
                        }
                        return res.json(utils.response(0, errorMsgHtml));
                    } else  {
                        let newMBTaskList = [];
                        let newLocationList = [];

                        //let allUnitList = await Unit.findAll();
                        let allSystemLocation = await _SystemLocation.Location.findAll();
                        let indentIdArray = [];
                        //build new mbTask
                        for (let mbTask of mbTaskList) {
                            let newMBTask = {dataType: 'mb', category: 'MV', serviceMode: 'Others', unitId: mbTask.unitId};

                            let lowerReportingLocation = mbTask.reportingLocation ? mbTask.reportingLocation.toLowerCase() : '';
                            let reportingLocationObj = allSystemLocation.find(item => item.locationName.toLowerCase() == lowerReportingLocation);
                            if (!reportingLocationObj) {
                                reportingLocationObj = {locationName: mbTask.reportingLocation, secured: 0, lat: '0.0', lng: '0.0', zip: '460139', country: 'Singapore'}
                                newLocationList.push(reportingLocationObj);
                                allSystemLocation.push(reportingLocationObj);
                            } 
                            newMBTask.reportingLocation = reportingLocationObj.locationName;
                            newMBTask.reportingLocationLat = reportingLocationObj.lat
                            newMBTask.reportingLocationLng = reportingLocationObj.lng

                            let lowerDestinationLocation = mbTask.destinationLocation ? mbTask.destinationLocation.toLowerCase() : '';
                            let destinationLocationObj = allSystemLocation.find(item => item.locationName.toLowerCase() == lowerDestinationLocation);
                            if (!destinationLocationObj) {
                                destinationLocationObj = {locationName: mbTask.destinationLocation, secured: 0, lat: '0.0', lng: '0.0', zip: '460139', country: 'Singapore'}
                                newLocationList.push(destinationLocationObj);
                                allSystemLocation.push(destinationLocationObj);
                            } 
                            newMBTask.destination = destinationLocationObj.locationName;
                            newMBTask.destinationLat = reportingLocationObj.lat
                            newMBTask.destinationLng = reportingLocationObj.lng

                            newMBTask.purpose = mbTask.purpose
                            newMBTask.activityName = mbTask.activityName
                            newMBTask.vehicleType = mbTask.vehicleType
                            newMBTask.poc = mbTask.pocOfficer
                            newMBTask.mobileNumber = mbTask.pocContactNo
                            newMBTask.mbUnit = mbTask.pocUnit

                            mbTask.startDate = mbTask.startDate ? mbTask.startDate+'' : '';
                            mbTask.endDate = mbTask.endDate ? mbTask.endDate+'' : '';
                            newMBTask.startDate = moment(mbTask.startDate.trim() + ' ' + mbTask.startTime.trim(), 'DDMMYYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');
                            newMBTask.endDate = moment(mbTask.endDate.trim() + ' ' + mbTask.endTime.trim(), 'DDMMYYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');

                            let indentId = null;
                            let indentIdIndex = 1;
                            if (mbTask.indentId) {
                                let indentIdObj = indentIdArray.find(item => item.key == mbTask.indentId);
                                if (indentIdObj) {
                                    indentId = indentIdObj.value;
                                    indentIdIndex = indentIdObj.index;
                                }
                            }
                            if (!indentId) {
                                indentId = moment().format("YYMM") + "-" + utils.GenerateIndentID1();
                            }

                            let driverNum = mbTask.driverNum !=null && mbTask.driverNum != '' ? mbTask.driverNum : 0;
                            let vehicleNum = mbTask.vehicleNum && mbTask.vehicleNum != '0' ? mbTask.vehicleNum : 0;
                            driverNum = Number(driverNum);
                            vehicleNum = Number(vehicleNum);

                            let taskNum = Number(driverNum) > Number(vehicleNum) ? Number(driverNum) : Number(vehicleNum);
                            
                            for (let index = 0; index < taskNum; index++) {
                                let temp = {...newMBTask};
                                temp.driverNum = 0;
                                temp.needVehicle = 0;
                                if (driverNum >= (index + 1)) {
                                    temp.driverNum = 1
                                }
                                if (vehicleNum >= (index + 1)) {
                                    temp.needVehicle = 1;
                                }

                                if ((indentIdIndex+"").length == 1) {
                                    temp.indentId = indentId + "-00" + indentIdIndex;
                                } else if ((indentIdIndex+"").length == 2) {
                                    temp.indentId = indentId + "-0" + indentIdIndex;
                                } else {
                                    temp.indentId = indentId + "-" + indentIdIndex;
                                }
                                
                                newMBTaskList.push(temp);
                                indentIdIndex++;
                            }

                            if (mbTask.indentId) {
                                let indentIdObj = indentIdArray.find(item => item.key == mbTask.indentId);
                                if (indentIdObj) {
                                    indentIdObj.index = indentIdIndex;
                                } else {
                                    indentIdArray.push({key: mbTask.indentId, value: indentId, index: indentIdIndex});
                                }
                            }
                        }
                        //create new system location
                        await _SystemLocation.Location.bulkCreate(newLocationList);
                        //create new mbTask
                        let createResult = await MtAdmin.bulkCreate(newMBTaskList, {returning: true});

                        return res.json(utils.response(1, 'Success'));
                    }
                } else {
                    return res.json(utils.response(0, 'File is empty!'));
                }
                return res.json(utils.response(1, 'Success'));
            });
        } catch (error) {
            log.error('(uploadDriver) : ', error);
            return res.json(utils.response(0, error));
        }
    },
    downloadMBTask: async function (req, res) {
        try {
            let option = req.body;
            let userId = req.cookies.userId;
            let user = await User.findOne({ where: { userId: userId } });
            if(!user)  return res.json(utils.response(0, `The user does not exist.`));
            if(user.unitId){
                let unit = await Unit.findOne({ where: { id: user.unitId } })
                if(unit.subUnit){
                    option.hub = unit.unit;
                    option.node = unit.subUnit;
                } else {
                    option.hub = unit.unit;
                }
            }
        
            // TODO: Get download data
            let MBTaskList = await getDownloadMBTaskData(option);

            // TODO: Generate xlsx file
            let fileName = moment().format('YYYYMMDDHHmm') + '-MobiusTask.xlsx';
            let baseFilePath = './public/resources/download/'
            // TODO: Check folder
            if(!fs.existsSync(baseFilePath)) fs.mkdirSync(baseFilePath);
            let filePath = path.join(baseFilePath, fileName)
            await generateMBTaskXlsx(filePath, MBTaskList);

            // TODO: Download xlsx file by stream
            const rs = fs.createReadStream(filePath);
            res.writeHead(200, {
                'Content-Type': 'application/force-download',
                'Content-Disposition': 'attachment; filename=' + fileName
            });
            rs.pipe(res);
        } catch (error) {
            log.error(error)
            return res.json(utils.response(0, error));
        }
    },
    updateMBTask: function (req, res) {
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
                if (files.constructor !== Array) files.file = [ files.file ];

                let fileDataList = [];
                for (let file of files.file) {
                    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                        let list = xlsx.parse(file.path, { cellDates: true });
                        // log.info(JSON.stringify(list));
                        list = list[0].data; 
                        let sheetData = parseMBTaskData2(list, true);
                        fileDataList = fileDataList.concat(sheetData);
                    } else {
                        return res.json(utils.response(0, 'Please Use Excel file!'));
                    }
                }
                if (fileDataList.length) {
                    let mbTaskList = await checkMBTask2(fileDataList, true);

                    // TODO: 
                    // 0、Check id, if null, ignore and remind back html
                    // 1、Check task status again, if started, ignore and remind back html
                    // 2、Check hub/node by id, and update
                    // 3、Check vehicleType by id, and update(if change, need clear driver if already assigned)
                    // 4、Check location by id, and update
                    // 5、Check start/end dateTime by id, and update

                    // log.info(JSON.stringify(mbTaskList, null, 4))
                    if (mbTaskList.length) {
                        let errorTaskList = mbTaskList.filter(item => item.errorMsg != null && item.errorMsg !='');
                        let errorMsgHtml = ``;
                        if (errorTaskList && errorTaskList.length) {
                            for (let errorTask of errorTaskList) {
                                errorMsgHtml += `Row ${ errorTask.row }: ${ errorTask.errorMsg }<br/>`
                            }
                            return res.json(utils.response(0, errorMsgHtml));
                        } else  {
                            let newMBTaskList = [], taskIdList = [];
                            let updateTaskTableList = [];
                            let newUnitList = [];
                            let newLocationList = [];
    
                            let allUnitList = await Unit.findAll();
                            let allSystemLocation = await _SystemLocation.Location.findAll();
                            //build new mbTask
                            for (let mbTask of mbTaskList) {
                                let newMBTask = { id: mbTask.id, dataType: 'mb', category: 'MV', serviceMode: 'Others' };
    
                                let lowerHub = mbTask.hub ? mbTask.hub.toLowerCase() : '';
                                let lowerNode = mbTask.node ? mbTask.node.toLowerCase() : '';
                                let existUnit = null;
                                let parentUnit = null;
                                if (!lowerNode) {
                                    existUnit = allUnitList.find(item => item.unit.toLowerCase() == lowerHub && (item.subUnit == null || item.subUnit == ''));
                                } else {
                                    existUnit = allUnitList.find(item => item.unit.toLowerCase() == lowerHub && item.subUnit && item.subUnit.toLowerCase() == lowerNode);
                                    parentUnit = allUnitList.find(item => item.unit.toLowerCase() == lowerHub && !item.subUnit);
                                }
                                if (lowerNode && !parentUnit) {
                                    newUnitList.push({unit: mbTask.hub});
                                    allUnitList.push({unit: mbTask.hub});
                                }
                                if (!existUnit || !existUnit.id) {
                                    if(!existUnit) {
                                        newUnitList.push({unit: mbTask.hub, subUnit: mbTask.node});
                                        allUnitList.push({unit: mbTask.hub, subUnit: mbTask.node});
                                    }
                                    newMBTask.hub = mbTask.hub
                                    newMBTask.node = mbTask.node
                                } else {
                                    newMBTask.unitId = existUnit.id;
                                }

                                let lowerReportingLocation = mbTask.reportingLocation ? mbTask.reportingLocation.toLowerCase() : '';
                                let reportingLocationObj = allSystemLocation.find(item => item.locationName.toLowerCase() == lowerReportingLocation);
                                if (!reportingLocationObj) {
                                    reportingLocationObj = {locationName: mbTask.reportingLocation, secured: 0, lat: '0.0', lng: '0.0', zip: '460139', country: 'Singapore'}
                                    newLocationList.push(reportingLocationObj);
                                    allSystemLocation.push(reportingLocationObj);
                                } 
                                newMBTask.reportingLocation = reportingLocationObj.locationName;
                                newMBTask.reportingLocationLat = reportingLocationObj.lat
                                newMBTask.reportingLocationLng = reportingLocationObj.lng

                                let lowerDestinationLocation = mbTask.destinationLocation ? mbTask.destinationLocation.toLowerCase() : '';
                                let destinationLocationObj = allSystemLocation.find(item => item.locationName.toLowerCase() == lowerDestinationLocation);
                                if (!destinationLocationObj) {
                                    destinationLocationObj = {locationName: mbTask.destinationLocation, secured: 0, lat: '0.0', lng: '0.0', zip: '460139', country: 'Singapore'}
                                    newLocationList.push(destinationLocationObj);
                                    allSystemLocation.push(destinationLocationObj);
                                } 
                                newMBTask.destination = destinationLocationObj.locationName;
                                newMBTask.destinationLat = reportingLocationObj.lat
                                newMBTask.destinationLng = reportingLocationObj.lng
    
                                newMBTask.purpose = mbTask.purpose
                                newMBTask.activityName = mbTask.activityName
                                newMBTask.vehicleType = mbTask.vehicleType
                                newMBTask.poc = mbTask.pocOfficer
                                newMBTask.mobileNumber = mbTask.pocContactNo
                                newMBTask.mbUnit = mbTask.pocUnit
    
                                // if (mbTask.requiredDriver && mbTask.requiredDriver != '0' || mbTask.requiredDriver != 0) {
                                //     newMBTask.driverNum = 1;
                                // }
    
                                newMBTask.startDate = moment(mbTask.startDate.trim(), 'DD/MM/YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');
                                newMBTask.endDate = moment(mbTask.endDate.trim(), 'DD/MM/YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');
    
                                // console.log(JSON.stringify(newMBTask))
                                // for (let index = 0; index < mbTask.vehicleNum; index++) {
                                //     let temp = {...newMBTask};
                                //     temp.indentId = (mbTask.hub && mbTask.hub.length > 4 ? mbTask.hub.substr(0, 4) : mbTask.hub) 
                                //         + (mbTask.node && mbTask.node.length > 3 ? ('-' + mbTask.node.substr(0, 3)) : ('-' + mbTask.node)) + '-' + (index + 1);
                                //     newMBTaskList.push(temp);
                                // }

                                if (mbTask.assigned) {
                                    newMBTask.driverId = null;
                                    newMBTask.vehicleNo = null;
                                    newMBTask.driverStatus = null;
                                    newMBTask.vehicleStatus = null;
                                    newMBTask.taskId = 'MT-' + newMBTask.id
                                    newMBTask.activity = newMBTask.activityName;
                                    newMBTask.indentStartTime = newMBTask.startDate;
                                    newMBTask.indentEndTime = newMBTask.endDate;
                                    newMBTask.pickupGps = newMBTask.reportingLocationLat + ',' + newMBTask.reportingLocationLng;
                                    newMBTask.dropoffGps = newMBTask.destinationLat + ',' + newMBTask.destinationLng;
                                    updateTaskTableList.push(newMBTask)
                                    taskIdList.push(newMBTask.taskId)
                                    log.info(`These task status is waitcheck, need clear checklist, task and mt_admin`)
                                    // log.info(JSON.stringify(taskIdList, null, 4))
                                }

                                newMBTaskList.push(newMBTask)
                            }
    
                            //bulkCreate new unit
                            if (newUnitList) {
                                await Unit.bulkCreate(newUnitList, { updateOnDuplicate: ['unit', 'subUnit'] })
                            }
                            //TODO：create new system location
                            allUnitList = await Unit.findAll();
                            //create new mbTask
                            for (let newMbTask of newMBTaskList) {
                                if (!newMbTask.unitId) {
                                    let lowerHub = newMbTask.hub ? newMbTask.hub.toLowerCase() : '';
                                    let lowerNode = newMbTask.node ? newMbTask.node.toLowerCase() : '';
    
                                    let existUnit = null;
                                    if (!lowerNode) {
                                        existUnit = allUnitList.find(item => item.unit.toLowerCase() == lowerHub && !item.subUnit);
                                    } else {
                                        existUnit = allUnitList.find(item => item.unit.toLowerCase() == lowerHub && item.subUnit && item.subUnit.toLowerCase() == lowerNode);
                                    }
                                    if (existUnit) {
                                        newMbTask.unitId = existUnit.id;
                                    }
                                }
                            }
    
                            await MtAdmin.bulkCreate(newMBTaskList, { 
                                updateOnDuplicate: ['unitId', 'purpose', 'activityName', 'vehicleType', 'poc', 'mobileNumber', 'mbUnit', 'startDate', 'endDate', 'reportingLocation', 'destination', 'reportingLocationLat', 'reportingLocationLng', 'destinationLat', 'destinationLng', 'driverId', 'vehicleNumber'] 
                            });

                            await Task.bulkCreate(updateTaskTableList, { 
                                updateOnDuplicate: ['hub', 'node', 'purpose', 'activity', 'indentStartTime', 'indentEndTime', 'pickupGps', 'dropoffGps', 'driverId', 'vehicleNumber'] 
                            });

                            await CheckList.destroy({
                                where: {
                                  taskId: taskIdList
                                }
                            });
    
                            return res.json(utils.response(1, 'Success'));
                        }
                    }


                } else {
                    return res.json(utils.response(0, 'File is empty!'));
                }
            });
        } catch (error) {
            log.error(error)
            return res.json(utils.response(0, error));
        }
    },
    updateMBTask2: function (req, res) {
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
                if (files.constructor !== Array) files.file = [ files.file ];

                let fileDataList = [];
                for (let file of files.file) {
                    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                        let list = xlsx.parse(file.path, { cellDates: true });
                        // log.info(JSON.stringify(list));
                        list = list[0].data; 
                        let sheetData = parseMBTaskData2(list, true);
                        fileDataList = fileDataList.concat(sheetData);
                    } else {
                        return res.json(utils.response(0, 'Please Use Excel file!'));
                    }
                }
                if (fileDataList.length) {
                    let mbTaskList = await checkMBTask2(fileDataList, true);

                    // TODO: 
                    // 0、Check id, if null, ignore and remind back html
                    // 1、Check task status again, if started, ignore and remind back html
                    // 2、Check hub/node by id, and update
                    // 3、Check vehicleType by id, and update(if change, need clear driver if already assigned)
                    // 4、Check location by id, and update
                    // 5、Check start/end dateTime by id, and update

                    // log.info(JSON.stringify(mbTaskList, null, 4))
                    if (mbTaskList.length) {
                        let errorTaskList = mbTaskList.filter(item => item.errorMsg != null && item.errorMsg !='');
                        let errorMsgHtml = ``;
                        if (errorTaskList && errorTaskList.length) {
                            for (let errorTask of errorTaskList) {
                                errorMsgHtml += `Row ${ errorTask.row }: ${ errorTask.errorMsg }<br/>`
                            }
                            return res.json(utils.response(0, errorMsgHtml));
                        } else  {
                            let updateTaskTableList = [], clearCheckListTaskIdList = [];
                            let updateUnitList = [], updateLocationList = []

                            // TODO: Update unit and location 
                            for (let mbTask of mbTaskList) { 
                                updateUnitList.push(`${ mbTask.hub },${ mbTask.node ? mbTask.node : '' }`)
                                updateLocationList.push(mbTask.reportingLocation)
                                updateLocationList.push(mbTask.destinationLocation)
                            }
                            // let unitList = await checkUnit(updateUnitList);
                            let locationList = await checkLocation(updateLocationList);

                            // Maybe has TO/Vehicle only task
                            // let bothMBTaskList = [], toOnlyMBTaskList = [], vehicleOnlyMBTaskList = []
                            let loanUpdateSqlList = [] 
                            let unitList = await Unit.findAll();

                            for (let mbTask of mbTaskList) {
                                // TODO: get unitId
                                // unitList.some(item => {
                                //     if (item.unit?.toLowerCase() == mbTask.hub?.toLowerCase()) {
                                //         if (item.subUnit?.toLowerCase() == mbTask.node?.toLowerCase()) {
                                //             mbTask.unitId = item.id;
                                //             return true;
                                //         }
                                //     }
                                // })
                                // TODO: get locationId
                                for (let location of locationList) {
                                    if (location.locationName?.toLowerCase() == mbTask.reportingLocation?.toLowerCase()) {
                                        mbTask.reportingLocationLat = location.lat;
                                        mbTask.reportingLocationLng = location.lng;
                                        mbTask.reportingLocationId = location.id
                                    }
                                    if (location.locationName?.toLowerCase() == mbTask.destinationLocation?.toLowerCase()) {
                                        mbTask.destinationLat = location.lat;
                                        mbTask.destinationLng = location.lng;
                                        mbTask.destinationId = location.id
                                    }
                                    if (mbTask.reportingLocationLat && mbTask.destinationLat) {
                                        break;
                                    }
                                }
                                
                                // TODO: re-name
                                // mbTask.indentId = (mbTask.hub && mbTask.hub.length > 4 ? mbTask.hub.substr(0, 4) : mbTask.hub) 
                                // + (!mbTask.node ? '' : (mbTask.node.length > 3 ? ('-' + mbTask.node.substr(0, 3)) : ('-' + mbTask.node))) + '-' + mbTask.id;
                                mbTask.poc = mbTask.pocOfficer
                                mbTask.mobileNumber = mbTask.pocContactNo
                                mbTask.mbUnit = mbTask.pocUnit
                                mbTask.destination = mbTask.destinationLocation

                                mbTask.startDate = moment(mbTask.startDate.trim(), 'DD/MM/YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');
                                mbTask.endDate = moment(mbTask.endDate.trim(), 'DD/MM/YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');

                                mbTask.driverId = null
                                mbTask.driverName = null
                                mbTask.vehicleNumber = null

                                // Checkout unit
                                mbTask.unitId = null;
                                for (let item of unitList) {
                                    if (mbTask.hub) {
                                        if (mbTask.hub.toLowerCase() == item.unit.toLowerCase()) {
                                            if (!mbTask.node && !item.node) {
                                                mbTask.unitId = item.id
                                                break
                                            } else if (mbTask.node && item.subUnit && mbTask.node.toLowerCase() == item.subUnit.toLowerCase()) {
                                                mbTask.unitId = item.id
                                                break
                                            }
                                        }
                                    } 
                                }
                                // Class MB Task by Both/Loan
                                let _tempMBTask = await MtAdmin.findByPk(mbTask.id)
                                let checkBoth = Number(_tempMBTask.driverNum) + Number(_tempMBTask.needVehicle)
                                if (checkBoth == 1) {
                                    // Loan: TO/Vehicle Only
                                    // if (mbTask.driverNum == 1) {
                                    //     toOnlyMBTaskList.push(mbTask)
                                    // } else if (mbTask.needVehicle == 1) {
                                    //     vehicleOnlyMBTaskList.push(mbTask)
                                    // }
                                    loanUpdateSqlList.push(`UPDATE loan SET unitId = ${ mbTask.unitId }, startDate = '${ mbTask.startDate }', endDate = '${ mbTask.endDate }' WHERE ( taskId = CONCAT('AT-', ${ mbTask.id }) OR taskId = CONCAT('MT-', ${ mbTask.id }) ) AND groupId = -1;`)
                                } else if (checkBoth == 2) {
                                    // Both
                                    // bothMBTaskList.push(mbTask)

                                    // TODO: clear task and checklist while already assigned
                                    if (mbTask.assigned) {
                                        let updateTask = {}
                                        // updateTask.driverId = null;
                                        // updateTask.vehicleNo = null;
                                        // updateTask.driverStatus = null;
                                        // updateTask.vehicleStatus = null;
                                        // updateTask.activity = mbTask.activityName;
                                        updateTask.taskId = 'AT-' + mbTask.id
                                        updateTask.indentStartTime = mbTask.startDate;
                                        updateTask.indentEndTime = mbTask.endDate;
                                        updateTask.pickupDestination = mbTask.reportingLocation;
                                        updateTask.dropoffDestination = mbTask.destination;
                                        updateTask.pickupGPS = mbTask.reportingLocationLat + ',' + mbTask.reportingLocationLng;
                                        updateTask.dropoffGPS = mbTask.destinationLat + ',' + mbTask.destinationLng;
                                        
                                        // updateTaskTableList.push(updateTask)
                                        clearCheckListTaskIdList.push('AT-' + mbTask.id)
                                        clearCheckListTaskIdList.push('MT-' + mbTask.id)
                                        log.info(`These task status is waitcheck, need clear checklist, task and mt_admin`)
                                        // log.info(JSON.stringify(clearCheckListTaskIdList, null, 4))
                                    }
                                }
                            }

                            // Joseph(2023-03-30): Upload only update time，location，POC details
                            await MtAdmin.bulkCreate(mbTaskList, { 
                                // updateOnDuplicate: ['unitId', 'purpose', 'activityName', 'vehicleType', 'poc', 'mobileNumber', 'mbUnit', 'startDate', 'endDate', 'reportingLocation', 'destination', 'reportingLocationLat', 'reportingLocationLng', 'destinationLat', 'destinationLng', 'driverId', 'vehicleNumber', 'indentId'] 
                                updateOnDuplicate: ['driverId', 'driverName', 'vehicleNumber',  'unitId', 'poc', 'mobileNumber', 'mbUnit', 'startDate', 'endDate', 'reportingLocation', 'destination', 'reportingLocationLat', 'reportingLocationLng', 'destinationLat', 'destinationLng'] 
                            });

                            // TODO: Need update loan(unitId, startDate, endDate)
                            if (loanUpdateSqlList.length) {
                                for (let sql of loanUpdateSqlList) {
                                    await sequelizeObj.query(sql, { type: QueryTypes.UPDATE })
                                }
                            }

                            // await Task.bulkCreate(updateTaskTableList, { 
                            //     // updateOnDuplicate: ['hub', 'node', 'purpose', 'activity', 'indentStartTime', 'indentEndTime', 'pickupGps', 'dropoffGps', 'driverId', 'vehicleNumber', 'indentId'] 
                            //     updateOnDuplicate: ['indentStartTime', 'indentEndTime', 'pickupGPS', 'dropoffGPS', 'pickupDestination', 'dropoffDestination'] 
                            // });
                            await Task.destroy({
                                where: {
                                  taskId: clearCheckListTaskIdList
                                }
                            });

                            await CheckList.destroy({
                                where: {
                                  taskId: clearCheckListTaskIdList
                                }
                            });

                            await MT_RAC.destroy({
                                where: {
                                  taskId: clearCheckListTaskIdList
                                }
                            });
    
                            return res.json(utils.response(1, 'Success'));
                        }
                    }
                } else {
                    return res.json(utils.response(0, 'File is empty!'));
                }
            });
        } catch (error) {
            log.error(error)
            return res.json(utils.response(0, error));
        }
    },
}

const getDownloadMBTaskData = async function (option) {
    try {
        let { vehicleType, hub, node, startDate, endDate, purpose, activity } = option;
        let baseSql = `
            SELECT mt.id, mt.purpose, mt.activityName, mt.vehicleNumber, mt.vehicleType, mt.driverName, mt.driverId, mt.driverNum, mt.indentId,
            mt.reportingLocation, mt.destination, mt.startDate, mt.endDate, mt.poc, mt.mobileNumber, mt.mbUnit,
            u.unit AS hub, u.subUnit AS node
            FROM mt_admin mt
            LEFT JOIN unit u ON u.id = mt.unitId
            LEFT JOIN task t on t.taskId = CONCAT('MT-', mt.id)
            WHERE mt.dataType = 'mb' AND (t.driverStatus IS NULL OR t.driverStatus IN ('waitcheck'))
        `;
        let replacements = [];

        if (hub) {
            baseSql += ' AND u.unit = ? '
            replacements.push(hub)
        }
        if (node) {
            baseSql += ' AND u.subUnit = ? '
            replacements.push(node)
        }
        if (vehicleType) {
            baseSql += ' AND mt.vehicleType = ? '
            replacements.push(vehicleType)
        }

        let MBTaskList = await sequelizeObj.query(baseSql, { type: QueryTypes.SELECT, replacements })
        return MBTaskList;
    } catch (error) {
        throw error
    }
}
const generateMBTaskXlsx = async function (filePath, dataList) {
    try {
        let rows = []
        for (let row of dataList) {
            let { id, hub, node, indentId, startDate, endDate, purpose, activityName, vehicleType, 
                reportingLocation, destination, poc, mobileNumber, mbUnit } = row
            rows.push([
                id, hub, node, indentId, purpose, activityName, vehicleType,
                startDate ? moment(startDate).format('DD/MM/YYYY HH:mm') : moment().format('DD/MM/YYYY HH:mm'), 
                endDate ? moment(endDate).format('DD/MM/YYYY HH:mm') : moment().format('DD/MM/YYYY HH:mm'),
                reportingLocation, destination,
                poc, mobileNumber, mbUnit
            ])
        }

        // Test
        // rows = [
        //     ['1', 'Hub', 'Node', '2023-03-23 10:00:00', '2023-03-23 12:00:00', 'Purpose1', 'Activity1', '19-Seater Bus', 'Location A', 'Location B', 'POC 1', '87456321', 'Unit A']
        // ]

        let title = [
            ['ID', 'Hub', 'Node', 'Indent ID', 'Purpose', 'Activity', 'Vehicle Type', 'Start Date', 'End Date', 'Reporting', 'Destination', 'Conducting Officer', 'Contact No.', 'Unit']
        ]
        const sheetOptions = {'!cols': 
            [
                { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, 
                { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, 
                { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 20 }
            ], 
            '!rows': [{ hpt: 20 }],
        };
        let buffer = xlsx.build([
            {
                name: 'sheet1',
                data: [].concat(title, rows)
            }
        ],
        {
            sheetOptions
        });
        fs.writeFileSync(filePath, buffer, { 'flag': 'w' });
    } catch (error) {
        log.error(error)
        throw error;
    }
}

const checkUnit = async function (unitStrList) {
    if (!unitStrList || !unitStrList.length) {
        return;
    }
    // TODO: add parent unit
    let tempUnitStrList = []
    for (let unitStr of unitStrList) {
        tempUnitStrList.push(unitStr.split(',')[0] + ',')
    }
    unitStrList = unitStrList.concat(tempUnitStrList);

    // TODO: unique
    unitStrList = Array.from(new Set(unitStrList))

    // TODO: generate obj
    let uploadUnitList = unitStrList.map(item => {
        let obj = item.split(',');
        return {
            unit: obj[0],
            subUnit: obj[1] ? obj[1] : null,
        }
    })
    // TODO: find out exist unitId
    let dbUnitList = await Unit.findAll();
    for (let dbUnit of dbUnitList) {
        for (let uploadUnit of uploadUnitList) {
            if (!uploadUnit.unit) continue;
            if (dbUnit.unit.toLowerCase() == uploadUnit.unit.toLowerCase()) {
                if (!dbUnit.subUnit && !uploadUnit.subUnit) {
                    uploadUnit.id = dbUnit.id;
                } else if (dbUnit.subUnit && uploadUnit.subUnit) {
                    if (dbUnit.subUnit.toLowerCase() == uploadUnit.subUnit.toLowerCase()) {
                        uploadUnit.id = dbUnit.id;
                    }
                }
            }
        }
    }
    // TODO: find out unit has no unitId
    let newUnitList = [], newUnitStrList = []
    for (let uploadUnit of uploadUnitList) {
        if (!uploadUnit.id) {
            newUnitList.push(uploadUnit)
            newUnitStrList.push(uploadUnit.unit)
        }
    }

    // TODO: create new Unit while does not exist
    await Unit.bulkCreate(newUnitList);

    latestUnitList = await Unit.findAll();
    return latestUnitList;
}

const checkLocation = async function (locationList) {
    // TODO: unique
    locationList = Array.from(new Set(locationList))

    let systemLocationList = await _SystemLocation.Location.findAll();
    // TODO: check new location
    let newLocationList = [];
    for (let location of locationList) {
        let checkResult = systemLocationList.some(item => {
            if (item.locationName.toLowerCase() == location.toLowerCase()) {
                return true;
            }
        })
        if (!checkResult) {
            newLocationList.push({
                locationName: location,
                secured: 0,
                lat: '0.0',
                lng: '0.0',
            })
        }
    }
    // TODO: create new location
    await _SystemLocation.Location.bulkCreate(newLocationList);

    let latestSystemLocationList = await _SystemLocation.Location.findAll();
    return latestSystemLocationList;
}



/**
 * {
        "row": 1
        "id": "MT-180",
        "hub": "MT-180",
        "node": "MT-180",
        "purpose": "MT-180",
        "activityName": "MT-180",
        "vehicleType": "MT-180",
        "vehicleNum": "MT-180",
        "requiredDriver": "MT-180",
        "startDate": "MT-180",
        "startTime": "MT-180",
        "endDate": "MT-180",
        "endTime": "MT-180",
        "reportingLocation": "MT-180",
        "destinationLocation": "MT-180",
        "pocOfficer": "MT-180",
        "pocContactNo": "MT-180",
        "pocUnit": "MT-180",
        "errorMsg": "fail"
    }
    */
const parseMBTaskData = async function(excelDataList, isUpdate) {
    let resultList = [];
    let rowIndex = -1;

    let allUnitList = await Unit.findAll();

    let emptyRowNum = 0;
    for (let rowdata of excelDataList) {
        if (emptyRowNum >= 3) {
            return resultList;
        }

        rowIndex++;
        //header 2 row.
        if (!isUpdate) {
            if (rowIndex < 4) {
                continue;
            }
        } else {
            // While update, there ony one row of title
            if (rowIndex == 0) {
                continue;
            }
        }
        let columnIndex = 0;
        let mbTaskData = {errorMsg: ''};
        if (isUpdate) {
            mbTaskData.taskId = rowdata[columnIndex]
            columnIndex++
        }
        mbTaskData.row = rowIndex + 1;
        mbTaskData.hub = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.node = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.indentId = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.purpose = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.activityName = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.vehicleType = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.vehicleNum = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : '0'; columnIndex++;
        mbTaskData.driverNum = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : '0'; columnIndex++;
        mbTaskData.startDate = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.startTime = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.endDate = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.endTime = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.reportingLocation = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.destinationLocation = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.pocOfficer = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.pocContactNo = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.pocUnit = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;

        // is all empty row
        if(!mbTaskData.hub && !mbTaskData.node && !mbTaskData.purpose && !mbTaskData.activityName && !mbTaskData.vehicleType
                && !mbTaskData.startDate && !mbTaskData.startTime && !mbTaskData.endDate && !mbTaskData.endTime && !mbTaskData.reportingLocation && !mbTaskData.destinationLocation)  {
            //log.warn("warn: uploadTaskService excel has empty row: " + rowIndex)
            emptyRowNum++;
        } else {
            emptyRowNum = 0;
            let lowerHub = mbTaskData.hub ? mbTaskData.hub.toLowerCase() : '';
            let lowerNode = mbTaskData.node ? mbTaskData.node.toLowerCase() : '';

            let existUnit = null;
            if (!lowerNode) {
                existUnit = allUnitList.find(item => item.unit.toLowerCase() == lowerHub && !item.subUnit);
            } else {
                existUnit = allUnitList.find(item => item.unit.toLowerCase() == lowerHub && item.subUnit && item.subUnit.toLowerCase() == lowerNode);
            }
            if (existUnit) {
                mbTaskData.unitId = existUnit.id;
            }

            resultList.push(mbTaskData);
        }
    }

    return resultList;
}

const parseMBTaskData2 = function(excelDataList) {
    let resultList = [];

    let rowIndex = -1;
    for (let rowdata of excelDataList) {
        // log.info(JSON.stringify(rowdata, null, 4))
        rowIndex++;
        if (rowIndex == 0) {
            continue;
        }
        let columnIndex = 0;
        let mbTaskData = { errorMsg: '', assigned: false };
        mbTaskData.row = rowIndex + 1;
        mbTaskData.id = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.hub = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.node = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.indentId = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.purpose = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.activityName = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.vehicleType = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.startDate = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.endDate = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.reportingLocation = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.destinationLocation = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.pocOfficer = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.pocContactNo = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;
        mbTaskData.pocUnit = rowdata[columnIndex] ? (rowdata[columnIndex] + '').trim() : ''; columnIndex++;

        // log.info(JSON.stringify(mbTaskData))

        // is all empty row
        if(!mbTaskData.id && !mbTaskData.hub && !mbTaskData.node && !mbTaskData.purpose && !mbTaskData.activityName && !mbTaskData.vehicleType
             && !mbTaskData.startDate && !mbTaskData.endDate && !mbTaskData.reportingLocation && !mbTaskData.destinationLocation)  {
            log.warn("warn: uploadTaskService excel has empty row: " + rowIndex)
        } else { 
            resultList.push(mbTaskData);
        }
    }

    return resultList;
}

const checkMBTask = async function (mbTaskList, isUpdate) {
	if (mbTaskList && mbTaskList.length > 0) {
        const supportVehicleTypeList = await sequelizeSystemObj.query(
            `SELECT DISTINCT typeOfVehicle from contract_rate`,
            {
                type: QueryTypes.SELECT
            }
        );

        for (let mbTask of mbTaskList) {
            if (!mbTask.hub) {
                mbTask.errorMsg += "Hub is empty; " ; continue;
            }
            if (!mbTask.unitId) {
                mbTask.errorMsg += "Unit does not exist; " ; continue;
            }
            if (!mbTask.purpose) {
                mbTask.errorMsg += "Purpose is empty; "; continue;
            } else {
                let supportPurpose = SUPPORT_PURPOSE.find(item => item == mbTask.purpose)
                if (!supportPurpose) {
                    mbTask.errorMsg += `Purpose[${mbTask.purpose}] not support, just support: [${SUPPORT_PURPOSE.toString()}]`; continue;
                }
            }
            if (!mbTask.activityName) {
                mbTask.errorMsg += "Activity Name is empty; "; continue;
            }
            if (!mbTask.vehicleType) {
                mbTask.errorMsg += "Type of Vehicle is empty; "; continue;
            }
            if (!mbTask.vehicleNum) {
                mbTask.errorMsg += "Resource Qty is empty; "; continue;
            }
            if (!mbTask.driverNum) {
                mbTask.errorMsg += "Resource Required TO is empty; "; continue;
            }
            if (mbTask.driverNum == '0' && mbTask.vehicleNum == '0') {
                mbTask.errorMsg += "Resource Qty and Required TO can't be 0 all; "; continue;
            }
            if (!mbTask.startDate) {
                mbTask.errorMsg += "Start Date is empty; "; continue;
            }
            if (!mbTask.startTime) {
                mbTask.errorMsg += "Start Time is empty; "; continue;
            }
            if (!mbTask.endDate) {
                mbTask.errorMsg += "End Date is empty; "; continue;
            }
            if (!mbTask.endTime) {
                mbTask.errorMsg += "End Time is empty; "; continue;
            }
            if (!mbTask.reportingLocation) {
                mbTask.errorMsg += "Reporting Location is empty; "; continue;
            }
            if (!mbTask.destinationLocation) {
                mbTask.errorMsg += "Destination Location is empty; "; continue;
            } 
            
            //check vehicleType is useable.
            let vehicleType = mbTask.vehicleType.toLowerCase();
            let existVehicleType = supportVehicleTypeList.find(item => item.typeOfVehicle && item.typeOfVehicle.toLowerCase() == vehicleType);
            
            if (!existVehicleType) {
                mbTask.errorMsg += `Unsupport VehicleType: ${vehicleType}; `; continue;
            } else {
                mbTask.vehicleType = existVehicleType.typeOfVehicle;
            }

            //check startTime  endTime
            let endDateTime = moment(mbTask.endDate.trim() + ' ' + mbTask.endTime.trim(), 'DDMMYYYY HH:mm:ss');
            let endDateTimeStr = endDateTime.format('YYYY-MM-DD HH:mm:ss');
            if (endDateTimeStr && endDateTimeStr.toLowerCase() == 'invalid date') {
                mbTask.errorMsg += `EndDateTime ${mbTask.endDate.trim() + ' ' + mbTask.endTime.trim()} format error; `; continue;
            }
            if (endDateTime.isBefore(moment())) {
                mbTask.errorMsg += `EndDateTime ${endDateTime.format('YYYY-MM-DD HH:mm:ss')} is before CurrentDateTime; `; continue;
            }
            let startDateTime = moment(mbTask.startDate.trim() + ' ' + mbTask.startTime.trim(), 'DDMMYYYY HH:mm:ss');
            let startDateTimeStr = startDateTime.format('YYYY-MM-DD HH:mm:ss');
            if (startDateTimeStr && startDateTimeStr.toLowerCase() == 'invalid date') {
                mbTask.errorMsg += `StartDateTime ${mbTask.startDate.trim() + ' ' + mbTask.startTime.trim()} format error; `; continue;
            }
            if (endDateTime.isBefore(startDateTime)) {
                mbTask.errorMsg += `EndDateTime ${endDateTime.format('YYYY-MM-DD HH:mm:ss')} is before StartDateTime ${startDateTime.format('YYYY-MM-DD HH:mm:ss')}; `;
            }
        }
    }
	return mbTaskList;
}
const checkMBTask2 = async function (mbTaskList, isUpdate) {
	if (mbTaskList && mbTaskList.length > 0) {
        const supportVehicleTypeList = await sequelizeSystemObj.query(
            `SELECT DISTINCT typeOfVehicle from contract_rate`,
            {
                type: QueryTypes.SELECT
            }
        );
        const enableTaskList = await sequelizeObj.query(
            // 1. Both => once start, can not update
            // 2. TO/Vehicle Only => once assign, can not update
            // 3. Cancelled Task can not update
            `   
                SELECT mt.id, t.driverStatus, mt.indentId, mt.dataType, t.mobileStartTime, mt.cancelledDateTime, l.id as loanId
                FROM mt_admin mt
                LEFT JOIN task t ON (CONCAT('MT-', mt.id) = t.taskId OR CONCAT('AT-', mt.id) = t.taskId )
                LEFT JOIN loan l ON (CONCAT('MT-', mt.id) = l.taskId OR CONCAT('AT-', mt.id) = l.taskId ) AND l.groupId = -1
                WHERE mt.dataType = 'mb' 
            `,
            {
                type: QueryTypes.SELECT
            }
        );

        let unitList = await Unit.findAll();

        for (let mbTask of mbTaskList) {
            if (isUpdate && !mbTask.id) {
                mbTask.errorMsg += "Id is empty; " ; continue;
            }
            if (!mbTask.hub) {
                mbTask.errorMsg += "Hub is empty; " ; continue;
            }
            
            let checkUnit = unitList.some(item => {
                if (item.unit.toLowerCase() == mbTask.hub.toLowerCase()) {
                    if (mbTask.node && item.subUnit && mbTask.node.toLowerCase() == item.subUnit.toLowerCase()) {
                        return true
                    } else if (!mbTask.node && !item.subUnit) {
                        return true
                    }
                }
            })
            if (!checkUnit) {
                mbTask.errorMsg += `${ mbTask.hub }/${ mbTask.node } does not exist; `; continue;
            }

            if (!mbTask.purpose) {
                mbTask.errorMsg += "Purpose is empty; "; continue;
            }
            if (mbTask.purpose.toLowerCase() !== 'training') {
                mbTask.errorMsg += "Only 'Training' is allowed in purpose; "; continue;
            }
            if (!mbTask.activityName) {
                mbTask.errorMsg += "Activity Name is empty; "; continue;
            }
            if (!mbTask.vehicleType) {
                mbTask.errorMsg += "Type of Vehicle is empty; "; continue;
            }
            if (!isUpdate && !mbTask.vehicleNum) {
                mbTask.errorMsg += "Resource Qty is empty; "; continue;
            }
            if (!mbTask.startDate) {
                mbTask.errorMsg += "Start Date is empty; "; continue;
            }
            if (!mbTask.endDate) {
                mbTask.errorMsg += "End Date is empty; "; continue;
            }
            if (!mbTask.reportingLocation) {
                mbTask.errorMsg += "Reporting Location is empty; "; continue;
            }
            if (!mbTask.destinationLocation) {
                mbTask.errorMsg += "Destination Location is empty; "; continue;
            }

            if (isUpdate) {
                let existTask = enableTaskList.find(item => item.id == mbTask.id)
                // log.info(JSON.stringify(existTask, null, 4))
                if (!existTask) {
                    mbTask.errorMsg += `ID ${ mbTask.id } does not exist! `;
                } else if (existTask.driverStatus) {
                    if (existTask.dataType !== 'mb') {
                        mbTask.errorMsg += `ID ${ mbTask.id } is not data from MB! `;
                    } else {
                        mbTask.assigned = true;
                        if (existTask.driverStatus !== 'waitcheck' && existTask.driverStatus !== 'ready') {
                            mbTask.errorMsg += `ID ${ mbTask.id } status is ${ existTask.driverStatus }! `; continue;
                        }
                    }
                } else if (existTask.cancelledDateTime) {
                    mbTask.errorMsg += `ID ${ mbTask.id } status is cancelled! `; continue;
                } else if (existTask.mobileStartTime) {
                    mbTask.errorMsg += `ID ${ mbTask.id } already started! `; continue;
                } else if (existTask.loanId) {
                    mbTask.errorMsg += `ID ${ mbTask.id } already finished loan! `; continue;
                }
            } 
            
            //check vehicleType is useable.
            let vehicleType = mbTask.vehicleType.toLowerCase();
            let existVehicleType = supportVehicleTypeList.find(item => item.typeOfVehicle && item.typeOfVehicle.toLowerCase() == vehicleType);
            
            if (!existVehicleType) {
                mbTask.errorMsg += `Unsupport VehicleType: ${vehicleType}; `; continue;
            } else {
                mbTask.vehicleType = existVehicleType.typeOfVehicle;
            }

            //check startTime endTime
            let endDateTime = null;
            try {
                if (mbTask.endDate.indexOf('/') > 0) {
                    endDateTime = moment(mbTask.endDate, 'DD/MM/YYYY HH:mm:ss');
                } else if (mbTask.endDate.indexOf('-') > 0) {
                    endDateTime = moment(mbTask.endDate, 'DD-MM-YYYY HH:mm:ss');
                } else if (mbTask.endDate.indexOf('GMT+') > 0) {
                    endDateTime = moment(new Date(mbTask.endDate).getTime());
                } else {
                    mbTask.errorMsg += `EndDateTime format ${ mbTask.endDate } is not allowed!`
                }
                
                if (endDateTime.isBefore(moment())) {
                    mbTask.errorMsg += `EndDateTime ${ endDateTime.format('YYYY-MM-DD HH:mm:ss') } is invalid; `; continue;
                }
                mbTask.endDate = endDateTime.format('DD/MM/YYYY HH:mm:ss');
            } catch (error) {
                log.error(error)
                mbTask.errorMsg += `EndDateTime ${ mbTask.endDate } is not allowed!`
            }

            let startDateTime = null;
            try {
                if (mbTask.startDate.indexOf('/') > 0) {
                    startDateTime = moment(mbTask.startDate, 'DD/MM/YYYY HH:mm:ss');
                } else if (mbTask.startDate.indexOf('-') > 0) {
                    startDateTime = moment(mbTask.startDate, 'DD-MM-YYYY HH:mm:ss');
                } else if (mbTask.startDate.indexOf('GMT+') > 0) {
                    startDateTime = moment(new Date(mbTask.startDate).getTime());
                } else {
                    mbTask.errorMsg += `StartDateTime format ${ mbTask.startDate } is not allowed!`
                }
                if (endDateTime.isBefore(startDateTime)) {
                    mbTask.errorMsg += `EndDateTime ${ endDateTime.format('YYYY-MM-DD HH:mm:ss') } is before startDateTime ${ startDateTime.format('YYYY-MM-DD HH:mm:ss') }; `; continue;
                }
                mbTask.startDate = startDateTime.format('DD/MM/YYYY HH:mm:ss');
            } catch (error) {
                log.error(error)
                mbTask.errorMsg += `StartDateTime ${ mbTask.startDate } is invalid!`
            }
        }
    }
	return mbTaskList;
}
