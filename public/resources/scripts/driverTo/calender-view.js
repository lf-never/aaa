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
	const initWeekDaysLabel = function (weekIndex, year, month) {
		let date = moment({ year, month });
		date = date.add(weekIndex, 'W');
		let startDate = date.startOf('isoWeek').format('DD');
		let endDate = date.endOf('isoWeek').format('DD');
		let currentMonth = date.startOf('isoWeek').format('MMM');
		selectedWeek = `${ currentMonth } ${ startDate }-${ endDate }`
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

	const initDriverContainer = async function (startDate, driverList) {
		let driverIndex = 0;
		for (let driver of driverList) {
			// if (driver.driverName != 'br100-2') continue;
			driverIndex ++;
			let html = `
				<td>
					<div class="d-flex flex-row justify-content-start">
						<div class="bd-highlight px-1"><label class="driverName">${ driver.driverName }</label></div>
					</div>
					<div class="d-flex flex-row justify-content-start">
						<div class="bd-highlight px-1">
							<img class="date-img" src="../scripts/driverTo/icons/file.svg">
							<label class="date-label">${ driver.taskList.filter(item => item.taskId).length }</label>
						</div>
					</div>
				</td>
			`;

			// let driverLeaveDays = await axios.post('/driver/getDriverLeaveDays',{
			// 	driverId: driver.driverId
			// }).then(function (res) {
			// 	if (res.data.respCode === 1) {
			// 		return res.data.respMessage
			// 	} else {
			// 		return [];
			// 	}
			// });

			let tdWidth = $('.weekTaskInfo td:last').width();

			let maxTaskMarginTop = 0;
			// index => Use for judge current date index
			for (let index = 0; index < 7; index++) {
				let taskHtml = ``, totalTask = [], totalDriver = [];
				// let checkTask = false;
				let currentDate = moment(startDate).add(index, 'day');

				let barCount = 0;
				for (let task of driver.taskList) {
					// console.log(task)

					// while start date is not monday
					let realDateLength = getDateLength(task.indentEndTime, task.indentStartTime) + 1;
					let dayLength = 1;

					let calculateStartDate = null, calculateEndDate = null;
					if (getDateLength(startDate, task.indentStartTime) >= 0) {
						// TODO: if indentStartTime is before current week
						calculateStartDate = startDate
					} else {
						// TODO: if indentStartTime is in current week
						calculateStartDate = task.indentStartTime
					}
					if (getDateLength(task.indentEndTime, moment(startDate).endOf('isoWeek')) >= 0) {
						// TODO: if indentEndTime is after current week
						calculateEndDate = moment(startDate).endOf('isoWeek')
					} else {
						// TODO: if indentEndTime is in current week
						calculateEndDate = task.indentEndTime
					}
					dayLength = getDateLength(calculateEndDate, calculateStartDate) + 1;
					// TODO: max size is 7 ever week
					if (dayLength > 7) dayLength = 7;

					// if (moment(moment(startDate).add(6, 'day').format('YYYY-MM-DD')).isBefore(moment(task.indentEndTime).format('YYYY-MM-DD'))) {
					// 	console.log(111)
					// 	dayLength = getDateLength(moment(startDate).endOf('isoWeek'), task.indentStartTime) + 1
					// 	if (dayLength > 7) dayLength = 7
					// } else if (moment(startDate).isSameOrBefore(moment(task.indentStartTime))) {
					// 	console.log(222)
					// 	dayLength = getDateLength(task.indentEndTime, task.indentStartTime) + 1
					// } else {
					// 	console.log(333)
					// 	dayLength = getDateLength(task.indentEndTime, startDate) + 1
					// }
					// console.log('dayLength -> ', dayLength)
					
					// IF through monday, need check here
					// if ((index == 0 && currentDate.get('date') >= moment(task.indentStartTime).get('date')) 
					if ((index == 0 && moment(moment(currentDate).format('YYYY-MM-DD')).isSameOrAfter(moment(task.indentStartTime).format('YYYY-MM-DD'))) 
					// || currentDate.isSame(task.indentStartTime, 'day')) {
					|| moment(moment(currentDate).format('YYYY-MM-DD')).isSame(moment(task.indentStartTime).format('YYYY-MM-DD'))) {

						// if (currentDate.isSame(task.indentStartTime, 'day')) {
						barCount ++;
						let theme = "Default"
						if (task.purpose == 'Driving Training' || task.purpose == 'Training') theme = 'Training'
						if (task.purpose == 'Maintenance') theme = 'Maintenance'
						if (task.purpose == 'Familiarisation') theme = 'Familiarisation'
						if (task.purpose == 'Admin' || task.purpose == 'Duty') theme = 'Admin'
						if (task.purpose == 'Ops' || task.purpose == 'Others' || task.purpose == 'Operation') theme = 'Operations'

						let bgColor = Object.keys(THEME).includes(theme) ? THEME[theme].bgColor : THEME.Default.bgColor;
						let color = Object.keys(THEME).includes(theme) ? THEME[theme].color : THEME.Default.color

						// TODO: check if exist other task through today
						// let hasPreTaskOgThough = 0;
						// let targetTaskList = driver.taskList.filter(item => {
						// 	return item.driverId == task.driverId && item.taskId != task.taskId
						// })
						// for (let tempTask of targetTaskList) {
						// 	if (moment(tempTask.indentStartTime).get('date') == moment(task.indentStartTime).get('date')) {
						// 		if (moment(tempTask.indentStartTime).isBefore(task.indentStartTime)) {
						// 			hasPreTaskOgThough ++;
						// 		} else if (moment(tempTask.indentStartTime).isSame(task.indentStartTime)) {
						// 			if (task.indentId > tempTask.indentId) {
						// 				hasPreTaskOgThough ++;
						// 			}
						// 		}
						// 	} else if (moment(tempTask.indentEndTime).get('date') >= moment(task.indentStartTime).get('date') 
						// 		&& moment(tempTask.indentStartTime).get('date') <= moment(task.indentStartTime).get('date')) {
						// 		// console.log(tempTask)
						// 		hasPreTaskOgThough ++;
						// 	}
						// }
						// TODO: check if exist on-leave task before( on-leave only happen in one day )
						// if (task.taskId) {
						// 	let onLeaveTaskList = driver.taskList.filter(item => {
						// 		if (item.driverId == task.driverId && !item.taskId) {
						// 			if (moment(item.indentStartTime).get('date') < moment(task.indentStartTime).get('date')
						// 			&& moment(item.indentEndTime).get('date') >= moment(task.indentStartTime).get('date')) {
						// 				return true;
						// 			}
						// 		}
						// 	})
						// 	hasPreTaskOgThough += onLeaveTaskList.length
						// }
						let preThoughTask = null;
						for (let tempTask of driver.taskList) {
							if (task.taskId != tempTask.taskId) {
								// if (moment(tempTask.indentStartTime).diff(moment(task.indentStartTime), 'd') == 0) {
								if (getDateLength(tempTask.indentStartTime, task.indentStartTime) == 0) {
									if (task.indentId != tempTask.indentId) {
										preThoughTask = tempTask;
									}
								// } else if (moment(tempTask.indentEndTime).diff(moment(task.indentStartTime), 'd') >= 0 
								// 	&& moment(tempTask.indentStartTime).diff(moment(task.indentStartTime), 'd') <= 0) {
								} else if (getDateLength(tempTask.indentEndTime,task.indentStartTime) >= 0 
									&& getDateLength(tempTask.indentStartTime, task.indentStartTime) <= 0) {
										preThoughTask = tempTask;
								}
							} else {
								break;
							}
						}

						let marginTop = preThoughTask ? (preThoughTask.marginTop + 35) : 0;//(hasPreTaskOgThough) * 35
						if (task.taskId && (task.taskId+"").startsWith('onLeave')) {
							// This on-leave record
							let label = ''
							if (realDateLength > 1) {
								label = `${ task.reason + `, ` + moment(task.indentStartTime).format('MM-DD HH:mm') + '-' + moment(task.indentEndTime).format('MM-DD HH:mm') }`
							} else {
								label = `${ task.reason + `, ` + moment(task.indentStartTime).format('HH:mm') + '-' + moment(task.indentEndTime).format('HH:mm') }`
							}
							let eventStartDate = moment(task.indentStartTime).format('YYYY-MM-DD');
							let eventEndDate = moment(task.indentEndTime).format('YYYY-MM-DD');

							taskHtml += `
								<div class="driver-task-container driver-leave" title="${label}"
									style="color: #bd0707; margin-top: ${ marginTop }px; position: absolute; width: ${ dayLength * tdWidth + (dayLength - 1) * 20 }px;"
									oncontextmenu="markAsUnAvailable1(${driver.driverId}, '${driver.driverName}', '${eventStartDate}', '${eventEndDate}')">
									${label}
								</div>
							`;
						} else {
							// TODO: for show while task need more than one day
							let label = ''
							let taskTypeLabel = task.taskId.indexOf('CU-') != -1 ? 'CU-' : task.dataFrom == 'MT-ADMIN' ? 'MT-' : task.dataFrom == 'SYSTEM' ? 'SYS-' : '';
							if (realDateLength > 1) {
								label = `${taskTypeLabel + task.purpose }, ${ moment(task.indentStartTime).format('MM-DD HH:mm') } - ${ moment(task.indentEndTime).format('MM-DD HH:mm')}`
							} else {
								label = `${taskTypeLabel + task.purpose }, ${ moment(task.indentStartTime).format('HH:mm') } - ${ moment(task.indentEndTime).format('HH:mm')}`
							}

							taskHtml += `
								<div class="driver-task-container active " title="${label}" style="margin-top: 8px; background-color: ${ bgColor }; color: ${ color }; 
									width: ${ dayLength * tdWidth + (dayLength - 1) * 20 }px; position: absolute; margin-top: ${ marginTop }px;" 
									onclick="editDriverTask('${task.taskId}', '${task.indentStartTime}')">
									${ label }
								</div>
							`;
						}
						
						if (marginTop > maxTaskMarginTop) {
							maxTaskMarginTop = marginTop;
						}
						task.marginTop = marginTop
						
						// checkTask = true;
					}

					if (currentDate.get('date') >= moment(task.indentStartTime).get('date') && currentDate.get('date') <= moment(task.indentEndTime).get('date')) {
						if (task.taskId && !(task.taskId+"").startsWith('onLeave')) {
							totalTask.push(task.indentId);
							totalDriver.push(driver.driverId)
						}
					}
				}

				// if (!checkTask) {
				// 	let isPreDay = currentDate.isBefore(moment(), 'day');
				// 	let isDriverLeave = driverLeaveDays.indexOf(currentDate.format('YYYY-M-D')) != -1;

				// 	if (isPreDay) {
				// 		if(isDriverLeave) {
				// 			// html += `<td class="empty-task-td driver-leave" ></td>`
				// 			taskHtml += `
				// 				<div class="driver-task-container driver-leave" oncontextmenu="markAsUnAvailable(${driver.driverId}, '${driver.driverName}', '${moment(startDate).add(index, 'day')}')">
				// 					<label>On Leave</label>
				// 				</div>
				// 			`
				// 		}
				// 	} else {
				// 		if (isDriverLeave) {
				// 			// html += `<td class="empty-task-td driver-leave" oncontextmenu="markAsUnAvailable(${driver.driverId}, '${driver.driverName}', '${moment(startDate).add(index, 'day')}')"></td>`
				// 			taskHtml += `
				// 				<div class="driver-task-container driver-leave" class="driver-leave" oncontextmenu="markAsUnAvailable(${driver.driverId}, '${driver.driverName}', '${moment(startDate).add(index, 'day')}')">
				// 					<label>On Leave</label>
				// 				</div>
				// 			`
				// 		} else {
				// 			// html += `<td class="empty-task-td" oncontextmenu="markAsUnAvailable(${driver.driverId}, '${driver.driverName}', '${moment(startDate).add(index, 'day')}')"></td>`
				// 			taskHtml += `
				// 				<div class="driver-task-container" oncontextmenu="markAsUnAvailable(${driver.driverId}, '${driver.driverName}', '${moment(startDate).add(index, 'day')}')">
				// 					<label></label>
				// 				</div>
				// 			`
				// 		}
				// 	}
					
				// } else {
				// 	// html += `
				// 	// 	<td class="${ currentDate.isBefore(moment(), 'day') ? 'preMonth' : '' }">
				// 	// 		${ taskHtml }
				// 	// 	</td>
				// 	// `
				// }

				
				html += `
					<td oncontextmenu="markAsUnAvailable(${driver.driverId}, '${driver.driverName}', '${moment(startDate).add(index, 'day').format('YYYY-MM-DD HH:mm:ss')}')" 
						style="vertical-align: top;" class="${ currentDate.isBefore(moment(), 'day') ? 'preMonth' : '' }">
						${ taskHtml }
					</td>
				`

				// debugger
				// console.log(totalTask.length)
				// console.log(Array.from(new Set(totalDriver)).length)
				// console.log(index)
				// debugger
				// Init Column Count Num
				let $targetTD = $('.weekTaskInfo tr').eq(0).find('td').eq(index + 1)

				let targetIndentCount = Number.parseInt($targetTD.find('.indentCount').html())
				$targetTD.find('.indentCount').html(targetIndentCount + totalTask.length)

				let targetDriverCount = Number.parseInt($targetTD.find('.driverCount').html())
				$targetTD.find('.driverCount').html(targetDriverCount + Array.from(new Set(totalDriver)).length)
			}

			// let diffStartDay = moment(driver.indentStartTime).diff(moment(startDate), 'day');
			// // console.log(diffStartDay)
			// for (let i = 0; i < diffStartDay; i++) {
			// 	html += `<td class="${ moment(startDate).add(i, 'day').isBefore(moment(), 'day') ? 'preMonth' : '' }"></td>`;
			// }
			// let indentDaysCount = driver.indentEndTime ? (moment(driver.indentEndTime).diff(moment(), 'day')) : 1
			// html += `
			// 	<td colspan="${ indentDaysCount }" class="${ moment(startDate).add(diffStartDay, 'day').isBefore(moment(), 'day') ? 'preMonth' : '' }">
			// 		<div class="driver-task-container active">
			// 			<label>${ driver.purpose }<br><span>${ moment(driver.indentStartTime).format('HH:mm') }</span></label>
			// 		</div>
			// 	</td>
			// `
			// for (let i = 0; i < (7 - diffStartDay - indentDaysCount); i++) {
			// 	html += `<td class="${ moment(startDate).add(diffStartDay + indentDaysCount + i, 'day').isBefore(moment(), 'day') ? 'preMonth' : '' }"></td>`
			// }	

			let trHeight = maxTaskMarginTop + 50;
			html = `<tr style="height: ${trHeight}px;">${html}</tr>`
			$('.weekTaskInfo').append(html)
		}
	}
	const getTOCalenderDriverList = async function (startDate, endDate, unit, subUnit) {
		return await axios.post('/driver/getTOCalenderDriverList', { startDate, endDate, unit, subUnit, driverName: $('.search-input').val().trim() })
			.then(result => { 
				return result.data.respMessage 
			})
	}

	let { startDate, endDate, dateList } = initWeekDaysLabel(weekIndex, year, month);
	currentStartDate = startDate;
	currentEndDate = endDate;
	console.log(startDate)
	initWeekDaysContainer(dateList);
	let unit = Cookies.get('selectedUnit');
	let subUnit = Cookies.get('selectedSubUnit');
	let driverList = await getTOCalenderDriverList(startDate, endDate, unit, subUnit);
	// let driverList = [
	// 	{
	// 		driverId: 1,
	// 		driverName: 'AAA', 
	// 		taskList: [
	// 			{
	// 				indentId: 1,
	// 				purpose: 'Purpose 1',
	// 				indentStartTime: '2022-11-3 10:00:00',
	// 			},
	// 			{
	// 				indentId: 2,
	// 				purpose: 'Purpose 2',
	// 				indentStartTime: '2022-11-3 16:00:00',
	// 			}
	// 		]
	// 	},
	// 	{
	// 		driverId: 2,
	// 		driverName: 'BBB', 
	// 		taskList: [
	// 			{
	// 				indentId: 11,
	// 				purpose: 'Purpose 1',
	// 				indentStartTime: '2022-11-4 10:00:00',
	// 			},
	// 			{
	// 				indentId: 12,
	// 				purpose: 'Purpose 2',
	// 				indentStartTime: '2022-11-5 16:00:00',
	// 			}
	// 		]
	// 	}
	// ]
	initDriverContainer(currentStartDate, driverList);
}

const editDriverTask = function(taskId, indentStartTime) {
	let nowTime = moment();
	indentStartTime = moment(indentStartTime);
	let action = 'edit';
	//if (indentStartTime.isAfter(nowTime)) {
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
	event.returnValue=false;

	initMarkAsUnAvailablePage(driverId, driverName, date, date);
	return false;
}

const markAsUnAvailable1 = function(driverId, driverName, date, endDate) {
	event.returnValue=false;
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