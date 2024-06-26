let userType = Cookies.get('userType').toUpperCase()
$(function () {
    initPage()
    $('#task-report-create').on('click', async function () {
        await createVehicleReport()
    })
    $('.hub-node-div').show()
    // $('.hub-node-check').show()
    if (userType != 'ADMINISTRATOR' && userType != 'HQ') {
        $('.hub-node-div').hide()
        // $('.hub-node-check').hide()
    }

    $('.report-data-group input').off('click').on('click', function () {
        let val = $(this).val()
        let name = $(this).attr('name')
        if ($(this).prop('checked')) {
            addDataGroupEventHandler(val, name)
        } else {
            removeSelectedReportDataGroup(val)
            removeReportDataFilter(name)
        }
    })

    $("#select-all-checkbox").on('click', async function () {
        let selectAll = $(this).prop('checked')
        $('.report-data-group input[type="checkbox"]').each(function () {
            if ($(this).prop('checked') != selectAll) {
                $(this).trigger('click')
            }
        })
    })
})

const initPage = async function(){
    const initCategory = function () {
        axios.post("/vehicle/getTypeOfVehicle").then(async res => {
            let vehicleTypeArray = res.data;
            if (!vehicleTypeArray) {
                vehicleTypeArray = res;
            }
            let categoryList = vehicleTypeArray.map(item => item.category)
            categoryList = Array.from(new Set(categoryList))
            if (categoryList.length > 0) {
                $('#vehicleCategory').empty();
                let optionHtml = `<option value="">All</option>`;
                for(let item of categoryList) {
                    if (item) optionHtml += `<option val="${item}">${item}</option>`
                }
                $('#vehicleCategory').append(optionHtml);
            }
        })
    }
    initCategory()

    const initPermitTypeData = function () {
        axios.post("/driver/getPermitTypeList").then(async res => {
            let permitTypeList = res.data.respMessage;
            $("#permitType").empty();
            let optionHtml = `<option value="">All</option>`;
            for (let item of permitTypeList) {
                optionHtml += `<option value="${item.permitType}" >${item.permitType}</option>`
            }
            $("#permitType").append(optionHtml);
        })
    }
    initPermitTypeData();

    const initStatus = function () {
        axios.post("/vehicle/getTOVehicleStatusList").then(async res => {
            let vehicleStatusList = res.data.respMessage;
            $("#vehicleStatus").empty();
            let optionHtml = `<option value="">All</option>`;
            for (let item in vehicleStatusList) {
                optionHtml += `<option value="${vehicleStatusList[item]}" >${vehicleStatusList[item]}</option>`
            }
            $("#vehicleStatus").append(optionHtml);
        })
    }
    initStatus()

    const initLayDate = function () {
        layui.use('laydate', function(){
            let laydate = layui.laydate;
    
            laydate.render({
                elem: '#WPT1-Date-Range',
                format: 'dd/MM/yyyy',
                type: 'date',
                lang: 'en',
                range: true,
                trigger: 'click',
                btns: ['clear', 'confirm']
            });

            laydate.render({
                elem: '#WPT2-Date-Range',
                format: 'dd/MM/yyyy',
                type: 'date',
                lang: 'en',
                range: true,
                trigger: 'click',
                btns: ['clear', 'confirm']
            });

            laydate.render({
                elem: '#WPT3-Date-Range',
                format: 'dd/MM/yyyy',
                type: 'date',
                lang: 'en',
                range: true,
                trigger: 'click',
                btns: ['clear', 'confirm']
            });
    
            laydate.render({
                elem: '#MPT-Date-Range',
                format: 'dd/MM/yyyy',
                type: 'date',
                lang: 'en',
                range: true,
                trigger: 'click',
                btns: ['clear', 'confirm']
            })

            laydate.render({
                elem: '#PM-Date-Range',
                format: 'dd/MM/yyyy',
                type: 'date',
                lang: 'en',
                range: true,
                trigger: 'click',
                btns: ['clear', 'confirm']
            })

            laydate.render({
                elem: '#AVI-Date-Range',
                format: 'dd/MM/yyyy',
                type: 'date',
                lang: 'en',
                range: true,
                trigger: 'click',
                btns: ['clear', 'confirm']
            })

            laydate.render({
                elem: '#reportDateRange',
                lang: 'en',
                type: 'date',
                trigger: 'click',
                format: 'yyyy-MM-dd',
                btns: ['clear', 'confirm'],
                range: '~',
                done: function () {
                }
            })
        });
    }
    initLayDate();

    const initHubNodeFilter = async function () {
        await axios.post("/unit/getHubNodeList").then(res => {
            let hubNodeList = res.respMessage ?? res.data.respMessage ;
            return hubNodeList
        })
    }
    const initHubNode = function (hubNodeList){
        let list = hubNodeList.map(o => {
            return `<option value="${o.hub}">${o.hub}</option>`
        }).join('')
        $("#hubFilter").append(list)
        $("#hubFilter").off('change').on('change', function(){
            let hub = $("#hubFilter").val()
            if(!hub){
                $("#nodeFilter").empty()
                $("#nodeFilter").append(`<option value="">All</option>`)
                return
            } 
            let item = hubNodeList.find(o => o.hub == hub)
            let nodeList = item.nodeList
            let list = nodeList.split(',').map(o => {
                return `<option value="${o}">${o}</option>`
            }).join('')
            $("#nodeFilter").empty()
            $("#nodeFilter").append(`<option value="">All</option>` + list)
        })
    }
    let hubNodeList = await initHubNodeFilter()
    initHubNode(hubNodeList)

    const initSupportedUnit = async function () {
        await axios.post("/getGroupList").then(res => {
            //console.log(res)
            let groupList = res.respMessage ?? res.data.respMessage;

            let list = groupList.map(o => {
                return `<option value="${o.id}">${o.groupName}</option>`
            }).join('')
            $("#supportedUnitFilter").append(list)
        })
    }
    initSupportedUnit()
}

