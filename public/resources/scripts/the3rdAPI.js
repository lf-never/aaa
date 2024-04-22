import * as MapUtil from './common-map.js'
import { getSessionStorage, setSessionStorageWithExpiry } from './common-script.js'

import { removeMapObject, drawMarker, drawMarker2, bindMarkerClickEvent } from './common-map.js'

let incidentMarkerList = [], driverMarkerList = [], deviceMarkerList = [];
let cameraMarkerList = [], systemIncidentMarkerList = [];
let intervalOfDriver;
let intervalOfDevice;
let intervalOfIncident;
let intervalOf3rdCamera;
let intervalOf3rdIncident;

let clusterOf3rdCamera = null;
const draw3rdCameraMonitorMarker = async function () {
    const getCameraListRequest = async function () {
        let url = '/traffic/getTrafficImages'
        let data = getSessionStorage(url)
        if (data) {
            return data
        } else {
            return axios.post(url)
                .then(result => {
                    if (result.respCode == 1) {
                        setSessionStorageWithExpiry(url, result.respMessage, 10 * 60 * 1000)
                        return result.respMessage
                    } else {
                        return []
                    }
                })
        }
    }

    if (!clusterOf3rdCamera) {
        clusterOf3rdCamera = MapUtil.createClusterTopic('LTA Camera', { color: '#5cb313', width: '115px' })
    }
    if (!$('.view-camera').hasClass('active')) return;
    // console.log(`Init traffic camera position...`)
    let cameraList = await getCameraListRequest();
    clear3rdCameraMonitorMarker();
    cameraList = cameraList[0].cameras
    for (let camera of cameraList) {
        camera.lat = camera.location.latitude
        camera.lng = camera.location.longitude
        let marker = MapUtil.drawMarkerCenter(camera, { iconUrl: './icons/icon_camera.svg', iconSize: [25, 25] });
        bindMarkerClickEvent(marker, function () {
            layer.alert('<img alt="" class="alert-camera" data-id="'+ camera.camera_id +'" style="width: '+ camera.image_metadata.width/2 +'px; height: '+ camera.image_metadata.height/2 +'px;" src="'+ camera.image +'">', 
                { icon: -1, title: `Traffic Image(Camera: ${ camera.camera_id } ${ moment(camera.timestamp).format('HH:mm:ss') } )`, btn: ['Ok'], offset: 'auto', area: 'auto', maxWidth: '512px' });
        })
        cameraMarkerList.push(marker)

        // Check if this camera is open, while true, refresh image
        if ($('.alert-camera').data('id') == camera.camera_id) {
            // console.log('update camera...', camera.image)
            $('.alert-camera').attr('src', camera.image)
        }

    }

    MapUtil.insertClusterTopic(cameraMarkerList, clusterOf3rdCamera)
}
const clear3rdCameraMonitorMarker = function () {
    for (let cameraMarker of cameraMarkerList) {
        removeMapObject(cameraMarker)
    }
    MapUtil.removeFromClusterTopic(cameraMarkerList, clusterOf3rdCamera)
    cameraMarkerList = [];
}

let clusterOf3rdIncident = null;
const draw3rdIncidentMonitorMarker = async function () {
    const getSystemIncidentListRequest = async function () {
        let url = '/traffic/getTrafficList'
        let data = getSessionStorage(url)
        if (data) {
            return data
        } else {
            return axios.post(url)
                .then(result => {
                    if (result.respCode == 1) {
                        setSessionStorageWithExpiry(url, result.respMessage, 10 * 60 * 1000)
                        return result.respMessage
                    } else {
                        return []
                    }
                })
        }
    }

    if (!clusterOf3rdIncident) {
        clusterOf3rdIncident = MapUtil.createClusterTopic('LTA Incident', { color: '#e15252', width: '115px' })
    }
    if (!$('.view-traffic-incident').hasClass('active')) return;
    // console.log(`Init traffic incident position...`)
    let systemIncidentList = await getSystemIncidentListRequest();
    clear3rdIncidentMonitorMarker()
    for (let systemIncident of systemIncidentList) {
        systemIncident.lat = systemIncident.Latitude
        systemIncident.lng = systemIncident.Longitude
        let marker = MapUtil.drawMarkerCenter(systemIncident, { iconUrl: './icons/icon_traffic_incident.svg', iconSize: [25, 25] })
        let html = `<div class="incident-popup px-3" style="height: 60px;padding-top: 10px; ">
        <label style="color: black;font-size: 13px;"> Type: ${ systemIncident.Type }</label><br>
        <label style="color: black;font-size: 13px;"> Message: ${ systemIncident.Message }</label><br>
        </div>`
        marker.bindTooltip(html, { direction: 'top', offset: [1, -10] });
        systemIncidentMarkerList.push(marker)
    }
    
    MapUtil.insertClusterTopic(systemIncidentMarkerList, clusterOf3rdIncident)
}
const clear3rdIncidentMonitorMarker = function () {
    for (let systemIncidentMarker of systemIncidentMarkerList) {
        removeMapObject(systemIncidentMarker)
    }
    MapUtil.removeFromClusterTopic(systemIncidentMarkerList, clusterOf3rdIncident)
    systemIncidentMarkerList = []
}

