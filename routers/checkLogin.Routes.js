const express = require("express");
const router = express.Router();
const checkLogin = require('../controller/checkLogin')
const three = require('../controller/three')
const cashback = require('../controller/cashback')
const saveData = require('../controller/saveData')
const fxgt = require('../controller/fxgt')
router.get('/check',checkLogin.crawlDataExness)
router.post('/api-test-save', saveData.saveData)
router.get('/three',three.crawlDataThreeTrader)
router.get('/cashback',cashback.crawlCashback)
router.get('/fxgt', fxgt.crawlFxgt)

module.exports = router