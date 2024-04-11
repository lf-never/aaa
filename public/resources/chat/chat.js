let chatRefreshTime = 2000;
let chatServer = Cookies.get('chatServer')
let chatTabElement = null;
let availableChatInterval = null;

let userId = null;

$(() => {
	
    userId = $('#chat-count').data('userid')

	layui.use('element', function(){
		chatTabElement = layui.element;
		chatTabElement.on('tab(docDemoTabBrief1)', function() {
			$('.layui-tab-title').find('path').attr('fill', '#ffffff')
			$(this).find('path').attr('fill', 'orange')

			console.log(this.getAttribute('lay-id'));
			let layId = this.getAttribute('lay-id');
			if (layId === 'tab2') {
				ChatUtil.initTab2ChangeEventHandler();
			}
		});
		chatTabElement.on('tab(docDemoTabBrief2)', function(){
			console.log(this.getAttribute('lay-id'));
		});
	});

	// TODO: init unread message count
	const initUnreadChatCount = async function () {
		let count = await ChatUtil.getUnreadChatCount(userId)
		if (count) {
			$('#chat-count').show()
		} else {
			$('#chat-count').hide()
		}
	}
	initUnreadChatCount();
	setInterval(initUnreadChatCount, 5000);

	// let box = document.querySelector('#chat-modal .modal-dialog')
	// box.onmousedown = function () {
	// 	let e = window.event;
	// 	let x1 = e.offsetX
	// 	let y1 = e.offsetY
	// 	document.onmousemove = function () {
	// 		let e = window.event
	// 		let x2 = e.offsetX
	// 		let y2 = e.offsetY

	// 		let l = x2 - x1
	// 		let t = y2 - y1

	// 		if (l < 0) l = 0
	// 		if (t < 0) t = 0

	// 		if (t > document.documentElement.clientHeight - box.offsetHeight) {
	// 			t = document.documentElement.clientHeight - box.offsetHeight
	// 		}
	// 		if (l > document.documentElement.clientWidth - box.offsetWidth) {
	// 			l = document.documentElement.clientWidth - box.offsetWidth
	// 		}

	// 		box.style.left = l + 'px'
	// 		box.style.top = t + 'px'
	// 	}
	// }
	// window.onmouseup = function () {
	// 	document.onmousemove = null
	// }
})

