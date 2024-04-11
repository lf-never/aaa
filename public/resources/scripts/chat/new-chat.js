const currentChatTarget = {};
let chatMini = [];
let chatDetail = [];
const chatColors = ['blue', 'light-blue', 'orange'];

let rooms = [];
let hqFriendList = [];
let unitFriendList = [];
let driverFriendList = [];
let unitList = [];

let chatServer = null;
let chatRobot = false;
let uploadChatFile = null;

let userId = null;

$(function () {
    // TODO: init radio
    setTimeout(function () {
        console.log('Init voice!');
        RongIMLib.RongIMVoice.init();
    }, 1000);
    // TODO: init layui plugin

    initChatEmoji();
    initClickEvent();
    initUnitList();
    userId = $('#chat-count').data('userid')
    if (chatRobot) {
        chatMini = [{roomName: 'AskSally', roomType: 'robot', lastMsg: ''}];
        chatDetail = [{roomName: 'AskSally', roomType: 'robot', roomMsg: [
                {msgType: 'robot-unit', roomType: 'chat', fromJid: 'AskSally', toJid: Cookies.get('username'), content: ''}
            ], unreadFlag: null}];
    }

});

const initClickEvent = function () {
    $("body").on("click", ".btn-action", function (e) {
        e.preventDefault();
        let action = $(this).data("action");
        if (action === "chat-send") {
            // Null user selected
            if (!currentChatTarget.roomName) {
                popupInfo('Please select a friend for chatting!');
                return;
            }
            if ($('.input-search-chat').val().trim() === '') return;
            if ($('.input-search-chat').val().toString().length > 200) {
                popupInfo('Message is too long, need less than 200 Bytes!');
                return;
            }
            if (currentChatTarget.roomType === 'robot') {
                // only chat self
                // robotChatHandler();
            } else {
                createMsg();
            }
        }
        else if (action === "chat-addgroup") {

        }
        else if (action === 'chat-emoji') {
            // TODO: init emoji, lazy load
            if (!$('.bottom-cont').hasClass('min')) {
                $('.emoji-icons').each(function() {
                    let src = $(this).attr('data-src');
                    $(this).attr('src', src);
                })
            }
            if ($('.emoji-list').css('display') !== 'none') {
                $('.emoji-list').css('display', 'none');
            } else {
                $('.emoji-list').show();
            }
        }
        else if (action === 'chat-mic') {
            if (!currentChatTarget.roomName) {
                popupInfo('Please select a friend for chatting');
                return;
            }
            openAudio();
        }
        else if (action === 'chat-video') {
            if (!currentChatTarget.roomName) {
                popupInfo('Please select a friend for chatting');
                return;
            }
            if (currentChatTarget.roomType === 'groupChat') {
                let msg = 'video:!~' + currentChatTarget.roomName + ' Open Video Chat';
                sendMsgToSocket(currentUser.name, currentChatTarget.roomName, currentChatTarget.roomType, msg, 'invite');
            } else {
                let msg = 'video:!~' + currentUser.name + ' Open Video Chat';
                sendMsgToSocket(currentUser.name, currentChatTarget.roomName, currentChatTarget.roomType, msg, 'invite');
            }
            openVideo();
        }
        else if (action === 'chat-more') {
            if (!currentChatTarget.roomName) {
                popupInfo('Please select a friend for chatting');
                return;
            }
            let lastMessageId;
            chatDetail.some(detail => {
                if (detail.roomName === currentChatTarget.roomName) {
                    if (!!detail.roomMsg.length) {
                        lastMessageId = detail.roomMsg[0].msgId;
                    }
                    return true;
                }
            })
            getLastMessage(currentChatTarget.roomName, currentChatTarget.roomType, lastMessageId)
                .then(lastMessageList => {
                chatDetail.some(detail => {
                    if (detail.roomName === currentChatTarget.roomName) {
                        detail.roomMsg = lastMessageList.concat(detail.roomMsg);
                        // will be cleared by interval request

                        $('.chatChannelItem.active').click();
                        return true;
                    }
                });

            })
        }
    });

    $('.cancel_create').click(function () {
        $('.selectChannelList').css('display', 'none');
        $('.chatChannelList').css('display', 'block');
    });

    $('.cancel_create_room').click(function () {
        // $('.selectChannelList').css('display', 'inline-block');
        // $('.createRoom').css('display', 'none');

        $('.chat_rooms').show();
        $('.createRoom').hide();
    });

    $('.submit_create_room').click(async function () {
        const ifExistRoomName = async function (roomName) {
            return await axios.post(chatServer + '/getRoomByName', { roomName })
                .then(function (res) {
                    if (res.respCode === 1) {
                        return res.respMessage.exist;
                    }
                    return false;
                })
        };
        const canCreateRoomName = async function (roomName) {
            if (!roomName) {
                popupInfo('Room name can not be empty!');
                return false;
            }
            let existRoomName = await ifExistRoomName(roomName);
            if (existRoomName) {
                popupInfo('Room name already exist, please try another one!');
                return false;
            }
            return true;
        };
        const createChatRoom = async function (roomObj) {
            return await axios.post(chatServer + '/createRoom', roomObj)
                .then(function (res) {
                    return res.respCode === 1;
                })
        };

        // check roomName
        let roomName = $('.room_name').val().trim();
        let checkResult = await canCreateRoomName(roomName);
        if (!checkResult) return;
        $('.room_name').val('');

        console.log('start create');
        // all necessary data
        let members = [];
        let selectedEl = $('.selectChatMembers').find('div[class*="layui-form-checked"]');
        for (let i = 0; i < selectedEl.length; i++) {
            let nameEl = $(selectedEl[i]).prev();
            // console.log(nameEl.html());
            members.push({id: Number.parseInt(nameEl.html().toString().trim())});
        }
        if (!members.length) {
            popupInfo('At lease one member selected(Create).');
            return;
        }
        members.push({id: currentUser.id});
        console.warn('Room Member: ', members);

        // create room
        let ifCreateRoomSuccess = await createChatRoom({roomName, members, owner: currentUser.id});
        if (ifCreateRoomSuccess) {
            $('.layui-form-checked').removeClass('layui-form-checked');
            // $('.chatChannelList').css('display', 'inline-block');
            // $('.createRoom').css('display', 'none');
            $('.chat_rooms').show();
            $('.createRoom').hide();
            $('.chat_tab').children(":first").click();

            // Init room to left panel
            let randomNum = Math.floor(Math.random() * (chatColors.length));
            // Init currentChatTarget
            currentChatTarget.roomName = roomName;
            currentChatTarget.roomType = 'groupChat';
            // Init topInfo of chatDetail
            let beforeColor = $('.chat-cont-alias').attr('class').split(' ')[1];
            $('.chat-cont-alias').html(roomName.substr(0, 1)).removeClass(beforeColor).addClass(chatColors[randomNum]);
            $('.chat-cont-channel-name').html(roomName);
            // $('.chat-cont-group-members').html(roomName + '@conference.' + currentUser.jid.split('@')[1]);
            $('.chat-cont-group-members').html(`<label style="cursor: pointer;" class="view-members" onclick="showMemberHandler('${roomName}')"><u>View Member List</u></label>`);

            // init channel list
            $('.cancel_create').click();
            // If already exist in left panel
            let exist = chatMini.some(function (chat) {
                if (chat.roomName === roomName) {
                    // Default open the chat directly, need change the read status.
                    chat.read = true;
                    return true;
                }
            });
            if (exist) {
                // exist，remove to first one
                let _html = null;
                let childElements = $('.chatChannelList').children();
                for (let i = 0; i < childElements.length; i++) {
                    let item = childElements[i];
                    if ($(item).find('.chatChannelJid').html() === roomName) {
                        $(item).remove();
                        _html = item;
                    }
                }
                $('.chatChannelItem.active').removeClass('active');
                $('.chatChannelList').prepend(_html);
                $('.chatChannelItem:first').addClass('active');
                $('.chatChannelItem:first').find('.chatChannelIsRead').removeClass('unread').add('read');
            } else {
                // not exist, create and put it first
                // For select one color from colors

                let chatChannelItem = `<div class="chatChannelItem">
                                    <div class="chatChannelAlias ${chatColors[randomNum]}">${roomName.substr(0, 1).toUpperCase()}</div>
                                    <div class="chatChannelName">${'Room - ' + roomName}</div>
                                    <div class="chatChannelJid" style="display: none;">${roomName}</div>
<!--                                    <div class="chatChannelLastMsg"></div>-->
<!--                                    <div class="chatChannelIsRead read"></div>-->
                                </div>`;
                $('.chatChannelList').prepend(chatChannelItem);
                $('.chatChannelItem.active').removeClass('active');
                $('.chatChannelItem:first').addClass('active');

                chatMini.push({roomName: roomName, roomType: 'groupChat', read: true, lastMsg: ""});
                chatDetail.push({roomName: roomName, roomType: 'groupChat', roomMsg: []});
            }
            miniChatClickHandler(randomNum, {roomName: roomName, roomType: 'groupChat'})

        } else {
            popupInfo('Create room fail,please try again.')
        }
    });

    $('.input-search-chat').keyup(function (e) {
        if (e.keyCode === 13) {
            // Null user selected
            if (!currentChatTarget.roomName) return;
            if ($('.input-search-chat').val().trim() === '') return;
            if (currentChatTarget.roomType === 'robot') {
                // only chat self
                // robotChatHandler();
            } else {
                createMsg();
            }
        }
    });

    $('.chat_tab :nth-child(2)').click(function () {
        initFriendListHandler();
        console.log('init contact list!');
    });

    $('.chat-tab2 :nth-child(3)').click(function () {
        console.log('init convoy appoint user!');
        // initChatConvoyAppointUI();
    });

    $('.chat-tab2 :nth-child(1), .chat-tab2 :nth-child(2), .chat_tab :nth-child(1)').click(function () {
        console.log('clear convoy appoint user!');
        clearChatConvoyAppointUI();
    });

    if (chatServer && !$('#bottom-cont').hasClass('min')) {
        // TODO: get message first
        // getAllChatMsgUnReceivedByUserJid();
        getAllChatMsgByUserID();
    }
    // TODO: every 5 seconds,get latest chat message and refresh panel
    setInterval(() => {
        // need at login status
        if (chatServer && !$('#bottom-cont').hasClass('min')) {
            // TODO: get message first
            // getAllChatMsgUnReceivedByUserJid();
            getAllChatMsgByUserID();
        }
    }, 3000);
};