const createVehicleReport = async function () {
    let reportGroupSelectionTitle = []
    $('.drag-list > li').each(function () {
        let val = $(this).attr("data-val")
        let name = $(this).attr("data-name")     
        if (name == "hubNode") {
            reportGroupSelectionTitle.push('Hub/Node')
        } else {
            reportGroupSelectionTitle.push(val)
        }
    })
    console.log(reportGroupSelectionTitle)
    if(reportGroupSelectionTitle.length <= 0) {
        $.alert({
            title: 'Warn',
            content: `Select report data.`,
        });
        return
    }
    window.parent.showLoading();
    await axios.post("/reportCreator/getVehicleReportList", { 
        reportGroupSelectionTitle: reportGroupSelectionTitle, 
        reportDateRange: $("#reportDateRange").val(), 
        vehicleCategory: $("#vehicleCategory").val(), 
        permitType: $("#permitType").val(), 
        hub: $("#hubFilter").val(), 
        node: $("#nodeFilter").val(), 
        vehicleStatus: $("#vehicleStatus").val(), 
        WPT1CompletionDateRange: $("#WPT1-Date-Range").val() ? initDate($("#WPT1-Date-Range").val()) : null, 
        WPT2CompletionDateRange: $("#WPT2-Date-Range").val() ? initDate($("#WPT2-Date-Range").val()) : null, 
        WPT3CompletionDateRange: $("#WPT3-Date-Range").val() ? initDate($("#WPT3-Date-Range").val()) : null,
        MPTCompletionDateRange: $("#MPT-Date-Range").val() ? initDate($("#MPT-Date-Range").val()) : null,
        PMCompletionDateRange: $("#PM-Date-Range").val() ? initDate($("#PM-Date-Range").val()) : null,
        AVICompletionDateRange: $("#AVI-Date-Range").val() ? initDate($("#AVI-Date-Range").val()) : null
    }).then(async res => {
        console.log(res)
        window.parent.closeLoading();
        if (res.respCode == 0) {
            $.alert({
                title: 'Warn',
                content: `Create Failed`,
            });
            return
        }
        if (res.respMessage) {
            let filename = res.respMessage
            window.location.href = "/reportCreator/downloadExcel?filename=" + filename
        }
    })
}

const initDate = function(date) {
    if (date) {
        if (date.indexOf('-') != -1) {
            const dates = date.split(' - ')
            if(dates.length > 0) {
                dates[0] = moment(dates[0], 'DD/MM/YYYY').format('YYYY-MM-DD')
                dates[1] = moment(dates[1], 'DD/MM/YYYY').format('YYYY-MM-DD')
                date = dates.join(' - ')
            }
        } else {
            date = moment(date, 'DD/MM/YYYY').format('YYYY-MM-DD')
        }
        return date
    }
}

const addDataGroupEventHandler = async function (val, name) {
    const dragEventHandler = function () {
        $('.drag-list > li').arrangeable({ dragSelector: '.drag-area' });
        $('.drag-area').off('mousedown');
        $('.drag-area').off('mouseleave');
        $('.drag-area').off('mouseup');
        $('.drag-area').on('mousedown', function () {
        });
        $('.drag-area').on('mouseleave', function () {
            $(this).parent().css('background-color', 'rgba(0, 0, 0, 0)');
        });
        $('.drag-area').on('mousemove', function (e) {
        });

        $('.div-report-group-list').scrollTop($('.drag-list').height());
    }
    const generateListHtml = function () {
        let html = `
        <li data-val="${val}" data-name="${name}">
            <div class="row justify-content-center">
                <div class="col-2">
                    <span class="drag-area"></span>
                </div>
                <div class="col-9">
                    <input type="text" class="form-control" readonly value="${val}">
                </div>
                <div class="col-1">
                    <button type="button" class="btn btn-sm custom-btn btn-primary" style="width: 30px;" onclick="removeReportDataGroup(this)">-</button>
                </div>
            </div>
        </li>
        `
        $('.drag-list').append(html);
        if (name == 'odometer') {
            return
        }
    }
    generateListHtml();
    dragEventHandler();

   
}

const removeSelectedReportDataGroup = function (val) {
    $('.drag-list > li').each(function () {
        if ($(this).attr("data-val") == val) {
            $(this).remove()
        }
    })
}
const removeReportDataGroup = function (e) {
    let val = $(e).closest('li').attr("data-val")
    let name = $(e).closest('li').attr("data-name")
    $(e).closest('li').remove()
    removeReportDataFilter(name)
    $('.report-data-group input[type="checkbox"]').each(function () {
        if ($(this).val() == val) {
            $(this).prop('checked', false)
        }
    })
}
const removeReportDataFilter = function (name) {
    $('.div-report-data-filter div').each(function () {
        if ($(this).attr('data-filter') == name) {
            $(this).remove()
        }
    })
}
