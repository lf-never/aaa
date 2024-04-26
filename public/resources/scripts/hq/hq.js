let currentArea = null;
let currentNode = null;
let userType = Cookies.get('userType');
let userId = Cookies.get('userId');
let tableHub;
let tableNode;
let tableBySys     
let tableName = 'sys'

$( async function () {
    initClickPage()
    initSelectedAndPage();
    clickSelect();
    initDetail();

    setTimeout(() => {
        $('.assign-menu').children().first().trigger('click')
    }, 100)
});

const tableReload = function () {
    if(tableName == 'sys' || tableName == 'atms') {
        tableBySys.ajax.reload(null, true) 
    }
}

const tableReload2 = function () {
    if(tableName == 'sys' || tableName == 'atms') {
        tableBySys.ajax.reload(null, false) 
    }
}

const initClickPage = function () {
    $('.sys-assign').off('click').on('click', function () {
        tableName = 'sys'
        $('.mb-assign-border').css('display', 'none')
        $('.sys-assign-border').css('display', 'block')
        if(tableBySys) tableBySys.ajax.reload(null, false) 
    })

    $('.mb-assign').off('click').on('click', function () {
        // tableName = 'mb'
        tableName = 'atms'
        $('.mb-assign-border').css('display', 'block')
        $('.sys-assign-border').css('display', 'none') 
        if(tableBySys) tableBySys.ajax.reload(null, false) 
    })
    $('.sys-assign').trigger('click')

    $('#clearAll').off('click').on('click', function () {
        $(".selected-vehicleType").val("")
        $(".select-hub").val("")
        $('.select-hub').trigger('change')
        $(".execution-date").val("")
        $(".created-date").val("")
        $(".tripId").val("")
        $('.screen-vehicleNo').val('')
        $('.screen-driverName').val('')
        if(tableName == 'sys' || tableName == 'atms') $('.selected-taskStatus').val('')
        setTimeout(function () {
            tableReload()
        }, 300)
    });
}

const initSelectedAndPage = async function () {
    const getVehicleType = async function () {
        return axios.post('/assign/getVehicleType')
        .then(function (res) {
            if (res.respCode === 1) {
                return res.respMessage;
            } else {
                console.error(res.respMessage);
                return null;
            }
        });
    }

    const initVehicleType = function (vehicleTypeList) {
        $('.selected-vehicleType').empty();
        let html = `<option value=''>Resource:All</option>`;
        for(let vehicleType of vehicleTypeList){
            if(vehicleType.typeOfVehicle) html += `<option value='${ vehicleType.typeOfVehicle }'>${ vehicleType.typeOfVehicle }</option>`;
        }
        $('.selected-vehicleType').append(html);
    }

    let vehicleTypeList = await getVehicleType();
    initVehicleType(vehicleTypeList);

    const initLayDate = function () {
        layui.use('laydate', function(){
            let laydate = layui.laydate;
            laydate.render({
                elem: '.execution-date',
                format: 'dd/MM/yyyy',
                type: 'date',
                lang: 'en',
                trigger: 'click',
                range: '~',
                btns: ['clear', 'confirm'],
                value: `${moment().format("DD/MM/YYYY")} ~ ${moment().add(2, 'weeks').format("DD/MM/YYYY")}`,
                done: function () {
                    tableReload()
                }
            });
            laydate.render({
                elem: '.created-date',
                format: 'dd/MM/yyyy',
                type: 'date',
                lang: 'en',
                trigger: 'click',
                btns: ['clear', 'confirm'],
                done: function () {
                    tableReload()
                }
            });
        });
    }
    initLayDate()

    const initUnit = async function (unitList) {
        if(unitList) {
            let __unitList = unitList.map(unit => { return unit.unit });
            $('.select-hub').empty();
            __unitList = Array.from(new Set(__unitList));
            let html = `<option value="">Hub:All</option>`;
            for (let __unit of __unitList) {
                html += `<option name="unitType" value="${ __unit }">${ __unit }</option>`
            }
            $('.select-hub').append(html); 

            $('.select-hub').off('change').on('change' , function () {
                if(unitList.length > 0) {
                    const initNode = function(){
                        let selectedUnit = $(this).val();
                        $(".select-node").empty();
                        let html2 = ''
                        if(unitList.length > 1) {
                            html2 = `<option value="">Node:All</option>`;
                        } else {
                            html2 = `<option name="subUnitType" value='${ unitList[0].subUnit }'>Node:All</option>`;
                        }
                        for (let unit of unitList) {
                            if (unit.unit === selectedUnit && unit.subUnit) {
                                if((unit.subUnit).toLowerCase() === 'null') continue
                                html2 += `<option name="subUnitType" data-id="${ unit.id }" value="${ unit.subUnit }">${ unit.subUnit }</option>`
                            } else {
                                continue;
                            }
                        }
                        $(".select-node").append(html2);
                    }
                    initNode()
                } else {
                    $(".select-node").empty();
                    $(".select-node").append(`<option value="">Node:All</option>`);
                }
                tableReload()
            })
        }
    }
    let unitList = await getHubNode('', '');
    initUnit(unitList);
    $('#collapseExample').show();
    $('.data-detail').show();
    $('.data-sector-detail').hide();
}