// const robotChatHandler = function () {
//     console.log('here is robot chat!');
//     let to = currentChatTarget.roomName;
//     let from = currentUser.name;
//     // let domain = currentUser.name.split('@')[1];
//     let msg = $('.input-search-chat').val();
//     $('.input-search-chat').val(null);
//     if (currentChatTarget.roomType === 'robot') {

//         let messageIconColor = '';
//         // find out icon color
//         let classList = $('.chat-user-icon').attr('class').split(' ');
//         classList.some((c) => {
//             return chatColors.some((cc) => {
//                 if (c === cc) {
//                     messageIconColor = c;
//                     return true;
//                 }
//             })
//         });

//         let chatMessages = `<div class="message-right">
//                                 <div class="message-label bold">${currentUser.name}</div>
//                                 <div class="message-text">${createEmojiMsg(msg)}</div>
//                                 <div class="message-icon ${messageIconColor} right">${from.substr(0, 1).toUpperCase()}</div>
//                                 <div class="message-time right">${moment(msg.time).format('HH:mm')}</div>
//                             </div>`;

//         if (!$('.chat-messages').html()){
//             $('.chat-messages').html(`<div class="message-spacer"></div>`);
//         }
//         $('.message-spacer').before(chatMessages);
//         $('.chat-messages').stop().animate({scrollTop: $('.chat-messages')[0].scrollHeight}, 400);

//         for (let detail of chatDetail) {
//             if (detail.roomName === to) {
//                 detail.roomMsg.push({content: msg, msgType: 'text', fromJid: from,
//                     toJid: to, time: moment().format('YYYY-MM-DD HH:mm:ss'), roomType: currentChatTarget.roomType, contentSize: 0});
//             }
//         }

//         for (let mini of chatMini) {
//             if (mini.roomName === to) {
//                 mini.lastMsg = {content: msg, msgType: 'text', fromJid: from,
//                     toJid: to, time: moment().format('YYYY-MM-DD HH:mm:ss'), roomType: currentChatTarget.roomType, contentSize: 0};
//                 $('.chatChannelJid').each(function () {
//                     if ($(this).html() === to) {
//                         $(this).next().html(msg.substr(0, 6) + '...');
//                     }
//                 });
//             }
//         }

//         // HTTP
//         setTimeout(() => {
//             getConvoyInfo(msg).then((result) => {

//                 let messageIconName = currentChatTarget.roomName.substr(0, 1).toUpperCase();
//                 let messageIconColor = '';
//                 // find out icon color
//                 let classList = $('.chat-cont-alias').attr('class').split(' ');
//                 classList.some((c) => {
//                     return chatColors.some((cc) => {
//                         if (c === cc) {
//                             messageIconColor = c;
//                             return true;
//                         }
//                     })
//                 });

//                 if (!result) {
//                     wrongInputMsgHandler('Convoy name does not exist!', messageIconColor);
//                     return;
//                 }

//                 // show convoy menu on chat message
//                 let chatMessages = `<div class="message-left">
//                                     <div class="message-label bold">${currentChatTarget.roomName}</div>
//                                     <div class="message-text message-robot">
//                                         <div class="message-robot-title">You can click the below links to get the detail information of convoy ${msg}.</div>
//                                         <div class="message-robot-menu position">POSITION</div>
//                                         <div class="message-robot-menu status">STATUS</div>
//                                         <div class="message-robot-menu eta">ETA</div>
//                                         <div class="message-robot-menu online">ONLINE-STATE</div>
//                                         <div class="message-robot-menu last-position">LAST POSITION</div>
//                                         <div class="message-robot-menu convoyName" style="display: none">${msg}</div>
//                                     </div>
//                                     <div class="message-icon ${messageIconColor} left">${messageIconName}</div>
//                                     <div class="message-time">${moment().format('HH:mm')}</div>
//                                 </div>`;
//                 $('.message-spacer').before(chatMessages);
//                 $('.chat-messages').stop().animate({scrollTop: $('.chat-messages')[0].scrollHeight}, 400);

//                 // for robot chat
//                 // robotMenuHandler(messageIconName, messageIconColor);

//                 // add this message into chatDetail
//                 for (let detail of chatDetail) {
//                     if (detail.roomName === to) {
//                         detail.roomMsg.push({content: msg, msgType: 'robot', fromJid: currentChatTarget.roomName,
//                             toJid: currentUser.name, time: moment().format('YYYY-MM-DD HH:mm:ss'), roomType: currentChatTarget.roomType, contentSize: 0, isRead: 1});
//                     }
//                 }
//             })
//         }, 40);

//     }
// };

const sortSingleMiniChat = function () {
    // console.warn("**************** start sort mini chat")

    chatMini.sort(function(a, b){
        if (a.lastMsgTime && b.lastMsgTime)
            return moment(a.lastMsgTime).isBefore(moment(b.lastMsgTime)) ? 1 : -1;
        else if (!a.lastMsgTime && b.lastMsgTime) return 1;
        else if (a.lastMsgTime && !b.lastMsgTime) return -1;
        else return 0;
    })
    // console.warn(chatMini)
    // console.warn("**************** end sort mini chat")
}

const sortRoomList = function (list) {
    // console.warn("**************** start sort room list")
    if (list && list.length) {
        list = list.sort(function(a, b){
            if (a.msgTime && b.msgTime)
                return moment(a.msgTime).isBefore(moment(b.msgTime)) ? 1 : -1;
            else if (!a.msgTime && b.msgTime) return 1;
            else if (a.msgTime && !b.msgTime) return -1;
            else return 0;
        })
    }
    // console.warn(list)
    // console.warn("**************** end sort room list")
    return list;
}

const initSingleMiniChat = async function () {
    $('.chatChannelList').empty();
    $('.chat-messages').empty();
    $('.chat-cont-alias').empty();
    $('.chat-cont-channel-name').empty();
    $('.chat-cont-group-members').empty();
    $('.chat-current-user').html(Cookies.get('username'));
    $('.chat-user-icon').html(Cookies.get('username').substr(0, 1).toUpperCase());

    // let openfireUserList = await getOpenfireUserList();
    // let roomList = await getAllRoomsAndFriendsByUser();

    // await getAllChatMsgByUserID();
    sortSingleMiniChat();

    for (let chat of chatMini) {
        let unreadMsgNum = 0;
        chatDetail.some((detail) => {
            if (detail.roomName === chat.roomName) {
                detail.roomMsg.forEach((msg) => {
                    if (msg.isRead === 0) unreadMsgNum++;
                });
                return true;
            }
        });

        let showRoomName = null;
        if (chat.roomType === 'chat') {
            showRoomName = chat.roomName;
        } else if (chat.roomType === 'groupChat') {
            showRoomName = 'Room - ' + chat.roomName;
        } else if (chat.roomType === 'robot') {
            showRoomName = chat.roomName;
        }

        // generate user icon
        let userIconHtml = '';
        if (chat.roomType === 'chat') {
            friends.some((friend) => {
                if (friend.userName === chat.roomName && friend.icon) {
                    userIconHtml = `<img class="chat-user-icon-img" src="data:image/png;base64,${friend.icon}"/>`;
                    return true;
                }
            })
        }

        // For select one color from colors
        let randomNum = Math.floor(Math.random() * (chatColors.length));
        let chatChannelItem = `<div class="chatChannelItem">`;
        if (userIconHtml) chatChannelItem += userIconHtml;
        else chatChannelItem += `<div class="chatChannelAlias ${chatColors[randomNum]}">${chat.roomName.substr(0,1).toUpperCase()}</div>`;
        chatChannelItem +=  `<div class="chatChannelName">${showRoomName}</div>
                            <div class="chatChannelJid" style="display: none;">${chat.roomName}</div>
<!--                            <div class="chatChannelLastMsg">${chat.lastMsg.content ? chat.lastMsg.content.substr(0,25) : ''}...</div>-->
                            ${unreadMsgNum ? '<div class="chatChannelIsRead unread">'+ unreadMsgNum +'</div>' : ''}
                        </div>`;
        $('.chatChannelList').append(chatChannelItem);
        miniChatClickHandler(randomNum, chat);
    }
};

const miniChatClickHandler = function (randomNum,  chat) {
    $('.chatChannelItem:last').on('click', function () {
        currentChatTarget.roomName = chat.roomName;
        currentChatTarget.roomType = chat.roomType;


        $('.chatChannelItem.active').removeClass('active');
        $(this).addClass('active');

        // let openfireUserList = await getOpenfireUserList();
        // let roomList = await getAllRoomsAndFriendsByUser();
        // Init topInfo of chatDetail
        try {
            $('.chat-top-user-icon-img').remove();
            let beforeColor = $('.chat-cont-alias').attr('class').split(' ')[1];
            $('.chat-cont-alias').html(chat.roomName.substr(0,1).toUpperCase()).removeClass(beforeColor).addClass(chatColors[randomNum]);
            $('.chat-cont-channel-name').css('margin-left', '1px');
        } catch (e) {
            $('.chat-cont-top').prepend(`<div class="chat-cont-alias ${chatColors[randomNum]}">${chat.roomName.substr(0,1).toUpperCase()}</div>`);
            $('.chat-cont-channel-name').css('margin-left', '1px');
        }

        // generate user icon
        // let userIconHtml = '';
        // if (currentChatTarget.roomType === 'chat') {
        //     friends.some((friend) => {
        //         if (friend.userName === currentChatTarget.roomName && friend.icon) {
        //             userIconHtml = `<img class="chat-top-user-icon-img" src="data:image/png;base64,${friend.icon}"/>`;
        //             $('.chat-cont-channel-name').css('margin-left', '50px');
        //             return true;
        //         }
        //     })
        // }
        // if (userIconHtml) {
        //     $('.chat-cont-alias').remove();
        //     $('.chat-cont-top').prepend(userIconHtml);
        // }

        let showRoomName = null;
        if (chat.roomType === 'chat') {
            showRoomName = chat.roomName;
            $('.chat-cont-group-members').html(null);
        }
        else if (chat.roomType === 'groupChat') {
            showRoomName = 'Room - ' + chat.roomName;
            $('.chat-cont-group-members').html(`<label style="cursor: pointer;" class="view-members" onclick="showMemberHandler('${chat.roomName}')"><u>View Member List</u></label>`);
        }
        else if (chat.roomType === 'robot') {
            showRoomName = chat.roomName;
            $('.chat-cont-group-members').html(null);
        }
        $('.chat-cont-channel-name').html(showRoomName);
        // $('.chat-cont-group-members').html(chat.roomType === 'chat' ? chat.roomName + '@' + currentUser.jid.split('@')[1] : chat.roomName + '@conference.' + currentUser.jid.split('@')[1]);

        $(this).find('div[class*="chatChannelIsRead"]').removeClass('unread').addClass('read').empty();

        detailChatHandler(chat.roomName, randomNum);

        // disable some function
        if (currentChatTarget.roomType === 'robot') {
            $('.chat-mic').addClass('disable');
            $('.chat-video').addClass('disable');
            $('.chat-attachment').addClass('disable');
        } else {
            $('.chat-mic').removeClass('disable');
            $('.chat-video').removeClass('disable');
            $('.chat-attachment').removeClass('disable');
        }
    });
    // $('.chatChannelItem:first').click();
};

