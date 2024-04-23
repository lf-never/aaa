const THEME = {
	Default: {
		color: '#828282',
		bgColor: '#dadada',
	},
	Training: {
		color: '#053823',
		bgColor: '#E1FBEE',
	},
	Admin: {
		color: '#A2510C',
		bgColor: '#FEE9D8',
	},
	Operations: {
		color: '#0F256E',
		bgColor: '#E1EDFB',
	},
	Maintenance: {
		color: '#B67B2B',
		bgColor: '#FFF1D0',
	},
	Familiarisation: {
		color: '#ffffff',
		bgColor: '#b67ad8',
	}
}

let driverCalender = null;
let currentDate = moment(), currentWeek = 0, currentStartDate, currentEndDate;
$(() => {
	initMonthSelectHandler();

	$('.search-input').on('keyup', _.debounce(() => {
		initWeekDaysHandler(currentWeek, currentDate.year(), currentDate.month())
	}, 500 ))

	window.onresize = function(){
		initWeekDaysHandler(currentWeek, currentDate.year(), currentDate.month())
	}
})

const initMonthSelectHandler = function () {
	// Init label before click laydate event 
	$('.selectedMonth').html(moment().format('MMMM YYYY'))
	currentWeek = Math.floor(moment().date() / 7);
	initWeekDaysHandler(currentWeek, moment().year(), moment().month());
	
	// If already init laydate, return;
	if (driverCalender) return;
	// Click laydate event
	layui.use('laydate', async function () {
		driverCalender = layui.laydate;
		await driverCalender.render({
			elem: '#selectedMonth123',
			type: 'month',
			lang: 'en',
			trigger: 'click',
			done: function(value, date, endDate) {
				date.month = date.month - 1;
				currentDate = moment(date);
				$('.selectedMonth').html(moment(date).format('MMMM YYYY')).data('date', date)
				$('#selectedMonth123').find('img').attr('src', '../scripts/driverTo/icons/arrow-down.svg')

				// Init WeekInfo
				if (date.month === moment().month()) {
					currentWeek = Math.floor(date.date / 7);
					initWeekDaysHandler(currentWeek, date.year, date.month);
				} else {
					currentWeek = 0
					initWeekDaysHandler(currentWeek, date.year, date.month);
				}
			}
		});
	});

	$('#selectedMonth123').off('click').on('click', function () {
		$(this).find('img').attr('src', '../scripts/driverTo/icons/arrow-up.svg')

		if (driverCalender.index && driverCalender.index > 0) {
			let laydateId = "layui-laydate" + driverCalender.index;
			setTimeout(() => {
				$("#" + laydateId + " .layui-laydate-content").css('height', '140px');
				$("#" + laydateId + " .layui-laydate-content>table").css('display', 'none');
			}, 300);
		}
	})

	$('.pre-week').off('click').on('click', function () {
		// console.log(currentWeek)
		// console.log(currentDate)
		currentWeek -= 1
		initWeekDaysHandler(currentWeek, currentDate.year(), currentDate.month())
	})
	$('.next-week').off('click').on('click', function () {
		// console.log(currentWeek)
		// console.log(currentDate)
		currentWeek += 1
		initWeekDaysHandler(currentWeek, currentDate.year(), currentDate.month())
	})
}

