const express = require("express");
const router = express.Router();
const checkLogin = require('../controller/checkLogin')
const three = require('../controller/three')
const cashback = require('../controller/cashback')
const saveData = require('../controller/saveData')
router.get('/check',checkLogin.crawlDataExness)
router.post('/api-test-save', saveData.saveData)
router.get('/three',three.crawlDataThreeTrader)
router.get('/cashback',cashback.crawlCashback)

module.exports = router