const detailChatHandler = async function (roomName, randomNum) {
    $('.chat-messages').empty();

    let chat = chatDetail.find(function (chat) {
        if (currentChatTarget && currentChatTarget.roomName === chat.roomName && currentChatTarget.roomType === chat.roomType) {
            return true;
        }
    });
    let chatMessages = '<div class="chat-more"><img src="/icons/up-arrow.png" class="btn-action" data-action="chat-more"/></div>';
    let flagOfRead = true;
    let flagOfReadMsgObj = null;

    let messageRobotIconName = currentChatTarget.roomName.substr(0, 1).toUpperCase();
    let messageRobotIconColor = '';
    try {
        // find out icon color
        let classList = $('.chat-cont-alias').attr('class').split(' ');
        classList.some((c) => {
            return chatColors.some((cc) => {
                if (c === cc) {
                    messageRobotIconColor = c;
                    return true;
                }
            })
        });
    } catch (e) {
        console.log('This person have icon!');
    }

    let tempIconList = [];
    for (let msg of chat.roomMsg) {
        // let msg = chat.roomMsg[index];
        // // if (!msg.fromJid) return;
        // console.log(msg);
        let panelClass = null, panelName = null;
        if (chat.roomType === 'robot') {
            panelClass = msg.fromJid.split('@')[0].startsWith(currentUser.name) ? 'message-right' : 'message-left';
            panelName = msg.fromJid.split('@')[0];
        } else if (chat.roomType === 'chat') {
            // panelClass = ((chat.roomType === 'chat' && msg.fromJid === currentUser.name) || (chat.roomType === 'groupChat' && msg.fromJid ===  currentUser.name)) ? 'message-right' : 'message-left';
            panelClass = msg.fromJid === currentUser.name ? 'message-right' : 'message-left';
            panelName = msg.fromJid;
        } else if (chat.roomType === 'groupChat') {
            panelClass = msg.fromJid.split('@')[1] === currentUser.name ? 'message-right' : 'message-left';
            panelName = msg.fromJid.split('@')[1];
        }
        if (!panelName) {
            // this is invite
            panelName = msg.fromJid.split('@')[0];
        }

        // TODO: add unread flag, only for private chat, and only for target object
        // if (!msg.isRead && flagOfRead && msg.roomType !== 'robot') {
        //     // console.warn('Add unread bar!');
        //     flagOfRead = false;
        //     flagOfReadMsgObj = msg;
        //     chatMessages += `<div class="unread-div" style="width: 100%;"><div class="unread-bar">Unread Message</div><hr class="unread-bar-line"> </hr></div>`;
        // }
        // TODO: add unread circle flag, show friends read latest state(only for never login friend)
        if (chat.roomType === 'groupChat' && chat.unreadFlag && chat.unreadFlag.length) {
            let html = `<div class="unread-friend-div" style="width: 100%;float: right;margin-top: 5px;">`;
            let unreadCount = 0;
            for (let unread of chat.unreadFlag) {
                // while msgId is 0, means never login, need set unread circle at first place(index = 0)
                if (unread.msgId === 0 && index === 0) {
                    unreadCount++;
                    html += `<div class="unread-friend-circle" userId="${unread.toJid}" onclick="showFriendDetail('${unread.toJid}')">${unread.toJid.substr(0, 1).toUpperCase()}</div>`;
                }
            }
            html += `</div>`;
            if (unreadCount) chatMessages += html;
        }

        let messageIconName = panelClass.split('-')[1] === 'left' ? currentChatTarget.roomName.substr(0, 1).toUpperCase() : currentUser.name.substr(0, 1).toUpperCase();
        let messageIconColor = panelClass.split('-')[1] === 'left' ? chatColors[randomNum] : '';

        // generate user icon
        let userIconHtml = '';
        if (chat.roomType === 'chat') {
            // let user = await getUserByOpenfireName(chat.roomName);
            // if (user && user.icon) {
            //     let tempIcon = {};
            //     tempIcon[chat.roomName] = user.icon;
            //     tempIconList.push(tempIcon);
            //     userIconHtml = `<img class="chat-detail-user-icon-img" src="data:image/png;base64,${user.icon}"/>`;
            // }

            friends.some((friend) => {
                if (friend.jid === chat.roomName && friend.icon) {
                    userIconHtml = `<img class="chat-detail-user-icon-img" src="data:image/png;base64,${friend.icon}"/>`;
                    return true;
                }
            })
        }
        else if (chat.roomType === 'groupChat') {
            // let user = await getUserByOpenfireName(msg.fromJid.split('/')[1].toLowerCase());
            // if (user && user.icon) {
            //     let tempIcon = {};
            //     tempIcon[msg.fromJid.split('/')[1].toLowerCase()] = user.icon;
            //     tempIconList.push(tempIcon);
            //     userIconHtml = `<img class="chat-detail-user-icon-img" src="data:image/png;base64,${user.icon}"/>`;
            // }
            friends.some((friend) => {
                if (friend.name === msg.fromJid && friend.icon) {
                    userIconHtml = `<img class="chat-detail-user-icon-img" src="data:image/png;base64,${friend.icon}"/>`;
                    return true;
                }
            })
        }

        let sendStatusHtml = ``;
        if (currentUser.sysConf.allowNotice) {
            sendStatusHtml = `<label class="send-status">
                                ${panelClass.split('-')[1] === 'right' ? 
                                    (currentChatTarget.roomType === 'chat' ? 
                                        (msg.received === 1 ? '<img class="send-status-img" src="./images/chat/read_icon.png">' : '<img class="send-status-img" src="./images/chat/send_icon.png">') : '<img class="send-status-img" src="/images/chat/read_icon.png">') : ''}
                              </label>`;
        }

        if (msg.content.startsWith('[/file0#')) {
            let fileName = msg.content.replace('[/file0#', '');
            let newFileName = renameFile2Short(fileName);
            chatMessages += `<div class="${panelClass}">
                                            <div class="message-label bold">${panelName}</div>
                                            <div class="message-text">
                                                <button onclick="downloadFile(\'${fileName}\');" class="btn btn-primary convoy-btn" style="width: 210px; height: 60px; background-color: #ebdbdb; padding: 5px 10px; border-radius: 10px; cursor: pointer;" >
                                                    <img style="width:38px; border-radius: 5px;float: left;" src="./images/file.jpg" />
                                                    <label style="float: right;font-size: medium;line-height: 70px;color: black; cursor: pointer;">${newFileName}</label>
                                                </button>
                                            </div>
                                            <div class="message-icon ${panelClass.split('-')[1]} ${messageIconColor}">${messageIconName}</div>
                                            <div class="message-time ${panelClass.split('-')[1]}">${moment(msg.time).format('HH:mm')}
                                                ${sendStatusHtml}
                                            </div>
                                        </div>`;
        }
        else if (msg.msgType === 'soundData') {
            chatMessages += `<div class="${panelClass}" style="width: 440px;">
                                <div class="message-label bold">${panelName}</div>
                                <div class="message-text">
                                    <label style="line-height: 30px;float: left;">${msg.contentSize} s &nbsp;</label>
                                    <a style="background-image: url(./icons/audio-left.svg); width: 31px;height: 32px;display: inline-block;" class="audio" href="javascript:void(0);" onclick="playAudio(this, \'${msg.content}\', \'left\', \'${msg.contentSize}\')"></a></div>
                                <div class="message-icon ${panelClass.split('-')[1]} ${messageIconColor}">${messageIconName}</div>
                                <div class="message-time ${panelClass.split('-')[1]}">${moment(msg.time).format('HH:mm')}
                                    ${sendStatusHtml}
                                </div>
                            </div>`;
        }
        else if (msg.content.startsWith('video:!~')) {
            let _msg = msg.content.replace('video:!~', '').replace('Open Video Chat', '');
            let target = _msg.trim().replace(/ /g, '');
            chatMessages += `<div class="${panelClass}" style="width: 440px;">
                                <div class="message-label bold">${panelName}</div>
                                <div class="message-text">You are invited to video chat!<br><a style="color: blue;" onclick="openVideo(\'${target}\')">Go</a></div>
                                <div class="message-icon ${panelClass.split('-')[1]} ${messageIconColor}">${messageIconName}</div>
                                <div class="message-time ${panelClass.split('-')[1]}">${moment(msg.time).format('HH:mm')}
                                    ${sendStatusHtml}
                                </div>
                            </div>`;
        }
        else if (msg.msgType === 'imgData') {
            chatMessages += `<div class="${panelClass} ">
                                <div class="message-label bold">${panelName}</div>
                                <div class="message-text">
                                    <!--<img style="width: 100px;cursor: pointer;" src="data:image/png;base64,${msg.content.split(':::')[1]}" onclick="downloadImg(\'${msg.content}\');"/>-->
                                    <img style="width: 100px;cursor: pointer;" src="data:image/png;base64,${msg.content.split(':::')[1]}" />
                                </div>
                                <div class="message-icon ${panelClass.split('-')[1]} ${messageIconColor}">${messageIconName}</div>
                                <div class="message-time ${panelClass.split('-')[1]}">${moment(msg.time).format('HH:mm')}
                                    ${sendStatusHtml}
                                </div>
                            </div>`;
        }
        else if (msg.msgType === 'text'){
            chatMessages += `<div class="${panelClass}">
                                <div class="message-label bold">${panelName}</div>
                                <div class="message-text">${createEmojiMsg(msg.content)}</div>
                                <div class="message-time ${panelClass.split('-')[1]} ">${moment(msg.time).format('HH:mm')}
                                    ${sendStatusHtml}
                                </div>`;
            if (panelClass.split('-')[1] === 'left') {
                if (userIconHtml) chatMessages += userIconHtml;
                else chatMessages += `<div class="message-icon ${panelClass.split('-')[1]} ${messageIconColor}">${messageIconName}</div>`;
            } else {
                chatMessages += `<div class="message-icon ${panelClass.split('-')[1]} ${messageIconColor}">${messageIconName}</div>`;
            }
            chatMessages += `</div>`;
        }
        else if (msg.msgType === 'robot') {
            chatMessages += `<div class="message-left">
                                    <div class="message-label bold">${currentChatTarget.roomName}</div>
                                    <div class="message-text message-robot">
                                        <div class="message-robot-title">You can click the below links to get the detail information of convoy ${msg.content}.</div>
                                        <div class="message-robot-menu position">POSITION</div>
                                        <div class="message-robot-menu status">STATUS</div>
                                        <div class="message-robot-menu eta">ETA</div>
                                        <div class="message-robot-menu online">ONLINE-STATE</div>
                                        <div class="message-robot-menu last-position">LAST POSITION</div>
                                        <div class="message-robot-menu convoyName" style="display: none">${msg.content}</div>
                                    </div>`;
            if (panelClass.split('-')[1] === 'left') {
                if (userIconHtml) chatMessages += userIconHtml;
                else chatMessages += `<div class="message-icon ${messageRobotIconColor} left">${messageRobotIconName}</div>`;
            } else {
                chatMessages += `<div class="message-icon ${messageRobotIconColor} left">${messageRobotIconName}</div>`
            }
            chatMessages += `<div class="message-time left">${moment().format('HH:mm')}</div>
                                </div>`;
        }
        else if (msg.msgType === 'robot-unit') {
            chatMessages += `<div class="message-left">
                                    <div class="message-label bold">${currentChatTarget.roomName}</div>
                                    <div class="message-text message-robot">
                                        <div class="message-robot-title">Unit List</div>
                                        <div id="unit-tree" class="demo-tree-more"></div>`;
            // for (let unit of unitList) {
            //     chatMessages += `<div class="message-unit-menu unit">${unit.unit}</div>`;
            //     let subUnitList = unit.subUnits.split(',');
            //     for (let subUnit of subUnitList) {
            //         chatMessages += `<div class="message-unit-menu sub-unit">${subUnit}</div>`;
            //
            //         for (let convoy of convoyList) {
            //             if (convoy.unit === unit.unit && convoy.subUnit === subUnit) {
            //                 chatMessages += `<div class="message-unit-menu convoy">${convoy.convoyName}</div>`;
            //             }
            //         }
            //     }
            // }
            chatMessages += `</div>`;
            if (panelClass.split('-')[1] === 'left') {
                if (userIconHtml) chatMessages += userIconHtml;
                else chatMessages += `<div class="message-icon ${messageRobotIconColor} left">${messageRobotIconName}</div>`;
            } else {
                chatMessages += `<div class="message-icon ${messageRobotIconColor} left">${messageRobotIconName}</div>`
            }
            chatMessages += `<div class="message-time left">${moment().format('HH:mm')}</div>
                                </div>`;
        }

        // TODO: add unread circle flag, show friends read latest state
        if (chat.roomType === 'groupChat' && chat.unreadFlag && chat.unreadFlag.length) {
            let html = `<div class="unread-friend-div" style="width: 100%;float: right;margin-top: 5px;">`;
            let unreadCount = 0;
            for (let unread of chat.unreadFlag) {
                // while msgId is not 0,  need check current msgId and check isRead
                if (unread.msgId === msg.msgId && !unread.isRead) {
                    unreadCount++;
                    html += `<div class="unread-friend-circle" userId="${unread.toJid}" onclick="showFriendDetail('${unread.toJid}')">${unread.toJid.substr(0, 1).toUpperCase()}</div>`;
                }
            }
            html += `</div>`;
            if (unreadCount) chatMessages += html;
        }
    }
    // console.log(new Date());
    $(".chat-messages").html(chatMessages);

    // if (chat.roomType === 'robot') {
    //     let convoyList = await initConvoyList();
    //     await initUnitList();
    //     layui.use(['tree', 'util'], function(){
    //         let tree = layui.tree;

    //         let dataList = [];
    //         for (let unit of unitList) {
    //             let data = {};
    //             data.title = unit.unit;
    //             data.id = 'unit';
    //             data.children = [];
    //             if (unit.subUnits) {
    //                 for (let subUnit of unit.subUnits.split(',')) {
    //                     data.children.push({title: subUnit, id: 'subUnit', children: []});
    //                 }
    //             } else {
    //                 console.warn(`No subunit here unit: ${ unit.unit }`)
    //             }
    //             for (let child of data.children) {

    //                 for (let convoy of convoyList) {
    //                     if (convoy.unit === data.title && convoy.subUnit === child.title) {
    //                         child.children.push({title: convoy.convoyName, id: 'convoyName', children: []});
    //                     }
    //                 }
    //             }
    //             // console.log(data);
    //             dataList.push(data);
    //         }

    //         tree.render({
    //             elem: '#unit-tree'
    //             ,data: dataList
    //             ,onlyIconControl: true
    //             ,click: function(obj){
    //                 // layer.msg(JSON.stringify(obj.data));
    //                 if (obj.data.id === 'convoyName') {
    //                     $('.input-search-chat').val(obj.data.title);
    //                     robotChatHandler();
    //                 }

    //             }
    //         });

    //     });
    // }

    // for robot chat
    // robotMenuHandler(messageRobotIconName, messageRobotIconColor);

    // TODO: set this chat message as read
    // if (!flagOfRead) {
    //     // TODO: not self, only check msg fromJid
    //     // if flagOfReadMsgObj is roomMsg,
    //     if (!flagOfReadMsgObj.fromJid.startsWith(currentUser.jid)) {
    //         // TODO: after 5 seconds, remove it
    //         setTimeout(() => {
    //             $('.unread-div').remove();
    //             console.warn('Remove unread bar!');
    //             // TODO: only use for receive,
    //             if (chat.roomType === 'chat') {
    //                 setChatMsgRead(currentChatTarget.roomName + '@' + currentUser.domain, currentUser.jid);
    //             } else {
    //                 let msgId = chat.roomMsg[chat.roomMsg.length - 1].msgId;
    //                 setChatMsgRead(currentChatTarget.roomName + '@conference.' + currentUser.domain, currentUser.jid, msgId);
    //             }
    //             // TODO: update all msg isRead = 1
    //             chat.roomMsg.forEach((msg) => { msg.isRead = 1 })
    //         }, 5000);
    //     }
    // }

    let space = `<div class="message-spacer"></div>`;
    $('.chat-messages').append(space);

    // calculate current scroll bar height
    // if not at bottom, do not continue
    let scrollTop = $(".chat-messages")[0].scrollTop;

    if (Math.abs(($(".chat-messages")[0].scrollTop + $(".chat-messages").height()) - $(".chat-messages")[0].scrollHeight) < 120) {
        // console.log('ScrollBar is at bottom');
        $('.chat-messages').stop().animate({scrollTop: $('.chat-messages')[0].scrollHeight}, 300);
    }
    // else if (scrollTop === 0) {
    //     console.log('ScrollBar is at top');
    //     $('.chat-messages').stop().animate({scrollTop: $('.chat-messages')[0].scrollHeight}, 300);
    // }
};