const drawIncidentMonitorMarker = async function () {
    const getIncidentListRequest = async function () {
        return axios.post('/incident/getIncidentList')
            .then(function (res) {
                if (res.respCode === 1) {
                    return res.respMessage;
                } else {
                    console.error(res.respMessage);
                    return [];
                }
            });
    }

    if (Cookies.get('view_incident') == '1') {
        if (!$('.view-incident').hasClass('active')) return;
        let incidentList = await getIncidentListRequest();
        clearIncidentMonitorMarker();
        for (let incident of incidentList) {
            incidentMarkerList.push(drawMarker(incident, { iconUrl: './images/incident/incident-red.png', iconSize: [25, 25] }))
        }
    }
    
}
const clearIncidentMonitorMarker = function () {
    for (let incident of incidentMarkerList) {
        removeMapObject(incident)
    }
    incidentMarkerList = []
}

let clusterOfDriverMonitor = null;
const drawDriverMonitorMarker = async function (selectedDate) {
    const addDriverPopup = function (marker, driver) {
        let tooltipContent = `<div class="p-2">${ driver.vehicleNo }<br>${ driver.driverName }<div>`
        marker.bindTooltip(tooltipContent, { direction: 'top', offset: [0, -15], permanent: true }).openTooltip();
    }
    
    if (!clusterOfDriverMonitor) {
        clusterOfDriverMonitor = MapUtil.createClusterTopic('Driver', { color: '#a942cb', width: '90px' })
    }
    let list = await getDriverAndDevicePositionList(selectedDate);
    let driverPositionList = list.filter(data => data.type === 'mobile')
    clearDriverMonitorMarker();

    for (let driverPosition of driverPositionList) {
        // console.log(driverPosition.updatedAt)
        // if overtime 15 min
        // if (checkTimeIfMissing(driverPosition.updatedAt)) {
        if (driverPosition.missing) {
            if (!$('.view-missing-car').hasClass('active')) {
                continue;
            } else {
                // console.log(driverPosition)
                // setTimeout(() => {
                    let marker = MapUtil.drawMarker(driverPosition, { iconUrl: './images/driver/oic-grey.svg', iconSize: [35, 35] })
                    setTimeout(() => {
                        addDriverPopup(marker, driverPosition)
                    }, 100)
                    driverMarkerList.push(marker)
                // }, 100)
            }
        } else {
            // setTimeout(() => {
                let marker = MapUtil.drawMarkerCenter(driverPosition, { iconUrl: './images/driver/oic.svg', iconSize: [35, 35] })
                setTimeout(() => {
                    addDriverPopup(marker, driverPosition)
                }, 100)
                driverMarkerList.push(marker)
            // }, 100)
        }
    }
    
    MapUtil.insertClusterTopic(driverMarkerList, clusterOfDriverMonitor)
}
const clearDriverMonitorMarker = function () {
    for (let driver of driverMarkerList) {
        removeMapObject(driver)
    }
    MapUtil.removeFromClusterTopic(driverMarkerList, clusterOfDriverMonitor)
    driverMarkerList = []
}

