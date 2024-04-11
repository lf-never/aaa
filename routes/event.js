const express = require('express');
const router = express.Router();
require('express-async-errors');

const conf = require('../conf/conf');
const utils = require('../util/utils');

const userService = require('../services/userService');
const offenceService = require('../services/offenceService');

router.get('/landing', (req, res) => {
    res.render('transport/landing', { title: 'Mobius Landing' });
});

router.get('/', async (req, res) => {
    let pageList = await userService.getUserPageList(req.cookies.userId)

    utils.generateMapCookie(pageList, res)

    res.cookie('userLocalMapTile', conf.Use_Local_MapTile, { expires: utils.expiresCookieDate() });
    res.render('transport/event', { title: 'Mobius Event' });
});

// router.post('/getEventDashboardInfo', offenceService.getEventDashboardInfo);
// router.post('/getEventHistory', offenceService.getEventHistory);
// router.post('/getEventLatestSpeedInfo', offenceService.getEventLatestSpeedInfo);

module.exports = router;