const initFriendListHandler = function () {
    const initPersonalAndRoomSelectChat = function () {
        $('.selectChatMembers').empty();
        $('.chat_convoys_items').empty();
        // add private list
        $('.chat_persons').html(`<div class="chat-person-hq">
                                <div style="line-height: 20px;text-align: center;background-color: gray;"><label style="color: white;font-weight: bolder;">HQ</label></div>
                             </div>`);
        $('.selectChatMembers').append(`<div class="chat-room-hq">
                                <div style="line-height: 20px;text-align: center;background-color: gray;"><label style="color: white;font-weight: bolder;">HQ</label></div>
                             </div>`);
        let hqAndUnitFriendList = [].concat(hqFriendList, unitFriendList)
        for (let friend of hqAndUnitFriendList) {
            // console.log(friend)
            // Add html
            let randomNum = Math.floor(Math.random() * chatColors.length);
            // console.log(11 + ' => ' + randomNum)
            let html = `<div class="selectChannelItem">
                        <div class="selectChannelAlias ${chatColors[randomNum]}">${friend.username.substr(0,1).toUpperCase()}</div>
                        <div class="selectChannelName">${friend.username}</div>
                        <div class="selectChannelJid" style="color: white;">${friend.username}</div>
                        <div class="selectChannelID" style="color: white;display: none">${friend.userId}</div>
                        <div class="selectChannelOnline ${friend.online ? 'online':'offline'}"></div>
                    </div>`;
            $('.chat_persons>.chat-person-hq').append(html);

            // Click event handler
            $(".chat_persons>.chat-person-hq>.selectChannelItem:last").on('click', async function () {
                // Every click will change current talk target
                let name = $(this).find('div[class="selectChannelJid"]').html();
                let username = $(this).find('div[class="selectChannelName"]').html();
                // Init currentChatTarget
                name = name.split('@')[0];
                currentChatTarget.roomName = name;
                currentChatTarget.roomType = 'chat';

                // let openfireUserList = await getOpenfireUserList();
                // Init topInfo of chatDetail
                let beforeColor = $('.chat-cont-alias').attr('class').split(' ')[1];
                $('.chat-cont-alias').html(name.substr(0, 1).toUpperCase()).removeClass(beforeColor).addClass(chatColors[randomNum]);
                $('.chat-cont-channel-name').html(username);
                // $('.chat-cont-group-members').html(name + '@' + currentUser.domain);

                // init channel list
                $('.cancel_create').click();
                $('.chat_tab').children(":first").click();
                // If already exist in left panel
                let exist = chatMini.some(function (chat) {
                    if (chat.roomName === name) {
                        // Default open the chat directly, need change the read status.
                        chat.read = true;
                        return true;
                    }
                });
                if (exist) {
                    // exist，remove to first one
                    let _html = null;
                    let childElements = $('.chatChannelList').children();
                    for(let i = 0; i<childElements.length; i++){
                        let item = childElements[i];
                        if($(item).find('.chatChannelJid').html() === name) {
                            $(item).remove();
                            _html = item;
                        }
                    }
                    $('.chatChannelItem.active').removeClass('active');
                    $('.chatChannelList').append(_html);
                    $('.chatChannelItem:last').addClass('active');
                    $('.chatChannelItem:last').find('.chatChannelIsRead').removeClass('unread').add('read');
                } else {
                    // not exist, create and put it first
                    // For select one color from colors
                    let chatChannelItem = `<div class="chatChannelItem">
                                    <div class="chatChannelAlias ${chatColors[randomNum]}">${name.substr(0,1).toUpperCase()}</div>
                                    <div class="chatChannelName">${username}</div>
                                    <div class="chatChannelJid" style="display: none;">${name}</div>
<!--                                    <div class="chatChannelLastMsg"></div>-->
<!--                                    <div class="chatChannelIsRead read"></div>-->
                                </div>`;
                    $('.chatChannelList').append(chatChannelItem);
                    $('.chatChannelItem.active').removeClass('active');
                    $('.chatChannelItem:last').addClass('active');
                    console.log('add friend');

                    chatMini.push({roomName: name, roomType: 'chat', read: true, lastMsg: ""});
                    chatDetail.push({roomName: name, roomType: 'chat', roomMsg: []});
                }
                miniChatClickHandler(randomNum, {roomName: name, roomType: 'chat'});
            });

            // show friends for create new room
            let memberHtml = `<div class="selectChannelItem">
                            <div class="selectChannelAlias ${chatColors[randomNum]}">${friend.username.substr(0,1).toUpperCase()}</div>
                            <div class="selectChannelName">${friend.username}</div>
                            <div class="selectChannelJid" style="display: none;">${friend.username}</div>
                            <div class="selectChannelID" style="color: white;display: none">${friend.userId}</div>
                            <div class="selectChannelMember layui-unselect layui-form-checkbox" lay-skin="primary" style="margin: 16px 8px 16px 8px;padding-left: 0px;"><i class="layui-icon layui-icon-ok"></i></div>
                            <div class="selectChannelRoomOnline ${friend.online ? 'online':'offline'}"></div>
                        </div>`;
            // console.log(memberHtml);
            $('.selectChatMembers>.chat-room-hq').append(memberHtml);
            $('.selectChatMembers>.chat-room-hq>.selectChannelItem:last').find('div[class*="selectChannelMember"]').click(function () {
                if($(this).hasClass('layui-form-checked')) {
                    $(this).removeClass('layui-form-checked');
                }else {
                    $(this).addClass('layui-form-checked');
                }
            });
        }

//         // 2、add mobile user list
        // let MobileFriendList = getMobileUser(friends);
        // let convoyTypeList = new Set();
        // MobileFriendList.forEach(friend => {convoyTypeList.add(friend.convoyName)});
        // convoyTypeList = Array.from(convoyTypeList);

        // // Sort it !!!!
        // convoyTypeList.sort(function(a, b) {
        //     return (a.convoyName + '').localeCompare(b.convoyName + '');
        // });


        $('.chat_convoys_items').append(`<div class="chat-person-mobile"></div>`);
        // // console.log('convoyTypeList: ', convoyTypeList);
        // convoyTypeList.forEach((convoy) => {
        //     let randomNum = Math.floor(Math.random() * chatColors.length);
        //     let html = `<div class="selectChannelItem">
        //                 <div class="selectChannelAlias ${chatColors[randomNum]}">${convoy.substr(0,1).toUpperCase()}</div>
        //                 <div class="selectChannelName">${convoy}</div>
        //             </div>`;
        //     $('.chat-person-mobile').append(html);
        // });
        $('.selectChatMembers').append(`<div class="chat-room-mobile">
                                    <div style="line-height: 20px;text-align: center;background-color: gray;"><label style="color: white;font-weight: bolder;">Convoy</label></div>
                                </div>`);

        for (let friend of driverFriendList) {
            let randomNum = Math.floor(Math.random() * chatColors.length);
            // console.log(friend)
            // show friends for create new room
            let memberHtml = `<div class="selectChannelItem">
                            <div class="selectChannelAlias ${chatColors[randomNum]}">${friend.username.substr(0,1).toUpperCase()}</div>
                            <div class="selectChannelName">${friend.username}</div>
                            <div class="selectChannelJid" style="display: none;">${friend.username}</div>
                            <div class="selectChannelID" style="color: white;display: none">${friend.userId}</div>
                            <div class="selectChannelMember layui-unselect layui-form-checkbox" lay-skin="primary" style="margin: 16px;padding-left: 0;float: right;"><i class="layui-icon layui-icon-ok"></i></div>
                            <div class="selectChannelRoomOnline ${friend.online ? 'online':'offline'}"></div>
                        </div>`;
            $('.selectChatMembers .chat-room-mobile').append(memberHtml);
            $('.selectChatMembers .chat-room-mobile .selectChannelItem:last').find('div[class*="selectChannelMember"]').click(function () {
                if($(this).hasClass('layui-form-checked')) {
                    $(this).removeClass('layui-form-checked');
                }else {
                    $(this).addClass('layui-form-checked');
                }
            });
        }
        // Click event handler, show convoy appoint member list
        $('.chat-group-member-list').empty();
        for (let friend of driverFriendList) {
            let randomNum = Math.floor(Math.random() * chatColors.length);
            // Add html
            let html = `<div class="selectChannelItem">
                        <div class="selectChannelAlias ${chatColors[randomNum]}">${friend.username.substr(0,1).toUpperCase()}</div>
                        <div class="selectChannelName">${friend.username}</div>
                        <div class="selectChannelJid" style="color: white;">${friend.username}</div>
                        <div class="selectChannelID" style="color: white;display: none">${friend.userId}</div>
                        <div class="selectChannelOnline ${friend.online ? 'online':'offline'}"></div>
                    </div>`;
            $('.chat-group-member-list').append(html);
        }

        $(".chat-group-member-list>.selectChannelItem").on('click', function () {
            $(".chat-group-member-list>.selectChannelItem").css('background-color', '');
            $(this).css('background-color', 'gray');
            let randomNum = Math.floor(Math.random() * chatColors.length);
            // Every click will change current talk target
            let name = $(this).find('div[class="selectChannelJid"]').html();
            let userName = $(this).find('div[class="selectChannelName"]').html();
            // Init currentChatTarget
            name = name.split('@')[0];
            currentChatTarget.roomName = name;
            currentChatTarget.roomType = 'chat';

            // let openfireUserList = await getOpenfireUserList();
            // Init topInfo of chatDetail
            let beforeColor = $('.chat-cont-alias').attr('class').split(' ')[1];
            $('.chat-cont-alias').html(name.substr(0, 1).toUpperCase()).removeClass(beforeColor).addClass(chatColors[randomNum]);
            $('.chat-cont-channel-name').html(userName);
            // $('.chat-cont-group-members').html(name + '@' + currentUser.domain);

            // init channel list
            // $('.cancel_create').click();
            // $('.chat_tab').children(":first").click();
            // If already exist in left panel
            let exist = chatMini.some(function (chat) {
                if (chat.roomName === name) {
                    // Default open the chat directly, need change the read status.
                    chat.read = true;
                    return true;
                }
            });
            if (exist) {
                // exist，remove to first one
                let _html = null;
                let childElements = $('.chatChannelList').children();
                for(let i = 0; i<childElements.length; i++){
                    let item = childElements[i];
                    if($(item).find('.chatChannelJid').html() === name) {
                        $(item).remove();
                        _html = item;
                    }
                }
                $('.chatChannelItem.active').removeClass('active');
                $('.chatChannelList').append(_html);
                $('.chatChannelItem:last').addClass('active');
                $('.chatChannelItem:last').find('.chatChannelIsRead').removeClass('unread').add('read');
            } else {
                // not exist, create and put it first
                // For select one color from colors

                // generate user icon
                let userIconHtml = '';
                if (currentChatTarget.roomType === 'chat') {
                    driverFriendList.some((friend) => {
                        if (friend.username === currentChatTarget.roomName && friend.icon) {
                            userIconHtml = `<img class="chat-user-icon-img" src="data:image/png;base64,${friend.icon}"/>`;
                            return true;
                        }
                    })
                }

                let chatChannelItem = `<div class="chatChannelItem">`;
                if (userIconHtml) chatChannelItem += userIconHtml;
                else chatChannelItem += `<div class="chatChannelAlias ${chatColors[randomNum]}">${name.substr(0,1).toUpperCase()}</div>`;
                chatChannelItem +=  `<div class="chatChannelName">${userName}</div>
                                    <div class="chatChannelJid" style="display: none;">${name}</div>
<!--                                        <div class="chatChannelLastMsg"></div>-->
<!--                                        <div class="chatChannelIsRead read"></div>-->
                                </div>`;
                $('.chatChannelList').append(chatChannelItem);
                $('.chatChannelItem.active').removeClass('active');
                $('.chatChannelItem:last').addClass('active');
                // console.log('add friend');

                chatMini.push({roomName: name, roomType: 'chat', read: true, lastMsg: ""});
                chatDetail.push({roomName: name, roomType: 'chat', roomMsg: []});
            }
            miniChatClickHandler(randomNum, {roomName: name, roomType: 'chat'});
        })


        // add room list
        $('.chat_rooms').empty();
        // let create room div
        let createRoomHtml = '';
        createRoomHtml += `<div class="create_new_room"><span class="iconfont icon-unie612" style="padding-right: 10px;"></span>New Room</div>`;
        $('.chat_rooms').append(createRoomHtml);
        $('.create_new_room').on('click', function () {
            $('.chat_rooms').hide();
            $('.createRoom').show();
        });


        rooms.forEach(function (room) {
            if (room.roomName) {
                // Add html
                let randomNum = Math.floor(Math.random()*(chatColors.length));
                let html = `<div class="selectChannelItem">
                        <div class="selectChannelAlias ${chatColors[randomNum]}">${room.roomName.substr(0,1).toUpperCase()}</div>
                        <div class="selectChannelName">${room.roomName}</div>
                        <div class="selectChannelJid" style="display: none">${room.roomName}</div>
                    </div>`;
                $('.chat_rooms').append(html);

                // Click event handler
                $(".chat_rooms>.selectChannelItem:last").on('click', async function () {
                    // Every click will change current talk target
                    let naturalName = $(this).find('div[class="selectChannelName"]').html();
                    let name = $(this).find('div[class="selectChannelJid"]').html();

                    // Init currentChatTarget
                    currentChatTarget.roomName = name;
                    currentChatTarget.roomType = 'groupChat';
                    // Init topInfo of chatDetail
                    let beforeColor = $('.chat-cont-alias').attr('class').split(' ')[1];
                    $('.chat-cont-alias').html(name.substr(0,1)).removeClass(beforeColor).addClass(chatColors[randomNum]);
                    $('.chat-cont-channel-name').html('Room-' + naturalName);
                    // $('.chat-cont-group-members').html(name + '@conference.' + currentUser.domain);
                    $('.chat-cont-group-members').html(`<label style="cursor: pointer;" class="view-members" onclick="showMemberHandler('${name}')"><u>View Member List</u></label>`);

                    // init channel list
                    $('.cancel_create').click();
                    $('.chat_tab').children(":first").click();
                    // If already exist in left panel ?
                    let exist = chatMini.some(function (chat) {
                        if (chat.roomName === name) {
                            // Default open the chat directly, need change the read status.
                            chat.read = true;
                            return true;
                        }
                    });
                    if (exist) {
                        // exist，remove to first one
                        let _html = null;
                        let childElements = $('.chatChannelList').children();
                        for(let i = 0; i < childElements.length; i++){
                            let item = childElements[i];
                            if($(item).find('.chatChannelJid').html() === name) {
                                $(item).remove();
                                _html = item;
                            }
                        }
                        $('.chatChannelItem.active').removeClass('active');
                        $('.chatChannelList').append(_html);
                        $('.chatChannelItem:last').addClass('active');
                        $('.chatChannelItem:last').find('.chatChannelIsRead').removeClass('unread').add('read');
                    } else {
                        // not exist, create and put it first
                        // For select one color from colors
                        let chatChannelItem = `<div class="chatChannelItem">
                                    <div class="chatChannelAlias ${chatColors[randomNum]}">${name.substr(0,1).toUpperCase()}</div>
                                    <div class="chatChannelName">${'Room-' + naturalName}</div>
                                    <div class="chatChannelJid" style="display: none;">${name}</div>
<!--                                    <div class="chatChannelLastMsg"></div>-->
<!--                                    <div class="chatChannelIsRead read}"></div>-->
                                </div>`;
                        $('.chatChannelList').append(chatChannelItem);
                        $('.chatChannelItem.active').removeClass('active');
                        $('.chatChannelItem:last').addClass('active');

                        chatMini.push({roomName: name, roomType: 'groupChat', read: true, lastMsg: ""});
                        chatDetail.push({roomName: name, roomType: 'groupChat', roomMsg: []});
                    }
                    miniChatClickHandler(randomNum, {roomName: name, roomType: 'groupChat'});
                });
            }
        });
    };

    if ($('.chatChannelList').css('display') === 'none') return;
    getAllRoomsAndFriendsByUser().then(() => {
        initPersonalAndRoomSelectChat();
    });
    $('.selectChannelList').show();

    $('.chat-messages').empty();
    $('.chat-cont-group-members').empty();
    $('.chat-cont-channel-name').empty();
    $('.chat-cont-alias').empty();
};

