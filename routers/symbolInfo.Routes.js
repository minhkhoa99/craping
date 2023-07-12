const express = require('express')
const router = express.Router()
const symbolInfo = require('../controller/symbolInfo.controller')

router.post('/symbol-info', symbolInfo.symbolInfo)

module.exports = router
