const express = require("express");
const router = express.Router();
const checkLogin = require('../controller/checkLogin')
router.post('/check',checkLogin.checkLogin)
module.exports = router