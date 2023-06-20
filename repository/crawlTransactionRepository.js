const db = require('../services/db.service')
const { crawlLogMessage, flag } = require('../constant')

async function insertCrawlTransaction(transactionObj, page, dateFrom, dateTo) {
  try {
    return await db.transaction(async (trx)=>{
      const isInsertedTransaction = await trx('crawl_transaction2').insert(transactionObj)
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
      const isInsertOrUpdateCrawlLog = await trx('crawl_log2')
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
      const isInsertedCrawlCashback = await trx('crawl_transaction2').insert(data)
      if (!isInsertedCrawlCashback) {
        await trx.rollback()
        return false
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
