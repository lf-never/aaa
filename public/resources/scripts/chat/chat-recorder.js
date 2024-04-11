let rec;
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
		onProcess: function (buffers,powerLevel,bufferDuration,bufferSampleRate) {}
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
	rec.start();
};
const recStop = function (){
	rec.stop(function(blob, duration){
		// rec.close();
		recDown64({blob: blob, set: $.extend({}, rec.set), time: duration}, function (base64Data) {
			// send audio to xmpp
			createAudioMsg(base64Data, duration);
		});
	}, function(msg){
		console.log("Recording failed.");
		// rec.close();
	});
};
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