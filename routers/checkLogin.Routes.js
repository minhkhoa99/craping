const express = require("express");
const router = express.Router();
const checkLogin = require('../controller/checkLogin')
const three = require('../controller/three')
const saveData = require('../controller/saveData')
router.get('/check',checkLogin.crawExnesstradePro)
router.post('/api-test-save', saveData.saveData)
router.get('/three',three.crawlDataThreeTrader)
module.exports = router