const getVehicleList = function (getVehicleOption) {
    let { purpose, dataType, vehicleType, hub, node, startDate, endDate, taskId, noOfDriver, unitId } = getVehicleOption;
    console.log(getVehicleOption)
    return axios.post('/assign/getVehicleList', { purpose, dataType, vehicleType, hub, node, startDate, endDate, taskId, noOfDriver, unitId })
        .then(function (res) {
            if (res.respCode === 1) {
                return res.respMessage;
            } else {
                console.error(res.respMessage);
                return null;
            }
        });
}

const getDriverAndVehicle = async function(taskId, dataType, vehicleData, driverData) {
    const getTaskIdDriverAndVehicle = function (taskId, dataType) {
        return axios.post('/assign/getTaskIdDriverAndVehicle', { taskId, dataType })
                .then(function (res) {
                    if (res.respCode === 1) {
                        return res.respMessage;
                    } else {
                        console.error(res.respMessage);
                        return null;
                    }
                });
    }

    let vehicleNumber;
    let searchDriverId = null;
    let driverAndVehicle = await getTaskIdDriverAndVehicle(taskId, dataType);
    if(driverAndVehicle){
        const initDriverVehicle = function (){
            if(driverAndVehicle.vehicleNumber) {
                vehicleNumber = driverAndVehicle.vehicleNumber ?? '';
                let vehicelTotalObj = vehicleData.filter(vehicleObj => vehicleObj.vehicleNo == vehicleNumber)
                if(vehicelTotalObj[0]) $('#search-vehicleNumber').val(`${ driverAndVehicle.vehicleNumber }`);
            }
            if(driverAndVehicle.driverId) {
                searchDriverId = driverAndVehicle.driverId ? driverAndVehicle.driverId : null;
                let driverTotalObj = driverData.filter(driverObj => driverObj.driverId == searchDriverId)
                if(driverTotalObj[0]) {
                    let contactNumber = driverAndVehicle.contactNumber ?? null;
                    $('#search-driverName').attr('data-id', searchDriverId)
                    let _newContactNumber = contactNumber ? ` (${ contactNumber })` : ''
                    $('#search-driverName').val(`${ driverAndVehicle.name }${ _newContactNumber }`)
                }
            }
        }
        initDriverVehicle()
    } else {
        vehicleNumber = null;
        searchDriverId = null;
        $('#search-vehicleNumber').val('')
        $('#search-driverName').val('')
        $('#search-driverName').attr('data-id', null)
    }
    let driverAndVehicelObj = { vehicleNumber, searchDriverId }
    return driverAndVehicelObj
}

window.CheckListByTaskId = async function(taskId){
    return await axios.post('/assign/CheckListByTaskId', { taskId })
    .then(function (res) {
        if (res.respCode === 1) {
            return res.respMessage;
        } else {
            console.error(res.respMessage);
            return null;
        }
    });
}

const getDriverListByTaskId = function (getDriverOption) {
    let { userId, vehicleType, hub, node, noOfVehicle, startDate, endDate, unitId } = getDriverOption;
    return axios.post('/assign/getDriverListByTaskId', { userId, vehicleType, hub, node, noOfVehicle, startDate, endDate, unitId })
        .then(function (res) {
            if (res.respCode === 1) {
                return res.respMessage;
            } else {
                console.error(res.respMessage);
                return null;
            }
        });
}