const initWeekDaysHandler = async function (weekIndex, year, month) {
	const getTOCalenderDriverList = async function (startDate, endDate, unit, subUnit) {
		return await axios.post('/driver/getTOCalenderDriverList', { startDate, endDate, unit, subUnit, driverName: $('.search-input').val().trim() })
			.then(result => { 
				return result.data.respMessage 
			})
	}

	const initWeekDaysLabel = function (weekIndex, year, month) {
		let initDate = moment({ year, month })
		let date = initDate.add(weekIndex, 'W');
		let startDate = date.startOf('isoWeek').format('DD');
		let endDate = date.endOf('isoWeek').format('DD');
		let currentMonth = date.startOf('isoWeek').format('MMM');
		let selectedWeek = `${ currentMonth } ${ startDate }-${ endDate }`
		console.log(`selectedWeek => ${ selectedWeek }`);
		let dateList = []
		for (let index = 0; index < 7; index++) {
			dateList.push(date.startOf('isoWeek').add(index, 'd').format('YYYY-MM-DD HH:mm:ss'))
		}
		$('.selectedWeek').html(selectedWeek)
		return { 
			startDate: date.startOf('isoWeek').format('YYYY-MM-DD'), 
			endDate: date.endOf('isoWeek').format('YYYY-MM-DD'), 
			dateList 
		}
	}
	const initWeekDaysContainer = function (dateList) {
		// Clear all active
		$('.weekday').removeClass('active')
		$('.week').removeClass('active')
		$('td').removeClass('preMonth')
		// Update new date
		$('.weekTaskInfo').find('.weekday').each(function(index, el) {
			$(el).find('label').html(moment(dateList[ index ]).format('DD'))
			// If today, add active class
			if (moment().isSame(moment(dateList[ index ]), 'day')) {
				$(el).addClass('active');
				$(el).parent().parent().find('.week').addClass('active');
			}
			// If pre month, add gray class
			if (moment().isAfter(moment(dateList[ index ]), 'day')) {
				$(el).closest('td').addClass('preMonth')
			}
		})

		// Clear history info
		$('.weekTaskInfo tr').each(function (index) {
			if (index > 0) $(this).remove();
		})
		$('.weekTaskInfo td').find('.indentCount').html(0)
		$('.weekTaskInfo td').find('.driverCount').html(0)
	}

	const getDateLength = function (endDate, startDate) {
		let tempDate1 = moment(startDate).format('YYYY-MM-DD')
		let tempDate2 = moment(endDate).format('YYYY-MM-DD')
		return moment(tempDate2).diff(moment(tempDate1), 'd')
	}

	const isValidTask = function(task, currentDate) {
		return currentDate.get('date') >= moment(task.indentStartTime).get('date') 
			&& currentDate.get('date') <= moment(task.indentEndTime).get('date')
			&& task.taskId && !(task.taskId+"").startsWith('onLeave');
	}

	function getDriverTaskPreTask(currentTask, allTask) {
		let preThoughTask = null;
		for (let tempTask of allTask) {
			if (currentTask.taskId != tempTask.taskId) {
				if (getDateLength(tempTask.indentStartTime, currentTask.indentStartTime) == 0) {
					if (currentTask.indentId != tempTask.indentId) {
						preThoughTask = tempTask;
					}
				} else if (getDateLength(tempTask.indentEndTime, currentTask.indentStartTime) >= 0 
					&& getDateLength(tempTask.indentStartTime, currentTask.indentStartTime) <= 0) {
						preThoughTask = tempTask;
				}
			} else {
				break;
			}
		}
		return preThoughTask;
	}

	function buildTakHtml(index, currentDate, task, driver) {
		let currentTaskHtml = ``;
		let tdWidth = $('.weekTaskInfo td:last').width();
		// while start date is not monday
		let realDateLength = getDateLength(task.indentEndTime, task.indentStartTime) + 1;
		let dayLength = 1;

		let calculateStartDate = null, calculateEndDate = null;
		function caclDateInfo() {
			if (getDateLength(startDate, task.indentStartTime) >= 0) {
				// if indentStartTime is before current week
				calculateStartDate = startDate
			} else {
				// if indentStartTime is in current week
				calculateStartDate = task.indentStartTime
			}
			if (getDateLength(task.indentEndTime, moment(startDate).endOf('isoWeek')) >= 0) {
				// if indentEndTime is after current week
				calculateEndDate = moment(startDate).endOf('isoWeek')
			} else {
				// if indentEndTime is in current week
				calculateEndDate = task.indentEndTime
			}
		}
		caclDateInfo();
		dayLength = getDateLength(calculateEndDate, calculateStartDate) + 1;
		// max size is 7 ever week
		if (dayLength > 7) dayLength = 7;

		if ((index == 0 && moment(moment(currentDate).format('YYYY-MM-DD')).isSameOrAfter(moment(task.indentStartTime).format('YYYY-MM-DD')))
			|| moment(moment(currentDate).format('YYYY-MM-DD')).isSame(moment(task.indentStartTime).format('YYYY-MM-DD'))) {
			let theme = "Default";
			function caclTheme() {
				if (task.purpose == 'Driving Training' || task.purpose == 'Training') theme = 'Training';
				if (task.purpose == 'Maintenance') theme = 'Maintenance';
				if (task.purpose == 'Familiarisation') theme = 'Familiarisation';
				if (task.purpose == 'Admin' || task.purpose == 'Duty') theme = 'Admin';
				if (task.purpose == 'Ops' || task.purpose == 'Others' || task.purpose == 'Operation') theme = 'Operations';
			}
			caclTheme();

			let bgColor = Object.keys(THEME).includes(theme) ? THEME[theme].bgColor : THEME.Default.bgColor;
			let color = Object.keys(THEME).includes(theme) ? THEME[theme].color : THEME.Default.color;

			let preThoughTask = getDriverTaskPreTask(task, driver.taskList);

			let marginTop = preThoughTask ? (preThoughTask.marginTop + 35) : 0; //(hasPreTaskOgThough) * 35
			task.marginTop = marginTop;
			if ((task.taskId + "").startsWith('onLeave')) {
				// This on-leave record
				let label = '';
				function buildLabel() {
					if (realDateLength > 1) {
						label = `${task.reason} , ${moment(task.indentStartTime).format('MM-DD HH:mm')} - ${moment(task.indentEndTime).format('MM-DD HH:mm')}`;
					} else {
						label = `${task.reason} ,  ${moment(task.indentStartTime).format('HH:mm')} - ${moment(task.indentEndTime).format('HH:mm')}`;
					}
				}
				buildLabel();
				let eventStartDate = moment(task.indentStartTime).format('YYYY-MM-DD');
				let eventEndDate = moment(task.indentEndTime).format('YYYY-MM-DD');

				currentTaskHtml += `
					<div class="driver-task-container driver-leave" title="${label}"
						style="color: #bd0707; margin-top: ${marginTop}px; position: absolute; width: ${dayLength * tdWidth + (dayLength - 1) * 20}px;"
						oncontextmenu="markAsUnAvailable1(${driver.driverId}, '${driver.driverName}', '${eventStartDate}', '${eventEndDate}')">
						${label}
					</div>
				`;
			} else {
				// for show while task need more than one day
				let label = '';
				let taskTypeLabel = '';
				function buildLabel() {
					if (task.taskId.indexOf('CU-') > -1) {
						taskTypeLabel = 'CU-';
					} else if (task.dataFrom == 'MT-ADMIN') {
						taskTypeLabel = 'MT-';
					} else if (task.dataFrom == 'SYSTEM') {
						taskTypeLabel = 'SYS-';
					}
	
					if (realDateLength > 1) {
						label = `${taskTypeLabel + task.purpose}, ${moment(task.indentStartTime).format('MM-DD HH:mm')} - ${moment(task.indentEndTime).format('MM-DD HH:mm')}`;
					} else {
						label = `${taskTypeLabel + task.purpose}, ${moment(task.indentStartTime).format('HH:mm')} - ${moment(task.indentEndTime).format('HH:mm')}`;
					}
				}
				buildLabel();

				currentTaskHtml += `
					<div class="driver-task-container active " title="${label}" style="margin-top: 8px; background-color: ${bgColor}; color: ${color}; 
						width: ${dayLength * tdWidth + (dayLength - 1) * 20}px; position: absolute; margin-top: ${marginTop}px;" 
						onclick="editDriverTask('${task.taskId}', '${task.indentStartTime}')" role="button" tabindex="0">
						${label}
					</div>
				`;
			}
		}
		return currentTaskHtml;
	}

	const initDriverContainer = async function (startDate, driver) {
		let html = `
			<td>
				<div class="d-flex flex-row justify-content-start">
					<div class="bd-highlight px-1"><label class="driverName">${ driver.driverName }</label></div>
				</div>
				<div class="d-flex flex-row justify-content-start">
					<div class="bd-highlight px-1">
						<img alt="" class="date-img" src="../scripts/driverTo/icons/file.svg">
						<label class="date-label">${ driver.taskList.filter(item => item.taskId).length }</label>
					</div>
				</div>
			</td>
		`;

		let maxTaskMarginTop = 0;
		// index => Use for judge current date index
		for (let index = 0; index < 7; index++) {
			let taskHtml = ``, totalTask = [], totalDriver = [];

			let currentDate = moment(startDate).add(index, 'day');

			for (let task of driver.taskList) {
				// IF through monday, need check here
				taskHtml += buildTakHtml(index, currentDate, task, driver);

				if (task.marginTop > maxTaskMarginTop) {
					maxTaskMarginTop = marginTop;
				}
				if (isValidTask(task, currentDate)) {
					totalTask.push(task.indentId);
					totalDriver.push(driver.driverId);
				}
			}

			html += `
				<td oncontextmenu="markAsUnAvailable(${driver.driverId}, '${driver.driverName}', '${moment(startDate).add(index, 'day').format('YYYY-MM-DD HH:mm:ss')}')" 
					style="vertical-align: top;" class="${ currentDate.isBefore(moment(), 'day') ? 'preMonth' : '' }">
					${ taskHtml }
				</td>
			`

			let $targetTD = $('.weekTaskInfo tr').eq(0).find('td').eq(index + 1)

			let targetIndentCount = Number.parseInt($targetTD.find('.indentCount').html())
			$targetTD.find('.indentCount').html(targetIndentCount + totalTask.length)

			let targetDriverCount = Number.parseInt($targetTD.find('.driverCount').html())
			$targetTD.find('.driverCount').html(targetDriverCount + Array.from(new Set(totalDriver)).length)
		}	

		let trHeight = maxTaskMarginTop + 50;
		html = `<tr style="height: ${trHeight}px;">${html}</tr>`
		$('.weekTaskInfo').append(html)
	}

	let { startDate, endDate, dateList } = initWeekDaysLabel(weekIndex, year, month);
	currentStartDate = startDate;
	currentEndDate = endDate;
	console.log(startDate)
	initWeekDaysContainer(dateList);
	let unit = Cookies.get('selectedUnit');
	let subUnit = Cookies.get('selectedSubUnit');
	let driverList = await getTOCalenderDriverList(startDate, endDate, unit, subUnit);

	for (let driver of driverList) {
		initDriverContainer(currentStartDate, driver);
	}
}

