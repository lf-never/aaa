
$(function () {
    initAxiosHandler();
});

export function getUrlParam (name) {
    let reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
    let r = reg.exec(window.location.search.substring(1));
    if (r != null) {
        return decodeURI(r[2]);
    }
    return null;
}

export function initAxiosHandler () {
    axios.interceptors.request.use(config => {
        return config;
    }, error => {
        return Promise.reject(error);
    })
    axios.interceptors.response.use(response => {
        if (response.data.respCode === -100) {
            console.log('Token is invalid!');
            window.location = '../../login'
        } else {
            // console.log(response.data)
            return response;
        }
    }, error => {
        return Promise.reject(error);
    });
    window.axios = axios;
}
