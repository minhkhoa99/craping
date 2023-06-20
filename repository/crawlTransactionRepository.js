const db = require('../services/db.service')
const { crawlLogMessage, flag } = require('../constant')

async function insertCrawlTransaction(transactionObj, page, dateFrom, dateTo) {
  try {
    return await db.transaction(async (trx)=>{
      const isInsertedTransaction = await trx('crawl_transaction').insert(transactionObj)
      if (!isInsertedTransaction) {
        return false
      }

      const crawlLogObj = {
        broker: page,
        date_from: dateFrom,
        date_to: dateTo,
        result: flag.TRUE,
        message: crawlLogMessage.crawl_success,
      }
      const isInsertOrUpdateCrawlLog = await trx('crawl_log ')
        .insert(crawlLogObj)
        .onConflict(['broker', 'date_from', 'date_to'])
        .merge()
        .then(() =>{
          return true
        }).catch((error) => {
          console.error(error)
          return false
        })
      if (!isInsertOrUpdateCrawlLog) {
        await trx.rollback()
        return false
      }
      return true
    })
  } catch (error) {
    console.error(error)
    return false
  }
}

const insertCrawlCashback = async (data)=>{
  try {
    return await db.transaction(async (trx)=>{
      const existingOrderIds = await db('crawl_transaction').pluck('order_id');
      const filteredData = data.filter((item) => !existingOrderIds.includes(item.order_id));
      if (filteredData.length > 0) {
      const isInsertedCrawlCashback = await trx('crawl_transaction').insert(filteredData)
      if (!isInsertedCrawlCashback) {
        await trx.rollback()
        return false
      }
    }
      return true
    })
  } catch (error) {
    console.log(error)
    return false
  }
}


module.exports = {
  insertCrawlTransaction,
  insertCrawlCashback
}
