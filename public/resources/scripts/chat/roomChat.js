$(document).ready(() => {
    $('.content-close-room-member').click(clearRoomMemberPage);
});

const showMemberHandler = async function (roomName) {
    const initRoomMemberPage = function (memberList, userList) {
        let hqMembersDiv = `<div class="chat-room-hq">
                                <div style="line-height: 20px;text-align: center;background-color: gray;"><label style="color: white;font-weight: bolder;">HQ</label></div>
                             </div>`;
        let mobileMembersDiv = `<div class="chat-room-mobile">
                                <div style="line-height: 20px;text-align: center;background-color: gray;"><label style="color: white;font-weight: bolder;">Convoy</label></div>
                             </div>`;
        $('.content-view-members .edit-room-members').append(hqMembersDiv).append(mobileMembersDiv);

        for (let user of userList) {
            let html = ``;
            let randomNum = Math.floor(Math.random() * chatColors.length);
            let ifRoomMember = checkIfRoomMember(user.userName, memberList);
            // let ifRoomOwner = checkIfRoomOwner(user.userName, memberList);

            // generate user icon
            let userIconHtml = '';
            if (user.icon) {
                userIconHtml = `<img class="chat-detail-user-icon-img" src="data:image/png;base64,${user.icon}"/>`;
            }

            html += `<div class="selectChannelItem" style="padding: 0px 20px;">`;
            if (userIconHtml) {
                html += userIconHtml;
            } else {
                html += `<div class="selectChannelAlias ${chatColors[randomNum]}">${user.userName.substr(0,1).toUpperCase()}</div>`;
            }
            html += `<div class="selectChannelName" style="">${user.userName}</div>
                                <div class="selectChannelJid" style="color: white;display: none;">${user.userName}</div>
                                <div class="selectChannelID" style="color: white;display: none;">${user.friendID}</div>
                                <div class="selectChannelMember layui-unselect layui-form-checkbox ${ifRoomMember ? 'layui-form-checked' : ''} " lay-skin="primary" style="margin: 16px;float: right;"><i class="layui-icon layui-icon-ok"></i></div>
                            </div>`;
            if (user.type !== CONTENT.USER_TYPE.MOBILE) {
                $('.content-view-members .edit-room-members .chat-room-hq').append(html);
                // member select event handler
                $('.edit-room-members>.chat-room-hq>.selectChannelItem:last').find('div[class*="selectChannelMember"]').click(function () {
                    if($(this).hasClass('layui-form-checked')) {
                        $(this).removeClass('layui-form-checked');
                    }else {
                        $(this).addClass('layui-form-checked');
                    }
                });
            } else {
                $('.content-view-members .edit-room-members .chat-room-mobile').append(html);
                $('.edit-room-members>.chat-room-mobile>.selectChannelItem:last').find('div[class*="selectChannelMember"]').click(function () {
                    if($(this).hasClass('layui-form-checked')) {
                        $(this).removeClass('layui-form-checked');
                    }else {
                        $(this).addClass('layui-form-checked');
                    }
                });
            }
        }
    };

    layer.load(3, {shade: [0.6, '#000']});
    console.warn('showMemberHandler! ', roomName);
    // TODO: check the memberList result
    let memberList = await getRoomMemberRequest(roomName);
    if (!memberList.length) {
        popupInfo('Get room members failed, please try again!');
        layer.closeAll('loading');
        return;
    } else {
        console.log(memberList);
    }
    // TODO: check openfire userList result
    // let userList = await getOpenfireUserList();
    // if (!userList.length) {
    //     popupInfo('Get users failed, please try again!');
    //     return;
    // }
    initRoomMemberPage(memberList, friends);
    layer.closeAll('loading');

    $('.content-view-members .room-name').html(roomName);
    $('.content-view-members').show();
};
const updateRoomMemberHandler = async function () {
    console.log('update room handler!');
    let members = [];
    let owner = null;
    let selectedEl = $('.edit-room-members').find('div[class*="layui-form-checked"]');
    for (let i = 0; i < selectedEl.length; i++) {
        let nameEl = $(selectedEl[i]).prev();
        let member = nameEl.html().toString().trim();
        // TODO: check room owner
        if ($(selectedEl[i]).hasClass('room-owner')) {
            owner = member;
        } else {
            members.push(member);
        }
    }
    if (!members.length) {
        popupInfo('At lease one member selected(Update).');
        return;
    }
    members.push(currentUser.id);
    console.log(members);
    let roomName = $('.room-name').html();
    // console.warn('showMemberHandler! ', roomName);
    // // TODO: check the memberList to find out who is new member!
    // let oldMemberList = await getRoomMemberRequest(roomName);
    // let addedMemberList = [];
    // for (let newMember of members) {
    //     let ifExist = oldMemberList.some((member) => {
    //         return newMember.startsWith(member.member_jid);
    //     });
    //     if (!ifExist) {
    //         addedMemberList.push(newMember);
    //     }
    // }
    // let deletedMemberList = [];
    // for (let oldMember of oldMemberList) {
    //     let ifExist = members.some((member) => {
    //         return member.startsWith(oldMember.member_jid);
    //     });
    //     if (!ifExist) {
    //         deletedMemberList.push(oldMember.member_jid + '@' + currentUser.domain);
    //     }
    // }

    updateRoomMemberRequest(members, roomName).then((result) => {
        if (result) {
            popupInfo('Edit room success!');
            clearRoomMemberPage();
        } else {
            popupInfo('Edit room failed!');
        }
    });
};
const clearRoomMemberPage = function () {
    $('.content-view-members .room-name').empty();
    $('.content-view-members .edit-room-members').empty();
    $('.content-view-members').hide();
};

const checkIfRoomMember = function (openfireUsername, memberList) {
    return memberList.some((member) => {
        if (member.userName === openfireUsername) return true;
    });
};
// const checkIfRoomOwner = function (openfireUsername, memberList) {
//     return memberList.some((member) => {
//         if (member.creator_jid === openfireUsername) return true;
//     });
// };
const getRoomMemberRequest = function (roomName) {
    return axios.post(ChatServer + '/getAllMembersByRoomName', { roomName }).then((result) => {
        if (result.data.respCode === 1) {
            return result.data.resp_msg;
        } else {
            return [];
        }
    });
};
const updateRoomMemberRequest = function (members, roomName) {
    return axios.post(ChatServer + '/updateRoom', { roomName, members}).then((result) => {
        return result.data.respCode === 1
    });
};

const showFriendDetail = async function (userJid) {
    let el = $('.unread-friend-circle[userid=\''+ userJid +'\']');
    let val = $(el).html();
    if (val.length > 1) {
        $(el).html(userJid.substr(0, 1).toUpperCase());
    } else {
        let userList = await getOpenfireUserList();
        $(el).html(getUserName(userList, userJid.split('@')[0]));
    }
};