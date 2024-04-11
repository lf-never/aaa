const log = require('../log/winston').logger('Child Process');
const moment = require('moment');

process.on('message', processParams => {
    log.info(`Message from parent (${moment().format('YYYY-MM-DD HH:mm:ss')}): `, processParams)
    try {
        let index = 0;
        while (index < 5000) {
            console.log(index);
            index++;
        }
        process.send({ success: true })
    } catch (error) {
        log.error(error);
        process.send({ success: false, error })
    }
})