window.showPersonDetailEventHandler = async function (el, taskId, reAssignHub, reAssignNode, dataType, purpose) {
    let vehicleType = $(el).closest('tr').find('td:eq(6)').text()
    let startDate = ($(el).closest('tr').find('td:eq(7)').find("div:eq(1)").text()).replace(/ to/g, '')
    let endDate = ($(el).closest('tr').find('td:eq(7)').find("div:eq(2)").text()).replace(/ to/g, '')
    startDate = moment(startDate, 'DD/MM/YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss')
    endDate = moment(endDate, 'DD/MM/YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss')
    console.log(vehicleType)
    console.log(startDate)
    console.log(endDate)
    let noOfVehicle = $(el).closest('tr').find('#table-request-div').attr('value') == -1 || null;
    let noOfDriver = $(el).closest('tr').find('#table-request-div').attr('value');
    let dataTypeByVehicle = null

    const clearFormData = function () {
        $('#myModal').modal('hide');
        $("#search-driverName").val('');
        $("#search-driverName").attr("data-id", null);
        $("#search-driverName").attr("data-unitId", null);
        $('.form-driverName-select').css("display", "none");
        $("#search-vehicleNumber").val('');
        $("#search-vehicleNumber").attr('data-unitId', null);
        $('.form-vehicleNumber-select').css("display", "none");
        tableHub = null
        tableNode = null
        $('.form-vehicleNumber-select').empty()
        $(".form-driverName-select").empty()
        tableBySys.ajax.reload(null, false) 
    }

    const loanOutTaskByTaskId = async function(taskId, startDate, endDate){
        return await axios.post('/assign/loanOutTaskByTaskId', { taskId, startDate, endDate })
        .then(function (res) {
            if (res.respCode === 1) {
                return res.respMessage;
            } else {
                console.error(res.respMessage);
                return null;
            }
        });
    }

    const verifyTask = async function (){
        let taskState
        if(dataType.toLowerCase() == 'sys') { 
            dataTypeByVehicle = null
            if($(el).closest('tr').find('#table-request-div').attr('value') > 0) {
                taskState = await CheckListByTaskId(taskId) 
            } else {
                taskState = await loanOutTaskByTaskId(taskId, startDate, endDate) 
            }
        } else if(dataType.toLowerCase() == 'atms'){
            dataTypeByVehicle = null
            if($(el).closest('tr').find('#table-request-div').attr('value') > 0) {
                taskState = await CheckListByTaskId('AT-'+taskId) 
            } else {
                taskState = await loanOutTaskByTaskId('AT-'+taskId, startDate, endDate) 
            }
        }
    
        if(taskState){
            $.confirm({
                title: 'Warn',
                content: 'The task has started disabling operations.',
                buttons: {
                    ok: {
                        btnClass: 'btn-green',
                        action: function () {
                            if(tableName == 'sys' || tableName == 'atms') {
                                tableBySys.ajax.reload(null, false) 
                            }
                        }
                    }
                }
            });
        }
    }
    await verifyTask()

    const showDriverVehicleDiv = function (){
        if($(el).closest('tr').find('#table-request-div').attr('value') > 0) { // driver and vehicle
            $("#search-driverName").attr("disabled", false);
            $("#search-vehicleNumber").attr("disabled", false);  
        } else if($(el).closest('tr').find('#table-request-div').attr('value') == 0){ // not driver
            $("#search-driverName").attr("disabled", true);  
            $("#search-vehicleNumber").attr("disabled", false); 
        } else if($(el).closest('tr').find('#table-request-div').attr('value') == -1){ // not vehicle
            $("#search-driverName").attr("disabled", false); 
            $("#search-vehicleNumber").attr("disabled", true);  
        }
    }
    $('#myModal').modal('show');
    tableHub = $(el).closest('tr').find('#task-assign-hub').val();
    tableNode = $(el).closest('tr').find('#task-assign-node').val();
    if(tableHub == 'undefined') tableHub = null;
    if(tableNode == 'undefined') tableNode = null;
    if(reAssignHub && reAssignHub == 'undefined') reAssignHub = null;
    if(reAssignNode && reAssignNode == 'undefined') reAssignNode = null;
    if((reAssignHub || tableHub) && (reAssignNode != "null" || tableNode != "") 
    && ((tableNode || tableNode == '-') || (reAssignNode || reAssignNode == '-'))) {
        let vehicleNumber = '';
        let searchDriverId = null;
        showDriverVehicleDiv();

        let vehicleData = null
        const initVehicleOption = async function () {
            if($(el).closest('tr').find('#table-request-div').attr('value') != -1) {
                let vehicleHub = tableHub || reAssignHub
                let vehicleNode = tableNode || reAssignNode
                console.log(tableHub)
                console.log(reAssignHub)
                console.log(tableHub || reAssignHub)
                //purpose, dataType, vehicleType, hub, node, startDate, endDate, taskId, noOfDriver, unitId
                vehicleData = await getVehicleList({ purpose, dataType: dataTypeByVehicle, vehicleType, hub: vehicleHub, node: vehicleNode, startDate, endDate, taskId, noOfDriver });
                $("#search-vehicleNumber").off('click').on("click", function () {
                    $('.form-vehicleNumber-select').css("display", "block");
                    initVehicleNumber(this)
                });

                $("#search-vehicleNumber").on("keyup", function () {
                    let val = $(this).val()
                    let filterUnits = vehicleData.filter(vehicleList => vehicleList.vehicleNo.toLowerCase().indexOf(val.toLowerCase()) != -1)
                    InsertFilterOption2('.form-vehicleNumber-select', filterUnits)
                    vehicleNumber = '';
                })
            
                $('.form-vehicleNumber-select').on("mousedown", "li", async function () {
                    $("#search-vehicleNumber").html('');
                    let val = $(this).html();
                    let unitId = $(this).attr('data-unitId');
                    vehicleNumber = $(this).text();
                    $("#search-vehicleNumber").val(val);
                    $("#search-vehicleNumber").attr('data-unitId', unitId);
                    $('.form-vehicleNumber-select').css("display", "none");
                });
            
                const initVehicleNumber = async function (e) {
                    $(e).next().css("display", "")
                    $(e).next().find("input").val("");
                    $(e).next().find("input").attr('data-unitId', '');
                    $(e).next().css("display", "block")
                    $('.form-vehicleNumber-select').empty()
                    let __getVehicleHub = tableHub || reAssignHub;
                    let __getVehicleNode = tableNode || reAssignNode
                    //purpose, dataType, vehicleType, hub, node, startDate, endDate, taskId, noOfDriver, unitId
                    vehicleData = await getVehicleList({ purpose, dataType: dataTypeByVehicle, vehicleType, hub: __getVehicleHub, node: __getVehicleNode, startDate, endDate, taskId, noOfDriver });
                    if(vehicleData) {
                        for(let vehicleList of vehicleData) {
                            $('.form-vehicleNumber-select').append(`<li data-unitId="${ vehicleList.unitId }">${ vehicleList.vehicleNo }</li>`)
                            if(!vehicleList.vehicleNo) $('.form-vehicleNumber-select').append(`<li data-unitId="${ vehicleList.unitId }">-</li>`)
                        }
                    }
                }
            
                const InsertFilterOption2 = function (element, filterUnits) {
                    $(element).css("display", "block");
                    $(element).empty();
                    for (let vehicleList of filterUnits) {
                        $(element).append(`<li data-unitId="${ vehicleList.unitId }">${ vehicleList.vehicleNo }</li>`)
                        if(!vehicleList.vehicleNo) $(element).append(`<li data-unitId="${ vehicleList.unitId }">-</li>`)
                    }
                }

                $("#search-vehicleNumber").on('blur', function () {
                    if(taskId) {
                        if(!vehicleNumber) $("#search-vehicleNumber").val('')
                        $('.form-vehicleNumber-select').css("display", "none");
                    }
                });
            }

        }
        await initVehicleOption()

        let driverData = null
        const initDriverOption = async function () {
            if(noOfDriver != 0) {
                let __newGetDriverHub = tableHub || reAssignHub
                let __newGetDriverNode = tableNode || reAssignNode
                //userId, vehicleType, hub, node, noOfVehicle, startDate, endDate, unitId
                driverData = await getDriverListByTaskId({ userId, vehicleType, hub: __newGetDriverHub, node: __newGetDriverNode, noOfVehicle, startDate, endDate });
                $("#search-driverName").off('click').on("click", function () {
                    driverNameOnFocus(this)
                    if($(".li-driverName").text() != '-') $('.form-driverName-select').css("display", "block");
                })
                
                $("#search-driverName").on("keyup", function () {
                    let val = $(this).val()
                    let filterUnits = driverData.filter(driverList => driverList.driverName.toLowerCase().indexOf(val.toLowerCase()) != -1)
                    InsertFilterOption('.form-driverName-select', filterUnits)
                    searchDriverId = ''
                })
                $('.form-driverName-select').on("mousedown", "li", async function () {
                    $("#search-driverName").html('');
                    let val = $(this).html();
                    searchDriverId = $(this).attr("data-id");
                    let driverId = $(this).attr("data-id");
                    let unitId = $(this).attr("data-unitId");
                    $("#search-driverName").val(val);
                    $("#search-driverName").attr("data-id", driverId);
                    $("#search-driverName").attr("data-unitId", unitId);
                    $('.form-driverName-select').css("display", "none");
                });
                
                const driverNameOnFocus = async function (e) {
                    $(e).next().css("display", "")
                    $(e).next().find("input").val("");
                    $(e).next().css("display", "block");
                    $(".form-driverName-select").empty()

                    let __getDriverHub = tableHub || reAssignHub;
                    let __getDriverNode = tableNode || reAssignNode
                    //userId, vehicleType, hub, node, noOfVehicle, startDate, endDate, unitId
                    driverData = await getDriverListByTaskId({ userId, vehicleType, hub: __getDriverHub, node: __getDriverNode, noOfVehicle, startDate, endDate });
                    if(driverData) {
                        for (let driverList of driverData) {
                            $(".form-driverName-select").append(`<li class="li-driverName" data-id="${ driverList.driverId }" data-unitId="${ driverList.unitId }">${ driverList.driverName } (${ driverList.contactNumber ? driverList.contactNumber : '' })</li>`)
                            if(driverList.driverName === null || driverList.driverName === '') $(".form-driverName-select").append(`<li class="li-driverName" data-unitId="${ driverList.unitId }">-</li>`)
                        }
                    }
                    
                }
            
                const InsertFilterOption = function (element, filterUnits) {
                    $(element).css("display", "block");
                    $(element).empty();
                    if(filterUnits) {
                        for (let driverList of filterUnits) {
                            $(element).append(`<li data-id="${ driverList.driverId }" data-unitId="${ driverList.unitId }">${ driverList.driverName }(${ driverList.contactNumber ? driverList.contactNumber : '' })</li>`)
                            if(!driverList.driverName) $(element).append(`<li data-unitId="${ driverList.unitId }">-</li>`)
                        }
                    }
                    
                }

                $("#search-driverName").on('blur', async function () {
                    if(taskId) {
                        if(!searchDriverId){
                            $("#search-driverName").val('')
                            $('#search-driverName').attr("data-id", null)
                            $('#search-driverName').attr("data-unitId", null)
                        } 
                        $('.form-driverName-select').css("display", "none");
                    }
                });
            }
        }
        await initDriverOption()

        //Reproduced data
        let driverAndVehicelObj = await getDriverAndVehicle(taskId, dataType, vehicleData, driverData)
        vehicleNumber = driverAndVehicelObj.vehicleNumber || ''
        searchDriverId = driverAndVehicelObj.searchDriverId || null

        const ValidAssignTask = function (data, vehicleNO, driverNO) {
            let errorLabel = {
                vehicleNumber: 'Vehicle Number', 
                searchDriverId: 'Driver Name(Mobile Number)'
            }
            for (let key in data) {
                if(key == 'searchDriverId' && driverNO){
                    continue
                }
                if(key == 'vehicleNumber' && vehicleNO){
                    continue
                }
               if (data[key] == null || data[key] == "" || data[key].trim() == "") {
                    $.alert({
                        title: 'Warn',
                        content: errorLabel[key] + " is required.",
                    });
                    return false
                }
            }
            return true;
        }

        $('#driverConfirm').off('click').on('click', function () {
            let ValidAssignTaskObj = {
                vehicleNumber: $('#search-vehicleNumber').val(),
                searchDriverId: $('#search-driverName').attr("data-id")
            }
            let vehicleNO = false;
            let driverNO = false;
            if($(el).closest('tr').find('#table-request-div').attr('value') == -1){
                vehicleNO = true
            }
            if($(el).closest('tr').find('#table-request-div').attr('value') == 0){
                driverNO = true
            }
            let state = ValidAssignTask(ValidAssignTaskObj, vehicleNO, driverNO)
            if(state && (dataType.toLowerCase() == 'sys' || dataType.toLowerCase() == 'atms')) {
                $(this).addClass('btn-taskAssignConfirm')
                let __assignTaskHub = reAssignHub;
                if(tableHub) __assignTaskHub = tableHub;
                let __assignTaskNode = reAssignNode;
                if(tableNode) __assignTaskNode = tableNode;
                assignTask(dataType, __assignTaskHub,  __assignTaskNode, taskId, searchDriverId, vehicleNumber).then((res) => {
                    if(res.respCode === 1) {
                        clearFormData()
                    }  else {
                        $.alert({ title: 'Warn', content: res.respMessage });
                        clearFormData()
                    }
                    $(this).removeClass('btn-taskAssignConfirm')
                });                        
            }  
        });
    } else {
        $.alert({ title: 'Warn',content:'The hub and node cannot be empty.' })
        clearFormData()
    }

    $('#driverCancel').off('click').on('click', function () {
        clearFormData()
    });
}