const initRoomListHandler = function () {

};

const initConvoyListHandler = function () {

};

const initChatHandler = function () {
    $('.chat-messages').empty();
    $('.chat-cont-alias').empty();
    $('.chat-cont-channel-name').empty();
    $('.chat-cont-group-members').empty();
    $('.input-search-chat').val(null);
    currentChatTarget.roomName = null;
    currentChatTarget.roomType = null;

    chatServer = Cookies.get('chatServer')
};

// ************* chat ui tool *****************

// init the send chat tab ui
const initChatConvoyAppointUI = function () {
    $('.chat-group-name').empty();
    $('.chat-group-member-list').empty();
    $('.chat-group-members').show();
    $('.chat-content').css('width', '60vw');
};

// clear the send chat tab ui
const clearChatConvoyAppointUI = function () {
    $('.chat-group-name').empty();
    $('.chat-group-member-list').empty();
    $('.chat-group-members').hide();

    $('.chat-content').css('width', '70vw');
};

const initLayUIHandler = function () {
    layui.use('upload', function() {
        let upload = layui.upload;
        // if already init, leave it
        if (uploadChatFile) return;
        uploadChatFile = upload.render({
            elem: '.chat-attachment',
            url: chatServer + '/uploadChatImages',
            auto: false, // must
            accept: 'file',
            multiple: true,
            choose: function(obj) {
                if(!currentChatTarget.roomName) {
                    popupInfo('Please select a friend for chatting!');
                    return false;
                }
                obj.preview(function(index, file, result) {
                    console.log(file);
                    if (isImg(file.name) && file.size > 5 * 1024 * 1024) {
                        popupInfo('Image file size should be < 5m !');
                        return;
                    }
                    layer.load(3, {shade: [0.6, '#000']});
                    obj.upload(index, file);
                    console.log('file: ', file);
                    console.log('upload file name: ', file.name);

                });
            },
            allDone: function(obj) {
                layer.closeAll('loading');
            },
            done: async function(obj) {
                layer.closeAll('loading');
                let file = obj.resp_msg[0];
                let fileName = file.substr(file.lastIndexOf('\\') + 1);
                console.log(fileName)
                if (isImg(fileName)) {
                    // images
                    let base64 = await getImgBase64(fileName);
                    createImgMsg(fileName, base64);//  result is base64 code
                } else {
                    // file
                    createFileMsg(fileName);
                }
            },
            error: function() {
                layer.closeAll('loading');
            }
        });
    });

    layui.use('element', function () {
        let element = layui.element;
        element.on('tab(chat)', function() {
            $('.chat_tab>li').css('color', 'white').css('background', 'rgba(0, 0, 0, 0)');
            $(this).css('color', '#F6BC13').css('background', 'rgba(0, 0, 0, 0.5)');
        });
    });

    layui.use('form', function () {
        let form = layui.form;
    });
};

