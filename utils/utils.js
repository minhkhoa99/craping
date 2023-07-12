const { message, code, dateFormat } = require('../constant')
const jwt = require('jsonwebtoken')
const repository = require('../repository')
const moment = require('moment')

function getUserIdByToken(req) {
  const Authorization = req.headers.Authorization || req.headers.authorization
  if (Authorization && Authorization.split(' ').length > 1) {
    try {
      return jwt.verify(Authorization.split(' ')[1], process.env.JWT_SECRET).user_id
    } catch (error) {
      console.error(error)
    }
  }

  const error = new Error(message.access_token_invalid)
  error.code = code.AUTHORIZATION
  throw error
}

const createResponse = (res, isSuccess = true, data = {}, code, message) => {
  const response = {}

  if (isSuccess) {
    response['status'] = 'success'
    response['data'] = data
  } else if (message) {
    response['status'] = 'error'
    response['message'] = message
    if (code) response['code'] = code
    if (data) response['data'] = data
  } else {
    response['status'] = 'fail'
    response['data'] = data
  }

  const statusCode = isSuccess ? 200 : 500

  return res.status(statusCode)
    .set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    })
    .json(response)
}

const saveCrawlLog = async (page, dateFrom, dateTo, result, message) => {
  try {
    const objCrawlLog = {
      broker: page,
      date_from: dateFrom,
      date_to: dateTo,
      result: result,
      message: message,
    }

    const isExist = await repository.isExistDayError(page, objCrawlLog.date_from, dateTo)
    if (!isExist) {
      await repository.insertCrawlLog(objCrawlLog)
    } else {
      await repository.updateCrawlLog(objCrawlLog)
    }
  } catch (error) {
    console.error(error)
    return false
  }
}

const getListDays = async (dateFrom, dateTo, pageName) => {
  try {
    const listDateError = await repository.getListDayError(pageName)
    if (listDateError.length === 0) {
      return [{ fromDate: dateFrom, toDate: dateTo }]
    }

    // convert and renew arr list error day
    const listDaysObj = listDateError.map((obj) => {
      return {
        fromDate: moment(obj.date_from).format(dateFormat.DATE),
        toDate: moment(obj.date_to).format(dateFormat.DATE),
      }
    })
    return [
      ...listDaysObj,
      { fromDate: dateFrom, toDate: dateTo },
    ]
  } catch (error) {
    console.error(error)
    return null
  }
}
const getCrawlTime = async (broker, firstTime) => {
  try {
    const lastCrawlTime = await repository.getLastCrawlTime(broker)
    if (!lastCrawlTime) {
      return false
    }

    const currentTime = moment().format(dateFormat.DATE_TIME)
    if (lastCrawlTime.length === 0) {
      return { fromDate: firstTime, toDate: currentTime }
    }

    const fromDate = lastCrawlTime[0].result === 0 ?
      moment(lastCrawlTime[0].date_from).format(dateFormat.DATE_TIME) :
      moment(lastCrawlTime[0].date_to).format(dateFormat.DATE_TIME)

    return { fromDate, toDate: currentTime }
  } catch (error) {
    console.log(error)
    return false
  }
}
module.exports = {
  getUserIdByToken,
  createResponse,
  saveCrawlLog,
  getListDays,
  getCrawlTime
}