window.hubChangeEventHandler = function (el) {
    if($(el).val()) {
        tableHub = $(el).val()
        $(el).val(tableHub)
    }
}

window.nodeChangeEventHandler = function (el, taskId, driverId, vehicleNumber, hub) {
    if($(el).val()){
        tableNode = $(el).val();
        if(driverId || vehicleNumber) {
            $(el).closest('tr').find('.btn-assigned').trigger('click');
        } else {
            axios.post('/assign/preAssign', { taskId, hub, tableNode })
            .then(function (res) {
                if (res.respCode === 1) {
                    $.confirm({
                        title: 'Warn',
                        content: 'hub and node update successfully.',
                        buttons: {
                            ok: {
                                btnClass: 'btn-green',
                                action: function () {
                                    if(tableName == 'mb'){
                                        tableByMb.ajax.reload(null, false) 
                                    } else if(tableName == 'sys' || tableName == 'atms') {
                                        tableBySys.ajax.reload(null, false) 
                                    }
    
                                    tableHub = ''
                                    tableNode = ''
                                }
                            }
                        }
                    });
                } else {
                    $.confirm({
                        title: 'Warn',
                        content: 'hub and node update failed.',
                        buttons: {
                            ok: {
                                btnClass: 'btn-green',
                                action: function () {
                                    tableHub = ''
                                    tableNode = ''
                                }
                            }
                        }
                    });
                    console.error(res.respMessage);
                    return null;
                }
            })
        }
        setInterval(function () {
            $(el).val(tableNode)
        },3000)
    }
}