const initChatEmoji = function () {
    let html = '';
    for (let i = 0; i < 72; i++) {
        if (i > 0 && i % 9 === 0) html += '<br>';
        let emojiIcon = null;
        if (i < 10) emojiIcon = 'f00' + i + '.png';
        else emojiIcon = 'f0' + i + '.png';
        html += `<img emoji="${emojiIcon.split('.')[0]}" class="emoji-icons" src="" data-src="./images/emoji/${emojiIcon}"/>`;
    }
    html += '<hr>';
    for (let i = 0; i < 36; i++) {
        if (i > 0 && i % 9 === 0) html += '<br>';
        let emojiIcon = null;
        if (i < 10) emojiIcon = 'g00' + i + '.gif';
        else emojiIcon = 'g0' + i + '.gif';
        html += `<img emoji="${emojiIcon.split('.')[0]}" class="emoji-icons" src="" data-src="./images/emoji/${emojiIcon}"/>`;
    }

    $('.emoji-icon-list').html(html);

    $('.emoji-icons').click(function () {
        if (!currentChatTarget.roomName) {
            popupInfo('Please select a friend for chatting');
            return;
        }

        let emoji = $(this).attr('emoji');
        $('.emoji-list').hide();
        // add into input chat
        $('.input-search-chat').val($('.input-search-chat').val() + '[/'+ emoji +']');
    })
};

// ***************** TOOL ******************
const sendMsgToSocket = function (from, to, roomType, msg, msgType, contentSize) {
    let msgObj = {fromName: from, roomName: to, content: msg, contentSize: msg.length, msgType, chatType: roomType, time: moment().format('YYYY-MM-DD HH:mm:ss')};

    if (msgType === 'soundData') {
        msgObj.contentSize = contentSize;
    }
    console.log('send -> ', msgObj);
    axios.post(chatServer + '/sendRoomMsgFromLaptop', msgObj).then((result) => {
        if (result.respCode === 1) {
            console.log('msg send success!');
        } else {
            console.warn('msg send failed!');
        }
    });

    let sendStatusHtml = ``;
    if (currentUser.sysConf.allowNotice) {
        sendStatusHtml = `<label class="send-status">
                                ${currentChatTarget.roomType === 'chat' ? `<img class="send-status-img" src="./images/chat/send_icon.png">` : '<img class="send-status-img" src="./images/chat/read_icon.png">'}
                              </label>`;
    }
    if (roomType === 'chat' || roomType === 'groupChat') {
        let chatMessages = `<div class="message-right">
                                <div class="message-label bold">${currentUser.name}</div>
                                <div class="message-text">${createEmojiMsg(msg)}</div>
                                <div class="message-icon right">${currentUser.name.substr(0, 1).toUpperCase()}</div>
                                <div class="message-time right">
                                    ${moment(msg.time).format('HH:mm')}
                                    ${sendStatusHtml}
                                </div>
                            </div>`;

        if (!$('.chat-messages').html()){
            $('.chat-messages').html(`<div class="message-spacer"></div>`);
        }
        $('.message-spacer').before(chatMessages);
        $('.chat-messages').stop().animate({scrollTop: $('.chat-messages')[0].scrollHeight}, 400);

    }
};
const renameFile2Short = function (fileName) {
    let lastPointIndex = fileName.lastIndexOf('.');
    if (lastPointIndex < 15) {
        return fileName;
    } else {
        return fileName.substr(0, 15) + '...';
    }

};

