let html5QrCode = null;
$(async function(){
    initBoxSelect();
    let config = {
        fps: 20,
        qrbox: qrboxFunction,
        aspectRatio: 1
    };

    html5QrCode = new Html5Qrcode("scan-tool-div", { formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ] });

    // If you want to prefer front camera  {facingMode: "user"}
    html5QrCode.start({facingMode: "environment"}, config, onScanSuccess);
});

const initBoxSelect = async function () {
    await axios.post('/vehicle/getSupportSiteList').then(res => {
        if (res.data.respCode === 1) {
            let siteList = res.data.respMessage.siteList;

            $("#box-site-select").empty();
            let optHtml = ``;
            if (siteList?.length > 0) {
                for (let temp of siteList) {
                    optHtml += `<option value="${temp.siteId}">${temp.boxName}</option>`;
                }
                $("#box-site-select").append(optHtml);
            }
        } else {
            simpleAlert(res.data.respMessage)
        }
    });
}

const onScanSuccess = async function(decodedText, decodedResult) {
    html5QrCode.pause(false);
    // Handle the scanned code as you like, for example:
    console.log(`Code matched = ${decodedText}`, decodedResult);

    let selectSiteId = $("#box-site-select option:checked").val();

    if (!selectSiteId) {
        simpleAlert("Please select a box first");
        html5QrCode.resume();
        return;
    }

    await axios.post("/vehicle/parseKeyBoxQRCode", {siteId: selectSiteId, decodedText, decodedResult}).then(async res => {
        if (res.data.respCode == 0) {
            $.confirm({
                title: 'Info',
                content: res.data.respMessage,
                buttons: {
                    confirm: {
                        btnClass: 'btn-green',
                        action: function () {
                            html5QrCode.resume();
                        }
                    }
                }
            });
        } else {
            $.confirm({
                title: 'Info',
                content: 'Scan Successful.',
                buttons: {
                    confirm: {
                        btnClass: 'btn-green',
                        action: function () {
                            html5QrCode.resume();
                        }
                    }
                }
            });
        }
    })
}

const qrboxFunction = function(viewfinderWidth, viewfinderHeight) {
    return {
        width: viewfinderWidth * 0.95,
        height: viewfinderHeight * 0.95
    };
}

const backToScan = function() {
    if (html5QrCode) {
        $(".scan-div").show();
        $(".keyperss-info").hide();
        html5QrCode.resume();
    }
}

const addKeyRecord = function() {
    window.location.href='/addKeyOptRecord';
}