window.initDetail = async function () {
    const initExecutionDate = function(){
        let execution_date = $(".execution-date").val() ?? '';
        if (execution_date) {
            if (execution_date.indexOf('~') != -1) {
                const dates = execution_date.split(' ~ ')
                if(dates.length > 0) {
                    dates[0] = moment(dates[0], 'DD/MM/YYYY').format('YYYY-MM-DD')
                    dates[1] = moment(dates[1], 'DD/MM/YYYY').format('YYYY-MM-DD')
                    execution_date = dates.join(' ~ ')
                }
            } else {
                execution_date = moment(execution_date, 'DD/MM/YYYY').format('YYYY-MM-DD')
            }
        }
        return execution_date
    }
    const initDataTableBySys = function (unitList) {
        tableBySys = $('.sys-data-list').DataTable({
            "ordering": true,
            "searching": false,
            "paging": true,
            "autoWidth": false,
            "fixedHeader": true,
            "scrollX": "auto",
            // "scrollY": "700px",
            "scrollCollapse": true,
            "language": PageHelper.language(),
            "lengthMenu": PageHelper.lengthMenu(),
            "dom": PageHelper.dom(),
            "pageLength": PageHelper.pageLength(),
            "processing": false,
            "serverSide": true,
            "destroy": true,
            "sAjaxDataProp": "data",
            "ajax": {
                url: "/assign/getAssignableTaskList2",
                type: "POST",
                data: function (d) {
                    let unit = [];
                    let vehicleType = $(".selected-vehicleType option:selected").val() ?? '';
                    let tripNo = $(".tripId").val() ?? '';
                    let execution_date = initExecutionDate();
                    let created_date = $(".created-date").val() ? moment($(".created-date").val(), 'DD/MM/YYYY').format('YYYY-MM-DD') : null;
                    currentArea = $(".select-hub option:selected").val()
                    currentNode = $(".select-node option:selected").val()
                    let endDateOrder = null
                    for (let orderField of d.order) {
                        if(orderField.column == 7) endDateOrder = orderField.dir;
                    }    
                    let option = { 
                        "taskType": tableName == 'sys' ? 'sys' : 'atms',
                        "userType": userType, 
                        "userId": userId, 
                        "node": currentNode, 
                        "unit": unit ?? "", 
                        "vehicleType": vehicleType ?? "", 
                        "tripNo": tripNo ?? "", 
                        "execution_date": execution_date ?? "", 
                        "created_date": created_date ?? "", 
                        "hub": currentArea ,
                        "vehicleNo": $('.screen-vehicleNo').val() ?? null,
                        "driverName": $('.screen-driverName').val() ?? null,
                        "taskStatus": $('.selected-taskStatus').val(),
                        "endDateOrder": endDateOrder,
                        "pageNum": d.start, 
                        "pageLength": d.length
                    }
                    return option
                },
            },   
            "initComplete" : function (settings, json) {
                $(".saf-driver-table thead tr th:first").removeClass('sorting_asc');
            },
            "columns": [
                { 
                    data: null, 
                    title: "S/N",
                    sortable: false ,
                    "render": function (data, type, full, meta) {
                        return meta.row + 1 + meta.settings._iDisplayStart
                    }
                },
                { 
                    class: 'task-assign-hub',
                    title: 'Hub', 
                    data: 'hub',
                    sortable: false,
                    defaultContent: ''
                },
                {   
                    class: 'task-assign-node',
                    title: 'Node', 
                    data: 'node',
                    sortable: false,
                    defaultContent: '' ,
                    render: function (data, type, full, meta) {
                        if(data){
                            if(data.toLowerCase() == 'null') {
                                return ''
                            } else {
                                return data
                            }
                        } else {
                            return ''
                        }
                    } 
                },
                { 
                    title: 'Task ID', 
                    data: 'tripNo', 
                    sortable: false,
                    defaultContent: '' , 
                    render: function(data, type, full, meta) {
                        let taskId = full.referenceId ? `AT-${ full.taskId }` : full.taskId;
                        return `${ data ?? '-' }<br/>${ taskId ?? '-' }`
                    } 
                },
                { 
                    title: 'Created Date', 
                    data: 'createdAt', 
                    sortable: false ,
                    defaultContent: '', 
                    render: function(data, type, full, meta) {
                        return `${ data ? moment(data).format('DD/MM/YYYY') : '' }`
                    } 
                },
                { 
                    title: 'Request', 
                    data: 'preParkDate', 
                    sortable: false ,
                    defaultContent: '' ,
                    render: function (data, type, full, meta) {
                        if(full.vehicleType != '-'){
                            if(!full.instanceId){
                                if(full.noOfDriver >= full.driverNo) {
                                    return `<div value="1" id='table-request-div'>Pre-Park</div>`
                                } else {
                                    return `<div value="0" id='table-request-div'>Pre-Park</div>`
                                }
                            } else if(full.noOfDriver >= full.driverNo) {
                                return `<div value="1" id='table-request-div'>Both</div>`
                            } else {
                                return `<div value="0" id='table-request-div'>Vehicle Only</div>`
                            }
                        } else {
                            return `<div value="-1" id='table-request-div'>TO Only</div>`
                        }
                        
                    } 
                },
                { 
                    title: 'Resource', 
                    data: 'vehicleType', 
                    sortable: false ,
                    defaultContent: '' 
                },
                { 
                    class: 'dataTable-executionTime',
                    title: 'Execution Time', 
                    data: 'endDate', 
                    sortable: true ,
                    defaultContent: '',
                    render: function (data, type, full, meta) {
                        const initPreDateHtml = function (){
                            let html = `
                            <div style="margin:0 auto;text-align: left">
                                <div>${ full.startDate ? moment(full.startDate).format('DD/MM/YYYY HH:mm') : '' } to</div>
                                <div>${ full.endDate ? moment(full.endDate).format('DD/MM/YYYY HH:mm') : '' }</div>
                                <div><span style="font-weight: bold;">Pre-Park:</span> ${ full.preParkDate ? moment(full.preParkDate).format('DD/MM/YYYY HH:mm') : '' } </div>
                            </div>
                            `
                            return html;
                        }
                        const initNotPreDateHtml = function(){
                            let html = `
                            <div style="margin:0 auto;text-align: left">
                                <div>${ full.startDate ? moment(full.startDate).format('DD/MM/YYYY HH:mm') : '' } to</div>
                                <div>${ full.endDate ? moment(full.endDate).format('DD/MM/YYYY HH:mm') : '' }</div>
                            </div>
                            ` 
                            return html
                        }
                        const initNotDateHtml = function (){
                            if(full.startDate) return `<div>${ full.startDate ? moment(full.startDate).format('DD/MM/YYYY HH:mm') : '' }</div>`
                            if(full.endDate) return `<div>${ full.endDate ? moment(full.endDate).format('DD/MM/YYYY HH:mm') : '' }</div>`
                            if(full.preParkDate) return `<div><span style="font-weight: bold;">Pre-Park:</span> ${ full.preParkDate ? moment(full.preParkDate).format('DD/MM/YYYY HH:mm') : '' } </div>` 
                        }
                        if(full.startDate && full.endDate){
                            if(full.preParkDate){
                                let html = initPreDateHtml()
                                return html
                            } else {
                                let html = initNotPreDateHtml();
                                return html
                            }
                        } else {
                            let html = initNotDateHtml();
                            return html
                        }
                    }  
                },
                { 
                    title: 'Task Status', 
                    data: 'taskStatus', 
                    sortable: false ,
                    defaultContent: '',
                    render: function (data, type, full, meta) {
                        if(!data) return ''
                        if(data.toLowerCase() === 'assigned' || data.toLowerCase() === 'assigned (system)'){
                            return `<div style="color: #1B9063;font-weight: bold;">${ data }</div>`
                        } else if(data.toLowerCase() === 'unassigned') {
                            return `<div style="color: #1D308E;font-weight: bold;">${ data }</div>`
                        } else if(data.toLowerCase() === 'declined') {
                            return `<div style="color: #E76D70;font-weight: bold;">${ data }</div>`
                        } else {
                            return ''
                        }
                    } 
                },
                {
                    title: "Location",
                    data: "pickupDestination", 
                    sortable: false ,
                    defaultContent: '' ,
                    render: function (data, type, full, meta) {
                        if (!data) {
                            return "";
                        }
                        return `<div>
                            <div class="color-pickup-destination">${ full.pickupDestination }</div>
                            <div class="icon-down-div"><span class="iconfont icon-down"></span></div>
                            <div class="color-dropoff-destination">${ full.dropoffDestination }</div>
                        </div>`
                    }
                },
                { 
                    title: 'POC Details', 
                    data: 'poc', 
                    sortable: false ,
                    defaultContent: '',
                    render: function (data, type, full, meta) {
                        return `<div>${ data ?? '' }</div>
                            <div>${ full.pocNumber ? full.pocNumber : '' }</div>`
                    } 
                },
                { 
                    title: 'Driver Details', 
                    data: 'name', 
                    sortable: false , 
                    defaultContent: '' ,
                    render: function (data, type, full, meta) {
                        let nric = full.nric ? full.nric : '';
                        let newNric;
                        if(nric) newNric = nric.slice((nric.length - 4), nric.length);
                        let html = '';
                        if(data){
                            let __newDriverNric = nric
                            if(newNric) __newDriverNric = newNric
                            html += `<div>${ data ?? '' }(${ __newDriverNric })</div>
                            <div>${ full.contactNumber ? full.contactNumber : '' }</div>`
                        }
                        if (full.reassignedDriverName) {
                            return `${html}</div><div>Pending Approve: ${ full.reassignedDriverName }</div>`
                        } else {
                            return html;
                        }
                    }
                },
                { 
                    title: 'Vehicle Details', 
                    data: 'vehicleNumber', 
                    sortable: false ,
                    defaultContent: '' ,
                    render: function (data, type, full, meta) {
                        if (full.reassignedVehicleNumber) {
                            return `<div>${ data ?? '' }</div><div>Pending Approve: ${ full.reassignedVehicleNumber }</div>`
                        } else {
                            return `<div>${ data ?? '' }</div>`
                        }
                    }
                },
                { 
                    title: 'Reassigned By', 
                    data: 'reassignedUserName', 
                    sortable: false ,
                    defaultContent: '' ,
                    render: function (data, type, full, meta) {
                        return `<div>${ data ?? '' }</div>`
                    }
                },
                { 
                    title: 'Action', 
                    data: 'vehicleType', 
                    sortable: false,
                    defaultContent: '' ,
                    render: function (data, type, full, meta, nRow) {
                        let dataType = tableName;
                        let operationList = (full.operation).toUpperCase().split(',')
                        if(full.driverId || full.vehicleNumber) {
                            if(full.checkResult) {
                                return ``
                            } else {
                                if (full.autoMatchResourceTask == 1 && full.reassignApproveStatus == 'Pending Approve') {
                                    if (operationList.includes('REASSIGN APPROVE')) {
                                        return `<button type="button" class="btn-reassign-approve custom-btn-green" onclick="reassignApproveSystemTask('${ dataType }', '${ full.taskId }', 'pass')">Re-Assign Approve</button>
                                            <button type="button" class="btn-reassign-approve custom-Reject" onclick="reassignApproveSystemTask('${ dataType }', '${ full.taskId }', 'reject')">Re-Assign Reject</button>
                                        ` 
                                    }
                                    return '';
                                } else if (operationList.includes('ASSIGN')) {
                                    return `<button type="button" class="btn-assigned custom-Reassign" onclick="showPersonDetailEventHandler(this, '${ full.taskId }', '${full.hub}', '${full.node}', '${ dataType }', '${ full.purposeType }')">Re-Assign</button>` 
                                } 
                                return ``
                            }
                        } else if (operationList.includes('ASSIGN')) {
                            return `<button type="button" class="btn-assigned custom-assign" onclick="showPersonDetailEventHandler(this, '${ full.taskId }', '${full.hub}', '${full.node}', '${ dataType }', '${ full.purposeType }')">Assign</button>`
                        }
                    }
                }
            ],
            fnCreatedRow: async function(nRow, aData, iDataIndex) {
                if(!aData.checkResult && unitList) {
                    let __unitList = unitList.map(unit => { return unit.unit });
                    __unitList = Array.from(new Set(__unitList));
                    const initUnit = function (){
                        let html = '<option></option>'
                        for (let __unit of __unitList) {
                            if(__unit) html += `<option name="unitType" value="${ __unit }">${ __unit }</option>`
                        }
                        if (aData.checkResult || (aData.autoMatchResourceTask == 1 && aData.reassignApproveStatus == 'Pending Approve')) {
                            $('td:eq(1)', nRow).empty()
                            $('td:eq(1)', nRow).prepend(`<label>${aData.hub}</label>`);
                        } else {
                            $('td:eq(1)', nRow).empty()
                            $('td:eq(1)', nRow).prepend(`<select onchange="hubChangeEventHandler(this)" class="form-select" id="task-assign-hub">${html}</select>`);
                        }
                    }
                    initUnit()
                    
                    const initSelectUnit = function (nRow){
                        $("#task-assign-node", nRow).remove();
                        let html2 = `<option></option>`;
                        for (let unit of unitList) {
                            if($('#task-assign-hub', nRow).val() == unit.unit) html2 += `<option name="subUnitType" id="mtAdmin-subUnitType" data-id="${ unit.id }" value="${ unit.subUnit || '-'}">${ unit.subUnit || '-'}</option>`
                        }
                        if (!(aData.checkResult || (aData.autoMatchResourceTask == 1 && aData.reassignApproveStatus == 'Pending Approve'))) {
                            $('td:eq(2)', nRow).empty()
                            let __selectDriverId = aData.driverId ? `'${ aData.driverId }'` : null
                            let __selectVehicleNo = aData.vehicleNumber ? `'${ aData.vehicleNumber }'` : null
                            $('td:eq(2)', nRow).prepend(`<select  onchange="nodeChangeEventHandler(this, '${ aData.taskId }',${ __selectDriverId },${ __selectVehicleNo }, '${ $('#task-assign-hub', nRow).val() }')" class="form-select" id="task-assign-node">${html2}</select>`);
                        }
                    }
                    $('#task-assign-hub', nRow).off('change').on('change' , function () {
                        initSelectUnit(nRow)
                        if (aData.checkResult || (aData.autoMatchResourceTask == 1 && aData.reassignApproveStatus == 'Pending Approve')) {
                            $('td:eq(2)', nRow).empty()
                            $('td:eq(2)', nRow).prepend(`<label>${aData.node}</label>`);
                        } 
                    })
                    $('#task-assign-hub', nRow).val(aData.hub)
                    console.log(aData.hub)
                    console.log(aData.hub)
                    $('#task-assign-hub', nRow).trigger('change')
                    $('#task-assign-node', nRow).val(aData.node ? aData.node : '-')
                    if(Cookies.get('userType') == 'UNIT') {
                        $('td:eq(1)', nRow).empty()
                        $('td:eq(1)', nRow).prepend(`<label>${aData.hub}</label>`);
                    }
                    if(Cookies.get('node')) {
                        $('td:eq(2)', nRow).empty()
                        $('td:eq(2)', nRow).prepend(`<label>${aData.node}</label>`);
                    }
                }
                
            }
        });
    }
    let globalUnitList = await getHubNode(userType, userId);
    initDataTableBySys(globalUnitList)
}