const editDriverTask = function(taskId, indentStartTime) {
	let nowTime = moment();
	indentStartTime = moment(indentStartTime);

		$('#driver-task-edit').modal('show');
		axios.post('/driver/getDriverTaskByTaskId', { taskId: taskId}).then(res => { 
			let task = res.data.respMessage;
			if (task) {
				if (indentStartTime.isAfter(nowTime)) {
					initTaskEditPage(task, 'driver');
				} else {
					initTaskViewPage(task, 'driver');
				}
			}
		})
	//}
}

const markAsUnAvailable = function(driverId, driverName, date) {
	
	$('#driver-markAsUnavailable').modal('show');
	event.preventDefault();
	event.stopPropagation();

	initMarkAsUnAvailablePage(driverId, driverName, date, date);
	return false;
}

const markAsUnAvailable1 = function(driverId, driverName, date, endDate) {
	event.preventDefault();
	event.stopPropagation();

	$('#driver-markAsUnavailable').modal('show');
	if (endDate) {
		endDate = moment(endDate + " 23:59:59").add(1, 'minute').format("YYYY-MM-DD");
	}

	initMarkAsUnAvailablePage(driverId, driverName, date, endDate);
	return false;
}

const markAsUnAvailableCallback = function() {
	initWeekDaysHandler(currentWeek, currentDate.year(), currentDate.month())
}

window.reloadHtml = function () {
	window.location.reload();
}