const downloadFile = function (fileName) {
    window.location = chatServer + '/upload/' + fileName;
};
const downloadImg = function (fileName) {
    window.open(chatServer + '/upload/' + fileName);
};

const playAudio = async function (el, audioName, leftOrRight, audioTime) {
    let base64Data = null;
    let ifGetAudio = await axios.post(chatServer + '/getAudioByName', { audioName })
        .then(function (resp) {
            if (resp.respCode === 1) {
                base64Data = resp.respMessage;
                return true;
            } else {
                popupInfo('Audio file not found!');
                return false;
            }
        });
    if (ifGetAudio) {
        // play audio here
        RongIMLib.RongIMVoice.play(base64Data);

        // take the img changed
        if (leftOrRight) {
            if (leftOrRight === 'right') {
                // msg from self
                $(el).css('background-image','url(./icons/audio-right.gif)');
                setTimeout(function () {
                    $(el).css('background-image','url(./icons/audio-right.svg)');
                }, audioTime * 1000 + 500);
            } else if (leftOrRight === 'left') {
                // msg from others
                $(el).css('background-image','url(./icons/audio-left.gif)');
                setTimeout(function () {
                    $(el).css('background-image','url(./icons/audio-left.svg)');
                }, audioTime * 1000 + 500);
            }
        }
    }
};

const openVideo = function (fromName) {
    let videoUrl = null;
    if (currentChatTarget.roomType === 'groupChat') {
        videoUrl = OrionGitServer + currentChatTarget.roomName.replace(/ /g, '');
    } else {
        if (fromName) {
            fromName = fromName.replace(/ /g, '');
            // from laptop and mobile
            videoUrl = OrionGitServer + fromName;
        } else {
            // from localhost
            videoUrl = OrionGitServer + currentUser.name;
        }
    }
    console.log('Open video: ', videoUrl);
    window.open (videoUrl, "video", "height=500, width=600, top=0, left=0, toolbar=no, menubar=no, scrollbars=no, resizable=no,location=no, status=no")
};

// ************* create msg html ******************

function createMsg() {
    let sourceMsg = $('.input-search-chat').val();
    // Send msg out by socket.io
    sendMsgToSocket(currentUser.name, currentChatTarget.roomName, currentChatTarget.roomType, sourceMsg, 'text');
    $('.input-search-chat').val('');
}

function createEmojiMsg(msg) {
    let $images0 = [];
    while (msg.indexOf('[/g0') > -1) {
        let img = msg.indexOf('[/g0');
        $images0.push(msg.substr(img + 2, 4));
        msg = msg.replace(msg.substr(img, 7), '$emoji$');
    }
    $images0.forEach(function (image) {
        msg = msg.replace('$emoji$', `<img emoji="${image}" class="emoji-icons" src="./images/emoji/${image}.gif"/>`)
    });
    let $images1 = [];
    while (msg.indexOf('[/f0') > -1) {
        let img = msg.indexOf('[/f0');
        $images1.push(msg.substr(img + 2, 4));
        msg = msg.replace(msg.substr(img, 7), '$emoji$');
    }
    $images1.forEach(function (image) {
        msg = msg.replace('$emoji$', `<img emoji="${image}" class="emoji-icons" src="./images/emoji/${image}.png"/>`)
    });
    return msg;
}

function createImgMsg(fileName, base64Data) {
    let date = new Date();

    $(".message-spacer").remove();

    // Send msg out by socket.io
    sendMsgToSocket(currentUser.name, currentChatTarget.roomName, currentChatTarget.roomType, fileName + ":::" + base64Data, 'imgData');
}

function createFileMsg(fileName) {
    let date = new Date();

    $(".message-spacer").remove();

    // Send msg out by socket.io
    sendMsgToSocket(currentUser.name, currentChatTarget.roomName, currentChatTarget.roomType, '[/file0#' + fileName, 'text');
}

const createAudioMsg = async function (base64Data, duration) {
    let date = new Date();
    let fileName = 'tmp_sound_' + date.getTime() + '.amr';
    let audioTimeCost = duration;

    console.log(duration)
    console.log(audioTimeCost)

    // Store into file
    let uploadSuccess = await uploadAmrBase64(fileName, base64Data);
    if (!uploadSuccess) {
        popupInfo('Audio file upload fail, please try again.');
        return;
    }

    // Send msg out by socket.io
    sendMsgToSocket(currentUser.name, currentChatTarget.roomName, currentChatTarget.roomType, fileName, 'soundData', audioTimeCost);
};

// ***************** HTTP ******************

const getUnReceivedMsgRequest = function () {

};

const getAllRoomsAndFriendsByUser = function () {
    return axios.post(chatServer + '/getRoomListAndFriendList', {
        userId: userId
    }).then(function (response) {
        if(response.respCode === 1) {
            rooms = response.respMessage.roomList;
            hqFriendList = response.respMessage.hqFriendList;
            unitFriendList = response.respMessage.unitFriendList;
            driverFriendList = response.respMessage.driverFriendList;
            return rooms;
        }
    })
};

const initUnitList = function () {
    return axios.post('/getUnitList', {})
        .then(function (res) {
            if (res.respCode === 1) {
                unitList = res.respMessage;
            }
        });
};

const setMsgReceived = function () {

};

const sendMsg = function () {

};

const getLastMessage = function (roomName, roomType, messageId) {
    return axios.post(chatServer + '/getLastChatMsgByRoomName', {roomName, roomType, messageId, userName: currentUser.name})
        .then(function (res) {
            if (res.respCode === 1) {
                return res.respMessage;
            } else {
                alert('Something is wrong, please try again!');
                return [];
            }
        });
}

const getUserByUserIDRequest = function (userId) {
    return axios.post('getLoginUserById', { userId })
        .then(function (response) {
            if(response.respCode === 1) {
                return response.respMessage;
            } else if (response.respCode === -100) {
                window.location.reload();
            } else {
                alert('User does not exist!');
                return null;
            }
        })
};

const getAllHistoryMsgByUser = function () {
    if (chatRobot) {
        chatMini = [{roomName: 'AskSally', roomType: 'robot', lastMsg: ''}];
        chatDetail = [{roomName: 'AskSally', roomType: 'robot', roomMsg: [], unreadFlag: null}];
    } else {
        chatMini = [];
        chatDetail = [];
    }

    // init chatMini and chatDetail
    // return axios.post(chatServer + '/getAllChatMsgByUserJid', {userID: currentUser.id})
    //     .then(function (response) {
    //         if(response.respCode === 1) {
    //             let roomList = response.respMessage;
    //             if (roomList && roomList.length > 0) {
    //                 for (let room of roomList) {
    //                     chatMini.push({roomName: room.roomName, read: false,
    //                         lastMsg: room.roomMsg.length > 0 ? room.roomMsg[room.roomMsg.length - 1] : '', roomType: room.roomType});
    //                     chatDetail.push({roomName: room.roomName, roomType: room.roomType, roomMsg:room.roomMsg, unreadFlag: room.unreadFlag});
    //                 }
    //                 // console.log(chatMini);
    //             }
    //         }
    //     })
};

