const express = require("express");
const router = express.Router();
const checkLogin = require('../controller/checkLogin')
router.get('/check',checkLogin.crawExnesstradePro)
module.exports = router