window.showJustification = function (e) {
    let row = tableByMb.row($(e).data('row')).data()
    $.alert({
        title: 'Justification',
        content: row.cancelledCause
    });
}

window.reassignApproveSystemTask = async function (dataType, taskId, optType) {
    $.confirm({
        title: 'Info',
        content: `Are you sure to ${optType} the reassign apply?`,
        buttons: {
            cancel: function() {},
            confirm: {
                btnClass: 'btn-green',
                action: function () {
                    axios.post('/assign/reassignMvTaskApprove', { dataType, taskId, optType }).then(function (res) {
                        let respCode = res.respCode ? res.respCode : res.data.respCode;
                        let respMessage = res.respMessage ? res.respMessage : res.data.respMessage;
                        if (respCode == 1) {
                            $.alert({
                                title: 'Info',
                                content: 'Operation Success.'
                            });
                            tableBySys.ajax.reload(null, false) 
                        } else {
                            $.alert({
                                title: 'Error',
                                content: 'Operation fail:' + respMessage
                            });
                        }
                    });
                }
            }
        }
    });
}

const assignTask = async function (dataType, hub, node, taskId, driverId, vehicleNo) {
    return axios.post('/assign/reassignMvTask', { dataType, hub, node, taskId, driverId, vehicleNo })
        .then(function (res) {
            return res;
        });
}

window.getHubNode = async function(userType, userId) {
    return axios.post('/mtAdmin/getHubNode').then(function (res) {
        return res.respMessage ? res.respMessage : res.data.respMessage;
    });
}

const clickSelect = function (){
   if(tableName == 'sys' || tableName == 'atms')  {
        $('.selected-taskStatus').off("change").on("change", function () {
                tableReload()
            }
        )
    }

    $(".tripId").on("keyup", function () {
            tableReload()
        }
     )
     $(".selected-vehicleType").off("change").on("change", function () {
            tableReload()
        }
    )
    $(".select-hub").off("change").on("change", function () {
            tableReload()
        }
    )
    $(".select-node").off("change").on("change", function () {
            tableReload()
        }
    )
    $('.screen-vehicleNo').on('keyup', function () {
        let number = ($(this).val()).split("")
        if(number.length > 2 || number.length == 0) {
            tableReload()
        }
    })
    $('.screen-driverName').on('keyup', function () {
        let number = ($(this).val()).split("")
        if(number.length > 3 || number.length == 0) {
            tableReload()
        }
    })
}