// const getAllChatMsgUnReceivedByUserJid = function () {
//     return axios.post(chatServer + '/getAllChatMsgUnReceivedByUserJid', {userID: currentUser.id})
//         .then(async function (response) {
//             if(response.respCode === 1) {
//                 let roomList = response.respMessage.result;
//                 for (let dbRoom of roomList) {
//                     if (!dbRoom.roomMsg.length) continue;
//                     // TODO: update last message if find, else add it in
//                     let ifExist = chatMini.some((mini) => {
//                         if (dbRoom.roomName === mini.roomName) {
//                             // if exist, update
//                             mini.lastMsg = dbRoom.roomMsg[dbRoom.roomMsg.length - 1];
//                             for (let detail of chatDetail) {
//                                 if (detail.roomName === mini.roomName) {
//                                     detail.roomMsg = detail.roomMsg.concat(dbRoom.roomMsg);
//                                 }
//                             }
//                             // refresh left panel
//                             $('.chatChannelItem').each(function () {
//                                 let channelName = $(this).find('.chatChannelName').html().toLowerCase().replace('room - ', '').replace(/ /g, '_');
//                                 // console.log('*********** ', channelName);
//                                 if (channelName === mini.roomName) {
//                                     $(this).find('.chatChannelLastMsg').html(mini.lastMsg.content.substr(0,6) + '...');
//
//                                     // refresh right panel if active
//                                     if ($(this).hasClass('active')) {
//                                         console.log('chat is opened!');
//                                         // $(this).click();
//                                     } else {
//                                         let unreadMsgNum = $(this).find('.chatChannelIsRead').html();
//                                         unreadMsgNum = unreadMsgNum ? unreadMsgNum : 0;
//                                         unreadMsgNum = Number.parseInt(unreadMsgNum) + dbRoom.roomMsg.length;
//                                         if (unreadMsgNum) {
//                                             console.log('add unreadMsgNum');
//                                             if ($(this).find('.chatChannelIsRead').length) {
//                                                 $(this).find('.chatChannelIsRead').html(unreadMsgNum).removeClass('read').addClass('unread');
//                                             } else {
//                                                 $(this).append(`<div class="chatChannelIsRead unread">${unreadMsgNum}</div>`);
//                                             }
//                                         }
//                                     }
//                                 }
//                             });
//                             return true;
//                         }
//                     });
//                     // if does not exist
//                     if (!ifExist) {
//                         // let openfireUserList = await getOpenfireUserList();
//                         let roomList = await getAllRoomsAndFriendsByUser();
//                         let randomNum = Math.floor(Math.random() * chatColors.length);
//                         // add into chatMini
//                         chatMini.push({roomName: dbRoom.roomName, read: false,
//                             lastMsg: dbRoom.roomMsg.length > 0 ? dbRoom.roomMsg[dbRoom.roomMsg.length - 1] : '', roomType: dbRoom.roomType});
//                         // add into chatDetail
//                         chatDetail.push({roomName: dbRoom.roomName, roomType: dbRoom.roomType, roomMsg:dbRoom.roomMsg, unreadFlag: dbRoom.unreadFlag});
//
//                         let unreadMsgNum = 0;
//                         chatDetail.find((detail) => {
//                             if (detail.roomName === dbRoom.roomName) {
//                                 detail.roomMsg.forEach((msg) => {
//                                     if (msg.isRead === 0) unreadMsgNum++;
//                                 })
//                             }
//                         });
//
//                         // generate user icon
//                         let userIconHtml = '';
//                         if (dbRoom.roomType === 'chat') {
//                             friends.some((friend) => {
//                                 if (friend.jid === dbRoom.roomName && friend.icon) {
//                                     userIconHtml = `<img class="chat-user-icon-img" src="data:image/png;base64,${friend.icon}"/>`;
//                                     return true;
//                                 }
//                             })
//                         }
//
//                         // show it on left panel
//                         let chatChannelItem = `<div class="chatChannelItem">`;
//                         if (userIconHtml) chatChannelItem += userIconHtml;
//                         else chatChannelItem += `<div class="chatChannelAlias ${chatColors[randomNum]}">${dbRoom.roomName.substr(0,1).toUpperCase()}</div>`;
//                         chatChannelItem += `<div class="chatChannelName">${dbRoom.roomType === 'chat' ? getUserName(openfireUserList ,dbRoom.roomName) : 'Room - ' + getRoomName(roomList, dbRoom.roomName)}</div>
//                                             <div class="chatChannelJid" style="display: none;">${dbRoom.roomName}</div>
// <!--                                            <div class="chatChannelLastMsg"></div>-->
// <!--                                            <div class="chatChannelIsRead unread">${unreadMsgNum}</div>-->
//                                         </div>`;
//                         $('.chatChannelList').prepend(chatChannelItem);
//                         miniChatClickHandler(randomNum, {roomName: dbRoom.roomName, roomType: dbRoom.roomType});
//
//                         for (let mini of chatMini) {
//                             if (mini.roomName === dbRoom.roomName) {
//                                 mini.lascreateMobileUsertMsg = dbRoom.roomMsg[dbRoom.roomMsg.length - 1];
//                                 $('.chatChannelJid').each(function () {
//                                     if ($(this).html() === dbRoom.roomName) {
//                                         $(this).next().html(mini.lastMsg.content.substr(0, 6) + '...');
//                                     }
//                                 });
//                             }
//                         }
//                     }
//                 }
//
//                 // overwrite unread flag
//                 let unreadFlagList = response.respMessage.unreadFlag;
//
//                 for (let dbRoom of unreadFlagList) {
//                     if (!dbRoom.unreadFlag) continue;
//                     for (let detail of chatDetail) {
//                         if (detail.roomType !== 'groupChat') continue;
//                         if (detail.roomName === dbRoom.roomName) {
//                             // console.log('Start overwrite unread flag!');
//                             detail.unreadFlag = dbRoom.unreadFlag;
//                             // TODO: refresh right panel if opened
//                             // if ($('.chatChannelItem.active').find('.chatChannelJid').html() === detail.roomName) {
//                             //     $('.chatChannelItem.active').click();
//                             // }
//                         }
//                     }
//                 }
//
//                 $('.chatChannelItem.active').click();
//
//                 // // update unread flag
//                 // if (chat.unreadFlag) {
//                 //     let exist = chat.unreadFlag.some((flag) => {
//                 //         if (flag.toJid === info.targetUserId) {
//                 //             flag.msgId = info.msgId;
//                 //             return true;
//                 //         }
//                 //     });
//                 //     if (!exist) {
//                 //         chat.unreadFlag.push({msgId: info.msgId, toJid: info.targetUserId, isRead: 0});
//                 //     }
//                 // } else {
//                 //     // While unreadFlag is undefined
//                 //     chat.unreadFlag = [];
//                 //     chat.unreadFlag.push({msgId: info.msgId, toJid: info.targetUserId, isRead: 0});
//                 // }
//             }
//         });
// };

const getAllChatMsgByUserID = function () {
    return axios.post(chatServer + '/getAllChatMsgByUserID', { userId: userId })
        .then(async (response) => {
            if(response.respCode === 1) {
                let roomList = response.respMessage;
                // console.warn(roomList);
                roomList = sortRoomList(roomList)
                sortSingleMiniChat()
                for (let room of roomList) {
                    let ifExist = chatMini.some(mini => {
                        if (room.roomName === mini.roomName && mini.roomType !== 'robot') {
                            // if exist, update
                            mini.lastMsg = room.content;
                            for (let detail of chatDetail) {
                                if (detail.roomName === mini.roomName) {
                                    // old message will add new message
                                    for (let index = 0; index < room.msgList.length; index++) {
                                        let alreadyExist = detail.roomMsg.some(m => {
                                            if (room.msgList[index].msgId === m.msgId) {
                                                m.received = room.msgList[index].received;
                                                return true;
                                            }
                                        })
                                        if (!alreadyExist) {
                                            console.log('before contact ');
                                            console.log(detail.roomMsg);
                                            console.log(room.msgList.slice(index));
                                            detail.roomMsg = detail.roomMsg.concat(room.msgList.slice(index));
                                            console.log('after contact ');
                                            console.log(detail.roomMsg);
                                            break;
                                        }
                                    }

                                }
                            }
                            // refresh left panel
                            $('.chatChannelItem').each(function () {
                                let channelName = $(this).find('.chatChannelName').html().toLowerCase().replace('room - ', '');
                                if (channelName === mini.roomName.toLowerCase()) {
                                    $(this).find('.chatChannelLastMsg').html(mini.lastMsg.substr(0,6) + '...');

                                    // refresh right panel if active
                                    if ($(this).hasClass('active')) {
                                        console.log('chat is opened!');
                                        $(this).click();
                                    } else {
                                        // let unreadMsgNum = $(this).find('.chatChannelIsRead').html();
                                        // unreadMsgNum = unreadMsgNum ? unreadMsgNum : 0;
                                        // unreadMsgNum = Number.parseInt(unreadMsgNum) + dbRoom.roomMsg.length;
                                        // if (unreadMsgNum) {
                                        //     console.log('add unreadMsgNum');
                                        //     if ($(this).find('.chatChannelIsRead').length) {
                                        //         $(this).find('.chatChannelIsRead').html(unreadMsgNum).removeClass('read').addClass('unread');
                                        //     } else {
                                        //         $(this).append(`<div class="chatChannelIsRead unread">${unreadMsgNum}</div>`);
                                        //     }
                                        // }
                                    }
                                }
                            });
                            return true;
                        }
                    });
                    if (!ifExist) {
                        let roomList = await getAllRoomsAndFriendsByUser();
                        let randomNum = Math.floor(Math.random() * chatColors.length);
                        // add into chatMini
                        chatMini.push({roomName: room.roomName, read: false,
                            lastMsg: room.content, lastMsgTime: room.msgTime, roomType: room.roomType});
                        // add into chatDetail
                        chatDetail.push({roomName: room.roomName, roomType: room.roomType, roomMsg:room.msgList, unreadFlag:null});

                        // let unreadMsgNum = 0;
                        // chatDetail.find((detail) => {
                        //     if (detail.roomName === dbRoom.roomName) {
                        //         detail.roomMsg.forEach((msg) => {
                        //             if (msg.isRead === 0) unreadMsgNum++;
                        //         })
                        //     }
                        // });

                        // generate user icon
                        let userIconHtml = '';
                        if (room.roomType === 'chat') {
                            friends.some((friend) => {
                                if (friend.userName === room.roomName && friend.icon) {
                                    userIconHtml = `<img class="chat-user-icon-img" src="data:image/png;base64,${friend.icon}"/>`;
                                    return true;
                                }
                            })
                        }

                        // show it on left panel
                        let chatChannelItem = `<div class="chatChannelItem">`;
                        if (userIconHtml) chatChannelItem += userIconHtml;
                        else chatChannelItem += `<div class="chatChannelAlias ${chatColors[randomNum]}">${room.roomName.substr(0,1).toUpperCase()}</div>`;
                        chatChannelItem += `<div class="chatChannelName">${room.roomType === 'chat' ? room.roomName : 'Room - ' + room.roomName}</div>
                                            <div class="chatChannelJid" style="display: none;">${room.roomName}</div>
<!--                                            <div class="chatChannelLastMsg"></div>-->
<!--                                            <div class="chatChannelIsRead unread" style="display: none;">${0}</div>-->
                                        </div>`;
                        $('.chatChannelList').append(chatChannelItem);
                        if (room.roomType !== 'robot') {
                            miniChatClickHandler(randomNum, {roomName: room.roomName, roomType: room.roomType});
                        }

                        for (let mini of chatMini) {
                            if (mini.roomName === room.roomName) {
                                // mini.lascreateMobileUsertMsg = dbRoom.roomMsg[dbRoom.roomMsg.length - 1];
                                $('.chatChannelJid').each(function () {
                                    if ($(this).html() === room.roomName) {
                                        $(this).next().html(mini.lastMsg.substr(0, 6) + '...');
                                    }
                                });
                            }
                        }
                    }
                }
            }
            else if (response.respCode === -100) {
                getAllChatMsgByUserID();
            }
            else {
                console.warn('Server error!');
            }
        })
        .then(() => {
            // initSingleMiniChat();
            if (currentChatTarget.roomType !== 'robot') {
                $('.chatChannelItem.active').click();
            }
        })
};

const getImgBase64 = async function (imgName) {
    return await axios.post(chatServer + '/getImgByName', { imgName })
        .then(function (resp) {
            if (resp.respCode === 1) {
                return resp.respMessage;
            } else {
                popupInfo('File not found!');
                return null;
            }
        });
};

const uploadAmrBase64 = async function (fileName, base64Data) {
    return await axios.post(chatServer + '/uploadAudio', { fileName, base64Data })
        .then(function (resp) {
            if (resp.respCode === 1) {
                return true;
            } else {
                popupInfo('File not found!');
                return false;
            }
        });
};
