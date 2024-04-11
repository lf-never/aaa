

$(() => {
	// ChatUtil.initChatModal(6)
})

var ChatUtil = function () {
	let currentUser, targetUser;
	let historyChatMessageList = [];
	let chatInterval = null;

	const getSimpleChatInfo = function (userId) {
		return axios.post('/chat/getSimpleChatInfo', { userId })
			.then(function (res) {
				if (res.data.code === 1) {
					return res.data.data
				} else {
					console.error(res.data.msg);
					return null
				}
			});
	}
	const getSimpleChatMessageInfo = function (userId, targetUserId, startTime, endTime) {
		return axios.post('/chat/getSimpleChatMessageInfo', { userId, targetUserId, startTime, endTime })
			.then(function (res) {
				if (res.data.code === 1) {
					return res.data.data
				} else {
					console.error(res.data.msg);
					return null
				}
			});
	}
	
	const initChatModal = async function (userId) {
		console.log('initChatModal => userId: ', userId);
		let chatInfo = await getSimpleChatInfo(userId);
		currentUser = chatInfo.user;
		targetUser = chatInfo.targetUser[0];
		openChatModal(chatInfo.user, chatInfo.targetUser[0], initCloseChatModalHandler)
		historyChatMessageList = await getSimpleChatMessageInfo(userId, targetUser.id);
		generateChatMessageContent(userId, historyChatMessageList)

		initChatModalEventHandler();
		initChatMessageHandler();
	}
	const openChatModal = function (user, targetUser, callback) {
		let layerIndex = layer.open({
			type: 1,
			closeBtn: 2,
			area: ['800px', '700px'],
			title: targetUser.username,
			skin: 'layer-chat',
			content: $('#chat-div').html(),
			btn: [],
			success: function () {
				console.log('open chat modal success.');
			},
			cancel: function () {
				layer.close(layerIndex)
			},
			end: function () {
				console.log('close chat modal');
				return callback();
			}
		});
	}
	const initChatModalEventHandler = function () {

		const sendChatMessage = function (message) {
			// Will return message ID
			return axios.post('/chat/sendChatMessage', { message })
				.then(function (res) {
					if (res.data.code === 1) {
						return res.data.data;
					} else {
						console.error(res.data.msg);
						return 0;
					}
				});
		}

		const initSimpleMessageEventHandler = function () {
			$('.send-message').off('click').on('click', function () {
				let content = $(this).closest('.input-div').find('input').val()?.trim();
				if (!content) return;
				console.log(content)
				let message = {
					fromUser: currentUser.id,
					toUser: targetUser.id,
					fromUsername: currentUser.username,
					toUsername: targetUser.username,
					messageType: 'text',
					chatType: 'room',
					content: content,
					contentSize: content.length,
					messageTime: moment().valueOf()
				}
				sendChatMessage(message).then(messageId => {
					if (messageId) {
						message.id = messageId
						historyChatMessageList.push(message);
						generateChatMessageContent(userId, [message]);
						$(this).closest('.input-div').find('input').val(null);
					} else {
						parent.simplyError(`Message send failed, please try again!`)
					}
				});
			})
		}

		const initEnterClickEventHandler = function () {
			$(document).on('keydown', function (event) {
				if (event.key == 'Enter') {
					$('.send-message').trigger('click');
				}
			})
		}

		initSimpleMessageEventHandler();
		initEnterClickEventHandler();
	}
	const initChatMessageHandler = function () {
		const checkIfNeedUpdateHtml = function (historyChatMessageList, newMessageList) {
			if (historyChatMessageList.length > newMessageList.length) {
				if (
					historyChatMessageList[historyChatMessageList.length - 1].id === newMessageList[newMessageList.length - 1].id
					&& historyChatMessageList[historyChatMessageList.length - newMessageList.length].id === newMessageList[0].id
				) {
					return false
				}
			}
			return true;
		}
		chatInterval = setInterval(() => {
			getSimpleChatMessageInfo(currentUser.id, targetUser.id, moment().subtract(10, 's'), moment()).then(result => {
				if (!result.length) return;
				// Check if exist new message
				if (!checkIfNeedUpdateHtml(historyChatMessageList, result)) return;
				let preMessageId = null, preMessageIndex = -1;
				for (let message of result) {
					// Find 
					let check = historyChatMessageList.some(history => {
						if (history.id === message.id) {
							preMessageIndex++;
							preMessageId = message.id;
							return true;
						}
					})
					if (!check) {
						// This message is new for web here, update message from here
						break;
					}
				}
				clearUnnecessaryChatMessageContentFromHTML(preMessageId)
				historyChatMessageList = historyChatMessageList.slice(preMessageIndex > 10 ? (preMessageIndex - 5) : 0, preMessageIndex).concat(result);
				generateChatMessageContent(currentUser.id, result);
			})
		}, 3000)
	}
	const initCloseChatModalHandler = function () {
		if (chatInterval) {
			clearInterval(chatInterval);
		}
		console.log('clean chat')
	}

	const clearUnnecessaryChatMessageContentFromHTML = function (startMessageId) {
		$('.chat-content').find('.chat-message').each(function() {
			if ($(this).data('id') > startMessageId) {
				$(this).remove()
			}
		})
	}
	const generateChatMessageContent = function (currentUserId, chatMessageList) {
		const generateChatMessage = function (left = true, message) {
			if (left) {
				return `
					<div class="row m-0 chat-message left-chat-message" data-id="${ message.id }">
						<div class="col-1 p-0 m-0" style="width: 50px !important;">
							<div class="div-table">
								<div class="div-table-cell" style="vertical-align: top; padding-top: 8px !important;">
									<div class="username-circle" style="background-color: ${ generateChatCircleColor(message.fromUsername) } !important;">
										<label class="username-label username-first-chart-label">${ message.fromUsername.slice(0, 1).toUpperCase() }</label>
									</div>
								</div>
							</div>
						</div>
						<div class="col-6 p-0 m-0">
							<div class="p-0" style="font-size: 12px; color: gray;"><span>${ message.fromUsername }</span> &nbsp; <span>${ moment(message.messageTime).format('HH:mm') }</span></div>
							<div class="p-3 message-container text-break">
								<p class="text-break">${ message.content }</p>
							</div>
						</div>
					</div>
				`
			} else {
				return `
					<div class="row m-0 chat-message right-chat-message justify-content-end" data-id="${ message.id }">
						<div class="col-5 p-0 m-0"></div>
						<div class="col-6 p-0 m-0">
							<div class="p-0" style="text-align: right; font-size: 12px; color: gray;"><span>${ moment(message.messageTime).format('HH:mm') }</span> &nbsp; <span>${ message.fromUsername }</span></div>
							<div class="p-3 message-container" style="float: right;">
								${ message.content }
							</div>
						</div>
						<div class="col-1 p-0 m-0" style="width: 50px !important; padding-left: 10px !important;">
							<div class="div-table">
								<div class="div-table-cell" style="vertical-align: top; padding-top: 8px !important;">
									<div class="username-circle" style="float: right;background-color: ${ generateChatCircleColor(message.fromUsername) } !important;">
										<label class="username-label username-first-chart-label">${ message.fromUsername.slice(0, 1).toUpperCase() }</label>
									</div>
								</div>
							</div>
						</div>
					</div>
				`
			}
		}
	
		let htmlList = []
		for (let chatMessage of chatMessageList) {
			if (chatMessage.fromUser == currentUserId) {
				// right
				htmlList.push(generateChatMessage(false, chatMessage))
			} else {
				// left
				htmlList.push(generateChatMessage(true, chatMessage))
			}
		}
		$('.chat-content').append(htmlList);
		// Scroll to bottom
		// $('.chat-content').stop().animate({ scrollTop: 1000 * 1000 }, 400);
		$('.chat-content').stop().animate({ scrollTop: $('.chat-content').height() }, 400);
	}
	const generateChatCircleColor = function (username) {
		// debugger
		const chatColors = ['#F0D73D', '#FBB0B3', '#4BCAF6', '#53BD89'];
		const letterList = [
			'A', 'B', 'V', 'D', 'E', 'F', 'G',
			'H', 'I', 'J', 'K', 'L', 'M', 'N',
			'O', 'P', 'Q', 'R', 'S', 'T', 'U',
			'V', 'W', 'X', 'Y', 'Z',
		]
		let result = chatColors[0];
		if (!username) return result;
		let firstLetter = username.slice(0, 1).toUpperCase();
		letterList.forEach((letter, index) => {
			if (letter === firstLetter) {
				result = chatColors[index % 4]
				return true;
			}
		});
		return result;
	}
	const generateChannelHtml = function (user) {
		let html = `
			<div class="row m-0 channel-item" data-username="${ user.fullName }">
				<div class="col-1 p-0"></div>
				<div class="col-2 p-0">
					<div class="div-table">
						<div class="div-table-cell">
							<div class="username-circle" style="background-color: ${ generateChatCircleColor(user.fullName) } !important;">
								<label class="username-label username-first-chart-label">${ user.fullName.slice(0, 1).toUpperCase() }</label>
							</div>
						</div>
					</div>
				</div>
				<div class="col-4 p-0">
					<div class="div-table">
						<div class="div-table-cell">
							<label class="username-label">${ user.fullName }</label>
						</div>
					</div>
				</div>
				<div class="col-3 p-0">
				</div>
				<div class="col-1 p-0">
					<div class="div-table">
						<div class="div-table-cell">
							<input class="form-check channel-checkbox" type="checkbox"/>
						</div>
					</div>
				</div>
				<div class="col-1 p-0">
					<div class="div-table">
						<div class="div-table-cell">
							<div class="online active"></div>
						</div>
					</div>
				</div>
			</div>
		`
		return html;
	}
	const generateRoomHtml = function (room) {
		let html = `
			<div class="row m-0 channel-item" data-roomName="${ room.roomName }">
				<div class="col-1 p-0"></div>
				<div class="col-2 p-0">
					<div class="div-table">
						<div class="div-table-cell">
							<div class="username-circle" style="background-color: ${ generateChatCircleColor(room.roomName) } !important;">
								<label class="username-label username-first-chart-label">${ room.roomName.slice(0, 1).toUpperCase() }</label>
							</div>
						</div>
					</div>
				</div>
				<div class="col-4 p-0">
					<div class="div-table">
						<div class="div-table-cell">
							<label class="username-label">${ room.roomName }</label>
						</div>
					</div>
				</div>
			</div>
		`
		return html;
	}
	const addChatChannel = function (user) {
		let html = generateChannelHtml(user)
		$('.chat-list').append(html)

		$('.chat-list .channel-item').off('click').on('click', function () {
			console.log($(this).data('username'))
		})
	}
	const addHqAndUnitChatChannel = function (element, user) {
		let html = generateChannelHtml(user);
		$(element).append(html)

		$(element).find('.channel-item').off('click').on('click', function () {
			console.log($(this).data('username'))
		})
	}
	const addDriverChatChannel = function (element, user) {
		let html = generateChannelHtml(user);
		$(element).append(html)

		$(element).find('.channel-item').off('click').on('click', function () {
			console.log($(this).data('username'))
		})
	}
	const addRoomChatChannel = function (element, room) {
		let html = generateRoomHtml(room)
		$(element).append(html)

		$(element).find('.channel-item').off('click').on('click', function () {
			console.log($(this).data('roomname'))
		})
	}
	
	return {
		initChatModal
	}
}();

