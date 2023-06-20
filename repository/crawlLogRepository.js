const db = require('../services/db.service')

async function insertCrawlLog(obj) {
  try {
    const result = await db.transaction(async (trx) => {
      await trx('crawl_log').insert(obj)
    })
    return result ? true : false
  } catch (error) {
    console.error(error)
    return false
  }
}

const getListDayError = async (pageName)=>{
  try {
    return await db('crawl_log2')
      .orderBy('id', 'desc')
      .where({ broker: pageName, result: 0 })
      .select('date_from', 'date_to')
  } catch (error) {
    console.error(error)
    return false
  }
}

const isExistDayError = async (broker, dateFrom, dateTo) => {
  try {
    const result = await db('crawl_log2').where({
      broker: broker,
      date_from: dateFrom,
      date_to: dateTo,
    }).count('id as rowCount')
    return result[0].rowCount !== 0
  } catch (error) {
    console.error(error)
    return false
  }
}

const updateCrawlLog = async (obj) => {
  try {
    return await db.transaction(async (trx) => {
      await trx('crawl_log2')
        .where({
          broker: obj.broker,
          date_from: obj.date_from,
          date_to: obj.date_to,
        })
        .update({ result: obj.result, message: obj.message })
    })
  } catch (error) {
    return false
  }
}

const notExistDataOfPage = async (pageName) => {
  try {
    const result = await db('crawl_log2').where({
      broker: pageName,
    }).count('id as rowCount')
    return result[0].rowCount === 0
  } catch (error) {
    console.error(error)
    return
  }
}

module.exports = {
  insertCrawlLog,
  isExistDayError,
  updateCrawlLog,
  getListDayError,
  notExistDataOfPage,
}
