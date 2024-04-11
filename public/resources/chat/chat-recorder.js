let rec, _blob, _duration;
$(() => {
	setTimeout(function () {
		recOpen();
	}, 1000);
});
 
let audioStartTime = null;
let audioCostTime = null;
const openAudio = function () {
	if (!audioStartTime) {
		$('.recording').show();
		recStart();
		audioStartTime = moment().valueOf();
	} else {
		$('.recording').hide();
		recStop();
		audioCostTime = Math.ceil((moment().valueOf() - audioStartTime) / 1000) + 1;
		audioStartTime = null;
	}
};
 
const recOpen = function () {
	rec = Recorder({
		type: "amr",
		sampleRate: 16000,
		bitRate: 16,
		onProcess: function (buffers, powerLevel, bufferDuration, bufferSampleRate) {}
	});
	console.log('Open recording, request mic access...');
	rec.open(function () {
		console.log("Can recording now.");
	}, function (msg, isUserNotAllow) {
		console.log(msg);
		console.log(isUserNotAllow);
		console.log((isUserNotAllow ? "UserNotAllow!" : "") + "can not recording.");
	});
};
const recStart = function (){
	_blob = null;
	_duration = null
	rec.start();
};
const recStop = function (){
	rec.stop(function(blob, duration){
		_blob = blob;
		_duration = duration;
		// rec.close();
		
	}, function(msg) {
		console.log("Recording failed.");
		// rec.close();
	});
};
const recSend = function (callBack) {
	if (!_blob) {
		callBack(null, null)
		return;
	} else {
		recDown64({ blob: _blob, set: $.extend({}, rec.set), time: _duration }, function (base64Data) {
			// send audio to xmpp
			callBack(base64Data, _duration)
		});
	}
}

const recDown = function (obj){
	let o = obj;
	if(o){
		let name = "rec-" + new Date().getTime() + "." + o.set.type;
		var downA=document.createElement("A");
		downA.innerHTML="DownLoad "+name;
		downA.href=(window.URL||webkitURL).createObjectURL(o.blob);
		downA.download=name;
		downA.click();
	}
};
const recDown64 = function (obj, callBack){
	let o = obj;
	let reader = new FileReader();
	reader.onloadend = function() {
		// send msg to openfire
		console.log(reader.result.substr(0,100));
		callBack(reader.result.replace('data:audio/amr;base64,', ''));
	};
	reader.readAsDataURL(o.blob);
};

// const playAudio = async function (el, audioName, leftOrRight, audioTime = 1) {
// 	debugger
//     let ifGetAudio = await axios.post('/chat/getAudioByName', { audioName })
//         .then(function (resp) {
//             if (resp.data.code === 1) {
//                 // play audio here
// 				// console.log(resp.data.data);
				
// 				if (audioName === '1.amr') {
// 					console.log(11111111111111);
// 					RongIMLib.RongIMVoice.play(a, audioTime);
// 				}
// 				else {
// 					console.log(22222222222222);
// 					RongIMLib.RongIMVoice.play(b, audioTime);
// 				}

// 				// take the img changed
// 				if (leftOrRight) {
// 					if (leftOrRight === 'right') {
// 						// msg from self
// 						$(el).css('background-image','url(../chat/recorder/audio-right.gif)');
// 						setTimeout(function () {
// 							$(el).css('background-image','url(../chat/recorder/audio-right.svg)');
// 						}, audioTime * 1000 + 500);
// 					} else if (leftOrRight === 'left') {
// 						// msg from others
// 						$(el).css('background-image','url(../chat/recorder/audio-left.gif)');
// 						setTimeout(function () {
// 							$(el).css('background-image','url(../chat/recorder/audio-left.svg)');
// 						}, audioTime * 1000 + 500);
// 					}
// 				}
//             } else {
//                 $.alert('Audio file not found!');
//                 return false;
//             }
//         });

// 	if (ifGetAudio) {
		
// 	}
	
// };

let amr = null;
const playAudio = async function (el, audioName, leftOrRight, audioTime = 1) { 
	amr = new BenzAMRRecorder();
	amr.initWithUrl(`${ chatServer }/chat/upload/${ audioName }`).then(function() {
		amr.play();
		if (leftOrRight) {
			if (leftOrRight === 'right') {
				// msg from self
				$(el).css('background-image','url(../chat/recorder/audio-right-blue32.gif)');
				setTimeout(function () {
					$(el).css('background-image','url(../chat/recorder/audio-right.svg)');
				}, audioTime * 1000 + 500);
			} else if (leftOrRight === 'left') {
				// msg from others
				$(el).css('background-image','url(../chat/recorder/audio-left-gray32.gif)');
				setTimeout(function () {
					$(el).css('background-image','url(../chat/recorder/audio-left.svg)');
				}, audioTime * 1000 + 500);
			}
		}
	});
	amr.onEnded(function() {
		console.log('finish')
	})
}
