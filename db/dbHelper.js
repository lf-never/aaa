const log = require('../log/winston').logger('DB Helper');

// *******************************
// Offence
const { Track } = require('../model/event/track');
const { TrackHistory } = require('../model/event/trackHistory');
const { DeviceEventHistory } = require('../model/event/deviceEventHistory');
const { DevicePositionHistory } = require('../model/event/devicePositionHistory');
const { DriverPositionHistory } = require('../model/event/driverPositionHistory');
const { DeviceOffenceHistory } = require('../model/event/deviceOffenceHistory');
const { DriverOffenceHistory } = require('../model/event/driverOffenceHistory');

// *******************************
// Mobius
const { Unit } = require('../model/unit');
const { Pois } = require('../model/pois');

const { User } = require('../model/user');
const { UserZone } = require('../model/userZone');
const { NogoZone } = require('../model/nogoZone');
const { UserGroup } = require('../model/userGroup');
const { UserNotice } = require('../model/userNotice');

const { Room } = require('../model/room');
const { RoomMember } = require('../model/roomMember');
const { Friend } = require('../model/friend');
const { Message } = require('../model/message');
const { ChatRecord } = require('../model/chatRecord');

const { Device } = require('../model/device');
const { Driver } = require('../model/driver');
const { DriverMileage } = require('../model/driverMileage');
const { DriverPlatformConf } = require('../model/driverPlatformConf');
const { DriverPosition } = require('../model/driverPosition');
const { DriverTask } = require('../model/driverTask');
const { Vehicle } = require('../model/vehicle');
const { VehicleRelation } = require('../model/vehicleRelation');

const { Mileage } = require('../model/mileage');
const { MileageHistory } = require('../model/MileageHistory');

const { Waypoint } = require('../model/waypoint');
const { WaypointEstimate } = require('../model/waypointEstimate');
const { Route } = require('../model/route');
const { RouteWaypoint } = require('../model/routeWaypoint');

const { SystemConf } = require('../model/systemConf');
const { StateRecord } = require('../model/stateRecord');
const { LoginRecord } = require('../model/loginRecord');

const { CompareResult } = require('../model/compareResult');

const { Incident } = require('../model/incident');
const { IncidentType } = require('../model/incidentType');

const { DriverPlatform } = require('../model/driverPlatform');

const { HOTO } = require('../model/hoto');
const { HOTORecord } = require('../model/hotoRecord');

const { Notification } = require('../model/notification');
const { NotificationRead } = require('../model/notificationRead');

const { SOS } = require('../model/sos');

const { SpeedBandsTemp } = require('../model/traffic/speedBandsTemp');
const { SpeedBands } = require('../model/traffic/speedBands');

const { ModulePage } = require('../model/permission/modulePage');
const { Role } = require('../model/permission/role');


const { UrgentConfig } = require('../model/urgent/urgentConfig');
const { UrgentDuty } = require('../model/urgent/urgentDuty');
const { UrgentIndent } = require('../model/urgent/urgentIndent');
const { DriverCivilianLicence } = require('../model/driverCivilianLicence');

try {
    // log.info('Start Init DB!');
    
    // UrgentConfig.sync({ alter: true })
    // UrgentDuty.sync({ alter: true })
    // UrgentIndent.sync({ alter: true })

    // DriverCivilianLicence.sync({ alter: true })

    
    // SpeedBandsTemp.sync({ alter: true })
    // SpeedBands.sync({ alter: true })

    // CompareResult.sync({ alter: true }).catch(error => { throw error });

    // Track.sync({ alter: true }).catch(error => { throw error });
    // TrackHistory.sync({ alter: true }).catch(error => { throw error });
    // DeviceEventHistory.sync({ alter: true }).catch(error => { throw error });
    // DevicePositionHistory.sync({ alter: true }).catch(error => { throw error });
    // DeviceOffenceHistory.sync({ alter: true }).catch(error => { throw error });
    // DriverPositionHistory.sync({ alter: true }).catch(error => { throw error });
    // DriverOffenceHistory.sync({ alter: true }).catch(error => { throw error });

    // Unit.sync({ alter: true }).catch(error => { throw error });
    // Pois.sync({ alter: true }).catch(error => { throw error });

    // Incident.sync({ alter: true }).catch(error => { throw error });
    // IncidentType.sync({ alter: true }).catch(error => { throw error });

    // User.sync({ alter: true }).catch(error => { throw error });
    // UserZone.sync({ alter: true }).catch(error => { throw error });
    // NogoZone.sync({ alter: true }).catch(error => { throw error });
    // UserGroup.sync({ alter: true }).catch(error => { throw error });
    // UserNotice.sync({ alter: true }).catch(error => { throw error });

    // Room.sync({ alter: true }).catch(error => { throw error });
    // RoomMember.sync({ alter: true }).catch(error => { throw error });
    // Friend.sync({ alter: true }).catch(error => { throw error });
    // Message.sync({ alter: true }).catch(error => { throw error });
    // ChatRecord.sync({ alter: true }).catch(error => { throw error });

    // Device.sync({ alter: true }).catch(error => { throw error });
    // Driver.sync({ alter: true }).catch(error => { throw error });
    // DriverPosition.sync({ alter: true }).catch(error => { throw error });
    // DriverTask.sync({ alter: true }).catch(error => { throw error });
    // Vehicle.sync({ alter: true }).catch(error => { throw error });
    // VehicleRelation.sync({ alter: true }).catch(error => { throw error });

    // Mileage.sync({ alter: true });
    // MileageHistory.sync({ alter: true });

    // Waypoint.sync({ alter: true }).catch(error => { throw error });
    // WaypointEstimate.sync({ alter: true }).catch(error => { throw error });
    // Route.sync({ alter: true }).catch(error => { throw error });
    // RouteWaypoint.sync({ alter: true }).catch(error => { throw error });

    // SystemConf.sync({ alter: true }).catch(error => { throw error });
    // StateRecord.sync({ alter: true }).catch(error => { throw error });
    // LoginRecord.sync({ alter: true }).catch(error => { throw error });

    // DriverMileage.sync({ alter: true })
    // DriverPlatform.sync({ alter: true })

    // HOTO.sync({ alter: true })
    // HOTORecord.sync({ alter: true })

    // Notification.sync({ alter: true })
    // NotificationRead.sync({ alter: true })

    // SOS.sync({ alter: true })

    // ModulePage.sync({ alter: true })
    // Role.sync({ alter: true })

    
} catch (error) {
    log.error('(Init DB): ', error);
}