let clusterOfDeviceMonitor = null;
const drawDeviceMonitorMarker = async function (selectedDate) {
    const drawSpeedMarker = function (speed, color) {
        return `<div class="speed-marker-div">
            <svg class="speed-marker-icon" t="1650889966724" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1625" width="32" height="32"><path d="M90.1282959 511.99505615a421.87005614 421.87005614 0 1 0 843.7401123 0 421.87005614 421.87005614 0 1 0-843.7401123 0z" fill="${color}" p-id="1626"></path><path d="M933.87335205 512c0 232.99200441-188.88299559 421.875-421.875 421.875-151.74810791 0-284.78375246-80.12493895-359.10626222-200.38568116 69.16442873 49.60491943 153.96954346 78.81811523 245.57904055 78.81811524 233.00848388 0 421.875-188.88299559 421.87499999-421.875 0-81.22741701-22.95263673-157.10888672-62.7522583-221.47283935C864.33483888 245.50354003 933.87335205 370.63397217 933.87335205 512z" fill="${color}" p-id="1627"></path><path d="M186.77886963 511.99505615a325.21948242 325.21948242 0 1 0 650.43896486 0 325.21948242 325.21948242 0 1 0-650.43896486 0z" fill="#EFEFEF" p-id="1628"></path><path d="M837.21289062 512.00164795c0 179.60339355-145.60620117 325.20959473-325.20959473 325.20959473-124.12847901 0-232.0246582-69.55499268-286.81896972-171.8168335 54.55865479 41.42779541 122.61895751 66.01025389 196.41577149 66.01025391 179.60339355 0 325.20959473-145.60620117 325.20959472-325.20959473 0-55.47491455-13.89385987-107.70666503-38.390625-153.41088867 78.25616455 59.39373779 128.79382324 153.39440918 128.79382324 259.21746826z" fill="#EFEFEF" p-id="1629"></path></svg>
            <div class="speed-marker-number">${ speed }</div>
        </div>`;
    }
    
    const addObdPopup = function (marker, device) {
        let tooltipContent = `<div class="p-2">${ device.vehicleNo ? device.vehicleNo : device.deviceId  }<div>`
        marker.bindTooltip(tooltipContent, { direction: 'top', offset: [-1, -15], permanent: true }).openTooltip();
    }

    if (!clusterOfDeviceMonitor) {
        clusterOfDeviceMonitor = MapUtil.createClusterTopic('Device', { color: '#cc6911', width: '90px' })
    }
    if (!$('.view-obd').hasClass('active')) return;
    let list = await getDriverAndDevicePositionList(selectedDate);
    let devicePositionList = list.filter(data => data.type === 'obd')
    clearDeviceMonitorMarker();
    for (let devicePosition of devicePositionList) {
        let marker = null;
        // if overtime 15 min
        // if (checkTimeIfMissing(devicePosition.updatedAt)) {
        if (devicePosition.missing) {
            marker = drawMarker2(devicePosition, { iconUrl: drawSpeedMarker(devicePosition.speed, "#000000"), iconSize: [35, 35] });
        } else if (devicePosition.speed > devicePosition.limitSpeed) {
            marker = drawMarker2(devicePosition, { iconUrl: drawSpeedMarker(devicePosition.speed, "#cf2928"), iconSize: [35, 35] } );
        } else {
            marker = drawMarker2(devicePosition, { iconUrl: drawSpeedMarker(devicePosition.speed, "#4361b9"), iconSize: [35, 35] });
        }
        setTimeout(() => {
            addObdPopup(marker, devicePosition);
        }, 100)
        deviceMarkerList.push(marker)
    }
    
    MapUtil.insertClusterTopic(deviceMarkerList, clusterOfDeviceMonitor)
}
const clearDeviceMonitorMarker = function () {
    for (let device of deviceMarkerList) {
        removeMapObject(device)
    }
    MapUtil.removeFromClusterTopic(deviceMarkerList, clusterOfDeviceMonitor)
    deviceMarkerList = []
}

export function draw3rdCameraMonitorMarkerExport() {
    draw3rdCameraMonitorMarker()
    intervalOf3rdCamera = setInterval(draw3rdCameraMonitorMarker, 10 * 60 * 1000)
        
}
export function clear3rdCameraMonitorMarkerExport() {
    clear3rdCameraMonitorMarker()
    clearInterval(intervalOf3rdCamera)
}

export function draw3rdIncidentMonitorMarkerExport() {
    draw3rdIncidentMonitorMarker()
    intervalOf3rdIncident = setInterval(draw3rdIncidentMonitorMarker, 10 * 60 * 1000)
}
export function clear3rdIncidentMonitorMarkerExport() {
    clear3rdIncidentMonitorMarker();
    clearInterval(intervalOf3rdIncident)
}

export function drawIncidentMonitorMarkerExport() {
    drawIncidentMonitorMarker();
    intervalOfIncident = setInterval(drawIncidentMonitorMarker, 5 * 1000)
}
export function clearIncidentMonitorMarkerExport() {
    clearIncidentMonitorMarker();
    clearInterval(intervalOfIncident)
}
 
export function drawDriverMonitorMarkerExport(selectedDate) {
    drawDriverMonitorMarker(selectedDate);
    intervalOfDriver = setInterval(() => drawDriverMonitorMarker(selectedDate), 5 * 1000)
}
export function clearDriverMonitorMarkerExport() {
    clearDriverMonitorMarker();
    clearInterval(intervalOfDriver)
}

export function drawDeviceMonitorMarkerExport(selectedDate) {
    drawDeviceMonitorMarker(selectedDate);
    intervalOfDevice = setInterval(() => drawDeviceMonitorMarker(selectedDate), 5 * 1000)
}
export function clearDeviceMonitorMarkerExport() {
    clearDeviceMonitorMarker();
    clearInterval(intervalOfDevice)
}