var ChatUtil = function () {
	let currentUser, targetUser;
	let historyChatMessageList = [];
	let chatInterval = null;
	let uploadChatImage = null;

	const getUnreadChatCount = function (userId) {
		return axios.post(chatServer + '/getUnReadChat', { userId })
			.then(function (res) {
				if (res.respCode === 1 || res.data.respCode === 1) {
					return typeof res.respMessage !== 'undefined' ? res.respMessage : res.data.respMessage
				} else {
					console.error(res.respMessage);
					return 0
				}
			});
	}

	const getSimpleChatInfo = function (userId) {
		return axios.post(chatServer + '/getRoomListAndFriendList', { userId })
			.then(function (res) {
				if (res.respCode === 1) {
					return res.respMessage
				} else {
					console.error(res.respMessage);
					return null
				}
			});
	}
	const getRoomMemberList = function (roomId) {
		return axios.post(chatServer + '/getRoomMemberList', { roomId })
			.then(function (res) {
				if (res.respCode === 1) {
					return res.respMessage
				} else {
					console.error(res.respMessage);
					return null
				}
			});
	}
	const getAvailableChat = function (userId) {
		return axios.post(chatServer + '/getAvailableChat', { userId })
			.then(function (res) {
				if (res.respCode === 1) {
					return res.respMessage
				} else {
					console.error(res.respMessage);
					return null
				}
			});
	}
	const getSimpleChatMessageInfo = function (userId, targetUserId, roomType = 'single', startTime, endTime) {
		return axios.post(chatServer + '/getMessageByUserIDAndTargetID', { userId, targetUserId, roomType, startTime, endTime })
			.then(function (res) {
				if (res.respCode === 1) {
					return res.respMessage
				} else {
					console.error(res.respMessage);
					return []
				}
			});
	}
	
	/**
	 * 
	 * @param {*} userId 
	 * @returns 
	 */
	const initChatModal = async function () {
		currentUser = {
			userId: userId,
			username: Cookies.get('username'),
			fullName: Cookies.get('fullName'),
			role: Cookies.get('role'),
			userType: Cookies.get('userType'),
		};
		$('.top-title .username-first-label').html(currentUser.fullName.slice(0, 1));
		$('.top-title .username-full-label').html(currentUser.fullName);
		$('.top-title .username-circle').css('background-color', generateChatCircleColor(currentUser.fullName));

		let chatInfo = await getSimpleChatInfo(currentUser.userId);
		let availableChatList = await getAvailableChat(currentUser.userId);
		initContactListHandler(chatInfo);
		initChatChannelHandler(availableChatList, true);
		initCloseChatModalHandler();
		openChatModal(currentUser, { }, initCloseChatModalHandler)

		availableChatInterval = setInterval(async () => {
			let availableChatList = await getAvailableChat(currentUser.userId);
			initChatChannelHandler(availableChatList);
		}, chatRefreshTime)

		// Create room
		$('.room-create').off('click').on('click', initCreateRoomHandler);
		$('.view-member').off('click').on('click', initViewRoomMemberHandler);
	}
	const openChatModal = function (user, targetUser, callback) {
		$('#chat-modal').modal('show');
		$('#chat-modal').off('hidden.bs.modal').on('hidden.bs.modal', function () {
			console.log('Chat module closed.')

			if (availableChatInterval) {
				clearInterval(availableChatInterval)
			}
			return callback();
		})

	}
	const initChatModalEventHandler = function () {

		const sendChatMessage = async function (message) {
			const sendChatMessageRequest = function (message) {
				// Will return message ID
				return axios.post(chatServer + '/sendMessage', { message })
					.then(function (res) {
						if (res.respCode === 1) {
							return res.respMessage;
						} else {
							console.error(res.respMessage);
							return 0;
						}
					});
			}
			
			let messageId = await sendChatMessageRequest(message);
			if (messageId) {
				// message.id = messageId
				// historyChatMessageList.push(message);
				// generateChatMessageContent(userId, [message]);
				
				$('.chat-input').val(null);
			} else {
				parent.simplyError(`Message send failed, please try again!`)
			}
		}

		const initSimpleMessageEventHandler = function () {
			// console.log('initSimpleMessageEventHandler')
			$('.send-message').off('click').on('click', function () {
				if (!targetUser || !targetUser.roomType) {
					$.alert('Please select one user.');
					return;
				}
				let content = $(this).closest('.input-div').find('input').val()?.trim();
				if (!content) return;
				let message = {
					fromUser: currentUser.userId,
					toUser: targetUser.roomType === 'single' ? targetUser.userId : targetUser.roomId,
					fromUsername: currentUser.username,
					toUsername: targetUser.roomType === 'single' ? targetUser.userId : targetUser.roomName,
					messageType: 'text',
					chatType: targetUser.roomType,
					content: content,
					contentSize: content.length,
					messageTime: moment().valueOf()
				}
				sendChatMessage(message)
			})
		}

		const initEnterClickEventHandler = function () {
			$(document).off('keydown').on('keydown', function (event) {
				if (event.key == 'Enter') {
					if (!targetUser || !targetUser.roomType) {
						$.alert('Please select one user.');
						return;
					}
					$('.send-message').trigger('click');
				}
			})
		}

		const initAudioClickEventHandler = function () {
			$('.chat-audio').off('click').on('click', function () {
				if (!targetUser || !targetUser.roomType) {
					$.alert('Please select one user.');
					return;
				}
				$.confirm({
					title: 'Audio',
					closeIcon: true,
					closeIcon: function () {
						console.log('Close audio here.')
						recStop();
					},
					content: '<div style="width: 100%; text-align: center; padding-top: 5%; padding-bottom: 3%;"><img style="width: 50px;" src="../chat/icons/audio.svg"/></div>',
					buttons: {
						Start: {
							text: ' ',
							btnClass: 'audio-start',
							action: function () {
								recStart();
								this.buttons.Start.hide();
								this.buttons.Send.hide();
								this.buttons.Stop.show();
								this.$content.find('img').attr('src', '../chat/icons/audio1.gif')
								return false;
							}
						},
						Stop: {
							text: ' ',
							btnClass: 'audio-stop',
							isHidden: true,
							action: function () {
								recStop();
								this.buttons.Start.show();
								this.buttons.Send.show();
								this.buttons.Stop.hide();
								this.$content.find('img').attr('src', '../chat/icons/audio.svg')
								return false;
							}
						},
						Send: {
							isHidden: true,
							text: ' ',
							btnClass: 'audio-send',
							keys: ['enter'],
							action: function () {
								recSend(function (base64Data, duration) {
									if (!base64Data) {
										console.log('Base64Data is null, will not create audio record.')
										return;
									}
									console.log('Send audio message here.')
									console.log(duration + ' ms');
									duration = duration > 1000 ? Math.floor(duration / 1000) : 1;
									console.log(duration + ' s');
									axios.post(chatServer + '/uploadChatAudio', {
										currentUser,
										targetUser,
										fileName: `Chat_Audio_${ currentUser.userId }_` + moment().valueOf() + '.amr',
										fileSize: duration,
										base64Data: base64Data
									}).then(result => {
										// if (result.code == 1) {
										// 	generateChatMessageContent(currentUser.id, result.data.messageList);
										// }
									})

								})
							}
						},
					}
				});
			})
		}

		const initEmojiClickEventHandler = function () {
			let html = '';
			for (let i = 0; i < 72; i++) {
				if (i > 0 && i % 9 === 0) html += '<br>';
				let emojiIcon = null;
				if (i < 10) emojiIcon = 'f00' + i + '.png';
				else emojiIcon = 'f0' + i + '.png';
				html += `<img emoji="${ emojiIcon.split('.')[0] }" class="emoji-icons" src="../emoji/${ emojiIcon }"/>`;
			}
			html += '<hr>';
			for (let i = 0; i < 36; i++) {
				if (i > 0 && i % 9 === 0) html += '<br>';
				let emojiIcon = null;
				if (i < 10) emojiIcon = 'g00' + i + '.gif';
				else emojiIcon = 'g0' + i + '.gif';
				html += `<img emoji="${ emojiIcon.split('.')[0] }" class="emoji-icons" src="../emoji/${ emojiIcon }"/>`;
			}
		
			$('.emoji-icon-list').html(html);

			$('.chat-emoji').off('click').on('click', function () { 
				if (!targetUser || !targetUser.roomType) {
					$.alert('Please select one user.');
					return;
				}

				if ($('.emoji-list').css('display') !== 'none') {
					$('.emoji-list').css('display', 'none');
				} else {
					$('.emoji-list').show();
				}
			})
		
			$('.emoji-icons').off('click').on('click', function () {		
				let emoji = $(this).attr('emoji');
				$('.emoji-list').hide();
				// add into input chat
				$('.chat-input').val($('.chat-input').val() + '[/'+ emoji +']');
			})
		}

		const initFileClickEventHandler = function () {
			layui.use('upload', function() {
				let upload = layui.upload;
				// if already init, reload it
				if (uploadChatImage) {
					uploadChatImage.reload({
						data: {
							currentUser: JSON.stringify(currentUser),
							targetUser: JSON.stringify(targetUser)
						},
					});
					return;
				};
				uploadChatImage = upload.render({
					elem: '.chat-image,.chat-file',
					url: chatServer + '/uploadChatFile',
					auto: false, // must
					accept: 'file',
					acceptMime: 'image/*,text/xml,text/plain,application/rtf,application/pdf,application/msword,application/rar,application/zip',
					multiple: false,
					data: {
						currentUser: JSON.stringify(currentUser),
						targetUser: JSON.stringify(targetUser)
					},
					choose: function(obj) {
						obj.preview(function(index, file, result) {
							console.log(file);
							// if (file.type.indexOf('image') > -1 && file.size > 5 * 1024 * 1024) {
							if (file.size > 10 * 1024 * 1024) {
								$.alert('File size should be < 10m !');
								return;
							}
							layer.load(3, {shade: [0.6, '#000']});
							obj.upload(index, file);
							// console.log('file: ', file);
							console.log('upload file name: ', file.name);
		
						});
					},
					allDone: function(obj) {
						layer.closeAll('loading');
					},
					done: async function(obj) {
						layer.closeAll('loading');
						console.log(obj.messageList)
						// generateChatMessageContent(currentUser.id, obj.data.messageList);
					},
					error: function() {
						layer.closeAll('loading');
					}
				});
			});
		}

		initSimpleMessageEventHandler();
		initAudioClickEventHandler();
		initEmojiClickEventHandler();
		initFileClickEventHandler();
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
			getSimpleChatMessageInfo(currentUser.userId, targetUser.userId ? targetUser.userId : targetUser.roomId, targetUser.roomType, moment().subtract(1, 'm').format('YYYY-MM-DD HH:mm:ss'), moment().format('YYYY-MM-DD HH:mm:ss')).then(result => {
				if (!result.length) return;
				// Check if exist new message
				if (!checkIfNeedUpdateHtml(historyChatMessageList, result)) return;
				let preMessageId = null, preMessageIndex = -1;
				// console.log(result)
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
				// console.log(preMessageId)
				if (preMessageId) {
					clearUnnecessaryChatMessageContentFromHTML(preMessageId)
				}
				historyChatMessageList = historyChatMessageList.slice(preMessageIndex > 20 ? (preMessageIndex - 10) : 0, preMessageIndex).concat(result);

				// Check out new message
				let newMessageList = result.filter(message => { return message.id > preMessageId })
				generateChatMessageContent(currentUser.userId, newMessageList);


				// let newIndex = -1;
				// result.forEach((message, index) => {
				// 	if (message.id === historyChatMessageList[historyChatMessageList.length - 1].id) {
				// 		newIndex = index;
				// 	}
				// })
				// if (newIndex > -1) {
				// 	generateChatMessageContent(currentUser.id, result.substr(newIndex + 1));
				// }
			})
		}, chatRefreshTime)
	}
	const initCloseChatModalHandler = function () {
		if (chatInterval) {
			clearInterval(chatInterval);
		}
		
		$('.chat-content').empty();
		// console.log('clean chat')
	}
	const initChatChannelHandler = async function (targetUserList, ifClearHtml = false) {
		if (ifClearHtml) {
			$('.chat-list').empty();
			for (let _targetUser of targetUserList) {
				let roomType = _targetUser.roomId ? 'room' : 'single'
				let html = generateChatChannelHtml(roomType, _targetUser)
				$('.chat-list').append(html);
			}
			initChatChannelClickHandler();
			$('.chat-list .channel-item:first-child').trigger('click')
		} else {
			for (let _targetUser of targetUserList) {
				let check = false;
				$('.chat-list').children().each(function () {
					// Check if already exist
					if ($(this).data('id') == (_targetUser.userId ? _targetUser.userId : _targetUser.roomId) && $(this).data('roomtype') == _targetUser.roomType) {
						// console.log('Already exist chat channel => ', _targetUser.userId ? _targetUser.username : _targetUser.roomName)
						if (_targetUser.roomId) {
							$(this).data('name', _targetUser.roomName);// update channel data-name
							// Update channel roomName (user can update room name)
							$(this).find('.username-full-label').html(_targetUser.roomName);
							if (targetUser.roomId === _targetUser.roomId) {
								// Update chat content and targetUser
								targetUser.roomName = _targetUser.roomName;
								$('.chat-target .target-user').html(targetUser.roomName)
							}
						}

						// Update unread message count
						if (targetUser.roomType === _targetUser.roomType && targetUser.userId == _targetUser.userId && targetUser.roomId == _targetUser.roomId) {
							// Current window is this user, hide
							$(this).find('.unread-message-count').hide()
						} else {
							// Current window is not this user, update unread info
							if (_targetUser.unreadMessageCount) {
								$(this).find('.unread-message-count').html(_targetUser.unreadMessageCount).show()
							}
						}

						// Update online state
						if (_targetUser.roomType === 'single') {
							if (_targetUser.online) {
								$(this).find('.online').addClass('active').show();
							} else {
								$(this).find('.online').removeClass('active').show();
							}
						}
						check = true;
					}
				})
				if (!check) {
					// console.log('does not exist chat channel => ', targetUser.userId ? targetUser.username : targetUser.roomName);
					let roomType = _targetUser.roomId ? 'room' : 'single'
					let html = generateChatChannelHtml(roomType, _targetUser)
					$('.chat-list').append(html);
					initChatChannelClickHandler();
					if ($('.chat-list').children().length == 1) {
						$('.chat-list .channel-item:last-child').trigger('click')

						// Current window is this user, hide
						$('.chat-list .channel-item:last-child').find('.unread-message-count').hide()
					} else {
						// Current window is not this user, update unread info
						if (_targetUser.unreadMessageCount) {
							$('.chat-list .channel-item:last-child').find('.unread-message-count').html(_targetUser.unreadMessageCount).show()
						}
					}
				}
			}
		}
	}
	const addChatChannelHandler = async function (targetUser, show = false) {
		const checkIfExistChatChannel = function (roomType, id) {
			let result = false;
			$('.chat-list .channel-item').each(function() {
				let channelItem = this;
				if ($(channelItem).data('roomtype') === roomType) {
					if ($(channelItem).data('id') == id) {
						if (show) {
							$(channelItem).trigger('click');
						}
						result = true;
					}
				}
			})
			return result;
		}
		
		let id = targetUser.roomType === 'single' ? targetUser.userId : targetUser.roomId;
		if (!checkIfExistChatChannel(targetUser.roomType, id)) {
			// New channel item
			let html = generateChatChannelHtml(targetUser.roomType, targetUser);
			$('.chat-list').append(html);
			initChatChannelClickHandler();

			if (show) {
				$('.chat-list .channel-item:last-child').trigger('click');
			}
		} else {
			// if already exist, checkIfExistChatChannel already init and click channel
			console.log('Already exist channel')
		}
	}
	const initChatChannelClickHandler = async function () {
		$('.chat-list .channel-item').off('click').on('click', async function () {
			$('.chat-list .channel-item').removeClass('active');
			$(this).addClass('active');

			let roomType = $(this).data('roomtype');
			targetUser = {
				userId: roomType === 'single' ? $(this).data('id') : null,
				username: roomType === 'single' ? $(this).data('name') : null,
				roomId: roomType === 'single' ? null : $(this).data('id'),
				roomName: roomType === 'single' ? null : $(this).data('name'),
				roomType: roomType,
				roleType: $(this).data('roletype'),
			}
			// console.log(targetUser)
			$('.chat-target label').html(targetUser.username ? targetUser.username : targetUser.roomName)
			if (targetUser.roomType === 'room') {
				$('.chat-target .view-member').show();
			} else {
				$('.chat-target .view-member').hide();
			}
			// Clear content
			initCloseChatModalHandler();

			historyChatMessageList = await getSimpleChatMessageInfo(currentUser.userId, targetUser.roomType === 'single' ? targetUser.userId : targetUser.roomId, targetUser.roomType);
			generateChatMessageContent(currentUser.userId, historyChatMessageList)

			// init interval
			initChatMessageHandler();	
			// Reload operation event(reload upload file)
			initChatModalEventHandler();
		});
	}
	const initTab2ChangeEventHandler = async function () {
		let chatInfo = await getSimpleChatInfo(currentUser.userId);
		initContactListHandler(chatInfo);
		initCloseChatModalHandler();
	}
	const initContactListHandler = function ({ roomList, hqFriendList, unitFriendList, driverFriendList }) {
		// console.log(roomList);
		// console.log(hqFriendList);
		// console.log(unitFriendList);
		// console.log(driverFriendList);
		const addChatChannel = function (el, user, index) {
			const generateContactChannelHtml = function (user, index) {
				let html = `
					<div class="row m-1 channel-item" data-userid="${ user.userId }" data-roomid="${ user.roomId }" 
					data-username="${ user.username }" data-fullName="${ user.fullName }" data-roomname="${ user.roomName }" data-usertype="${ user.userType ? user.userType : 'room' }">
						<div class="col-2 p-0">
							<div class="div-table">
								<div class="div-table-cell" style="text-align: center;">
									<div class="username-circle" style="background-color: ${ generateChatCircleColor(user.fullName ? user.fullName : user.roomName) } !important;">
										<label class="username-label username-first-chart-label">${ user.fullName ? user.fullName.slice(0, 1).toUpperCase() : 'R' }</label>
									</div>
								</div>
							</div>
						</div>
						<div class="col-8 p-0">
							<div class="div-table">
								<div class="div-table-cell" style="text-align: left;padding-left: 10px;">
									<label class="username-label username-full-label">${ user.fullName ? user.fullName : user.roomName }</label>
								</div>
							</div>
						</div>
						<div class="col-1 p-0"></div>
						<div class="col-1 p-0">
							<div class="div-table">
								<div class="div-table-cell">
									<div class="online ${ user.online ? 'active' : '' }" style="${ user.roomName ? 'display: none;' : '' }"></div>
								</div>
							</div>
						</div>
					</div>
				`
				return html;
			}
			let html = generateContactChannelHtml(user, index)
			$(el).append(html)
		}

		$('.hq-list').empty();
		hqFriendList.forEach((user, index) => {
			addChatChannel($('.hq-list'), user, index);
		})
		$('.unit-list').empty();
		unitFriendList.forEach((user, index) => {
			addChatChannel($('.unit-list'), user, index);
		})
		$('.driver-list').empty();
		driverFriendList.forEach((user, index) => {
			addChatChannel($('.driver-list'), user, index);
		})
		$('.room-list').empty();
		roomList.forEach((room, index) => {
			addChatChannel($('.room-list'), room, index);
		})

		$('.hq-list .channel-item, .unit-list .channel-item, .driver-list .channel-item, .room-list .channel-item').off('click').on('click', async function () {
			// $('.hq-list .channel-item, .unit-list .channel-item, .driver-list .channel-item').removeClass('active');
			// $(this).addClass('active');
			targetUser = {
				userId: $(this).data('userid') && $(this).data('userid') !== 'undefined' ? $(this).data('userid') : null,
				username: $(this).data('username') && $(this).data('username') !== 'undefined' ? $(this).data('username') : null,
				fullName: $(this).data('fullname') && $(this).data('fullname') !== 'undefined' ? $(this).data('fullname') : null,
				userType: $(this).data('usertype'),
				roomId: $(this).data('roomid') && $(this).data('roomid') !== 'undefined' ? $(this).data('roomid') : null,
				roomName: $(this).data('roomname') && $(this).data('roomname') !== 'undefined' ? $(this).data('roomname') : null,
				roomType: $(this).data('userid') && $(this).data('userid') !== 'undefined' ? 'single' : 'room'
			}
			console.log(targetUser);
			chatTabElement.tabChange('docDemoTabBrief1', 'tab1');
			addChatChannelHandler(targetUser, true);
		})
	}

	// Room
	const openEditRoomWindow = function (html, operation) {
		// $.dialog({
		// 	title: 'Create Room',
		// 	content: '<input class="form-control">',
		// });
		layer.open({
			title: 'Create Room',
			content: html,
			area: '800px',
			btn: ['Confirm'],
			maxHeight: '600',
			yes: async function(index) {
				console.log('Will create room here ...');
				let selectedFriendList = [ Number.parseInt(currentUser.userId) ]
				$('.right-list-group .form-check-input').each(function () {
					selectedFriendList.push($(this).data('id'))
				})
				selectedFriendList = Array.from(new Set(selectedFriendList));
				console.log(selectedFriendList)
				let room = { roomName: $('.new-roomName').val(), roomMemberList: selectedFriendList }
				if (operation.indexOf('/updateRoomMember') > -1) {
					room.roomId = targetUser.roomId;
				}
				if (!room.roomName) {
					$.confirm({
						title: 'Attention',
						content: 'Room name is needed',
						type: 'orange',
						typeAnimated: true,
						buttons: {
							Ok: {
								btnClass: 'btn-green',
								action: function () {
								}
							}
						}
					});
				} else if (!room.roomMemberList.length) {
					$.confirm({
						title: 'Attention',
						content: 'Room member is needed',
						type: 'orange',
						typeAnimated: true,
						buttons: {
							Ok: {
								btnClass: 'btn-green',
								action: function () {
								}
							}
						}
					});
				} else {
					let result = await axios.post(chatServer + operation, { room });
					if (result.respCode === 1) {
						$('#chat-modal').show();
						layer.close(index);

						// Init contact list
						getSimpleChatInfo(currentUser.userId).then(result => {
							console.log(result)
							initContactListHandler(result);
						})
					} else {
						$.confirm({
							title: 'Attention',
							content: result.respMessage,
							type: 'orange',
							typeAnimated: true,
							buttons: {
								Ok: {
									btnClass: 'btn-green',
									action: function () {
									}
								}
							}
						});
					}
				}
				return false;
			},
			success: function () {
				$('.move-right').on('click', function () {
					let selectedHtml = [];
					$('.left-list-group').find("input[type='checkbox']").each(function () {
						if ($(this).prop('checked')) {
							selectedHtml.push('<li class="list-group-item">' + $(this).closest('.list-group-item').html() + '</li>');
							$(this).closest('.list-group-item').remove();
						}
					})
					$('.right-list-group').append(selectedHtml.join(''))
				});
				$('.move-left').on('click', function () {
					let selectedHtml = [];
					$('.right-list-group').find("input[type='checkbox']").each(function () {
						if ($(this).prop('checked')) {
							selectedHtml.push('<li class="list-group-item">' + $(this).closest('.list-group-item').html() + '</li>');
							$(this).closest('.list-group-item').remove();
						}
					})
					$('.left-list-group').append(selectedHtml.join(''))
				});

				if (operation.indexOf('/updateRoomMember') > -1) {
					$('.new-roomName').val(targetUser.roomName);
				}
			},
			cancel: function (index) {
				layer.close(index);
				$('#chat-modal').show();
			}
		});
	}
	const generateRoomHtml = function (result, memberList) {
		let htmlTemplate = `
			<div class="container-fluid">
				<style>
					.list-group {
						border: solid 1px #dbdada;
						padding: 10px;	
					}
					.list-group .form-check-input, .list-group .form-check-label {
						cursor: pointer;
					}
				</style>
				<div class="mb-3 row">
					<label class="col-sm-2 col-form-label">Room Name</label>
					<div class="col-sm-10">
						<form class="was-validated">
							<input type="text" class="form-control new-roomName is-invalid" required>
						</form>
					</div>
				</div>
				<div class="row">
					<div class="col-5">
						<ul class="list-group left-list-group"  style="max-height: 350px; overflow: auto;">
							{{leftGroup}}
						</ul>
					</div>
					<div class="col-2">
						<div class="div-table">
							<div class="div-table-cell">
								<button class="btn btn-sm btn-primary custom-btn move-right" style="width: fit-content;">&#8658;</button>
								<br>
								<br>
								<button class="btn btn-sm btn-primary custom-btn move-left" style="width: fit-content;">&#8656;</button>
							</div>
						</div>
					</div>
					<div class="col-5">
						<ul class="list-group right-list-group"  style="max-height: 350px; overflow: auto;">
							{{rightGroup}}
						</ul>
					</div>
				</div>
			</div>
		`;
		let leftHtml = ``, rightHtml = ``, index = 0, memberIdList = [];
		if (memberList && memberList.length) {
			memberIdList = memberList.map(member => member.userId)
		}
		for (let friend of result.hqFriendList) {
			if (memberIdList.length && memberIdList.includes(friend.userId)) continue;
			index++;
			leftHtml += `
				<li class="list-group-item">
					<div class="form-check">
						<input class="form-check-input" type="checkbox" data-id="${ friend.userId }" id="leftCheckBox${ index }">
						<label class="form-check-label" for="leftCheckBox${ index }">
							${ "(HQ) " + friend.username }
						</label>
					</div>
				</li>
			`;
		}
		for (let friend of result.unitFriendList) {
			if (memberIdList.length && memberIdList.includes(friend.userId)) continue;
			index++;
			leftHtml += `
				<li class="list-group-item">
					<div class="form-check">
						<input class="form-check-input" type="checkbox" data-id="${ friend.userId }" id="leftCheckBox${ index }">
						<label class="form-check-label" for="leftCheckBox${ index }">
							${ "(UNIT) " + friend.username }
						</label>
					</div>
				</li>
			`;
		}
		for (let friend of result.driverFriendList) {
			if (memberIdList.length && memberIdList.includes(friend.userId)) continue;
			index++;
			leftHtml += `
				<li class="list-group-item">
					<div class="form-check">
						<input class="form-check-input" type="checkbox" data-id="${ friend.userId }" id="leftCheckBox${ index }">
						<label class="form-check-label" for="leftCheckBox${ index }">
							${ "(Driver) " + friend.username }
						</label>
					</div>
				</li>
			`;
		}
		for (let member of memberList) {
			index++;
			rightHtml += `
				<li class="list-group-item">
					<div class="form-check">
						<input class="form-check-input" type="checkbox" data-id="${ member.userId }" id="leftCheckBox${ index }">
						<label class="form-check-label" for="leftCheckBox${ index }">
							${ "(Driver) " + member.username }
						</label>
					</div>
				</li>
			`;
		}
		htmlTemplate = htmlTemplate.replace('{{leftGroup}}', leftHtml);
		htmlTemplate = htmlTemplate.replace('{{rightGroup}}', rightHtml);
		return htmlTemplate;
	}
	const initCreateRoomHandler = async function () {
		let result = await getSimpleChatInfo(currentUser.userId);
		$('#chat-modal').hide();
		openEditRoomWindow(generateRoomHtml(result, []), '/createRoom');
	}
	const initViewRoomMemberHandler = async function () {
		console.log('View room member...')
		let result = await getSimpleChatInfo(currentUser.userId);
		$('#chat-modal').hide();
		if (!targetUser.roomId) {
			$.confirm({
				title: 'Attention',
				content: 'Only room can view room member.',
				type: 'orange',
				typeAnimated: true,
				buttons: {
					Ok: {
						btnClass: 'btn-green',
						action: function () {
						}
					}
				}
			});
		} else {
			let memberList = await getRoomMemberList(targetUser.roomId);
			openEditRoomWindow(generateRoomHtml(result, memberList), '/updateRoomMember');
		}
	}

	const clearUnnecessaryChatMessageContentFromHTML = function (startMessageId) {
		$('.chat-content').find('.chat-message').each(function() {
			
			if (Number.parseInt($(this).data('id')) > startMessageId) {
				console.log('remove message id: ', $(this).data('id'))
				$(this).remove()
			}
		})
	}
	const generateChatMessageContent = function (currentUserId, chatMessageList) {
		const generateChatMessage = function (left = true, message) {
			const generateEmojiHtmlMessage = function (msg) {
				let $images0 = [];
				while (msg.indexOf('[/g0') > -1) {
					let img = msg.indexOf('[/g0');
					$images0.push(msg.substr(img + 2, 4));
					msg = msg.replace(msg.substr(img, 7), '$emoji$');
				}
				$images0.forEach(function (image) {
					msg = msg.replace('$emoji$', `<img emoji="${image}" class="emoji-icons" src="../emoji/${image}.gif"/>`)
				});
				let $images1 = [];
				while (msg.indexOf('[/f0') > -1) {
					let img = msg.indexOf('[/f0');
					$images1.push(msg.substr(img + 2, 4));
					msg = msg.replace(msg.substr(img, 7), '$emoji$');
				}
				$images1.forEach(function (image) {
					msg = msg.replace('$emoji$', `<img emoji="${image}" class="emoji-icons" src="../emoji/${image}.png"/>`)
				});
				return msg;
			}
			let messageContent = "";
			if (message.messageType === 'text') {
				if (message.content.indexOf('[/f0') > -1 || message.content.indexOf('[/g0') > -1) {
					messageContent = `<p class="text-break" style="line-height: 12px;">${ generateEmojiHtmlMessage(message.content) }</p>`
				} else {
					messageContent = `<p class="text-break" style="line-height: 12px;">${ message.content }</p>`
				}
			} else if (message.messageType === 'audio') {
				messageContent = `<a style="background-image: url(../chat/recorder/audio-${ left ? 'left' : 'right' }.svg); width: 31px;height: 32px;display: inline-block;" 
				class="audio" href="javascript:void(0);" onclick="playAudio(this, \'${ message.content }\', \'${ left ? 'left' : 'right' }\', \'${ message.contentSize }\')"></a>`
			} else if (message.messageType === 'image') {
				messageContent = `<image style="max-width: 300px;" src="${ chatServer }/chat/upload/${ message.content }" />`
			} else if (message.messageType === 'file') {
				let fileName = message.content;
				if (fileName.length > 16) {
					fileName = fileName.slice(0, 15) + '...'
				}
				messageContent = `<button onclick="javascript:window.location='${ chatServer }/downloadChatFile?fileName=${ message.content }'" style="border-color: #ebdbdb; width: 210px; height: 60px; background-color: #ebdbdb; padding: 5px 10px; border-radius: 10px; cursor: pointer;" >
					<img style="width:38px; border-radius: 5px;float: left;" src="../chat/icons/file.jpg" />
					<label style="float: right;font-size: medium;line-height: 50px;color: black; cursor: pointer;" data-bs-toggle="tooltip" data-bs-placement="top" title="${ message.content }">${ fileName }</label>
				</button>`;
			}

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
								${ messageContent }	
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
							<div class="p-3 message-container text-break" style="float: right;">
								${ messageContent }
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
		setTimeout(() => {
			// $('.chat-content')[0].scrollIntoView( false );
			$('.chat-content').stop().animate({ scrollTop: $('.chat-content')[0].scrollHeight }, 400);
		}, 100)
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
		let firstLetter = username.toString().slice(0, 1).toUpperCase();
		letterList.forEach((letter, index) => {
			if (letter === firstLetter) {
				result = chatColors[index % 4]
				return true;
			}
		});
		return result;
	}
	const generateChatChannelHtml = function (roomType, target) {
		// debugger
		let html = `
			<div class="row m-1 channel-item" data-roomType="${ roomType }" data-id="${ target.userId ? target.userId : target.roomId }" 
			data-name="${ target.fullName ? target.fullName: target.roomName }" data-roleType="${ target.userType }">
				<div class="col-2 p-0">
					<div class="div-table">
						<div class="div-table-cell" style="text-align: center;">
							<div class="username-circle" style="background-color: ${ generateChatCircleColor(target.fullName ? target.fullName : target.roomName) } !important;">
								<label class="username-label username-first-chart-label">${ target.fullName ? target.fullName.slice(0, 1).toUpperCase() : target.roomName.toString().slice(0, 1).toUpperCase() }</label>
							</div>
						</div>
					</div>
				</div>
				<div class="col-7 p-0">
					<div class="div-table">
						<div class="div-table-cell" style="text-align: left;padding-left: 10px;">
							<label class="username-label username-full-label">${ target.fullName ? target.fullName : target.roomName }</label>
						</div>
					</div>
				</div>
				<div class="col-2 p-0">
					<div class="div-table">
						<div class="div-table-cell" style="padding-left: 10px;">
							<span class="badge bg-danger unread-message-count" style="display: none;">0</span>
						</div>
					</div>
				</div>
				<div class="col-1 p-0">
					<div class="div-table">
						<div class="div-table-cell">
							<div class="online" style="display: none;"></div>
						</div>
					</div>
				</div>
			</div>
		`
		return html;
	}

	return {
		getUnreadChatCount,
		initChatModal,
		initTab2ChangeEventHandler
	}
}();

