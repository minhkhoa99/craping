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
  
    return await db.transaction(async (trx)=>{
      const listResult = []
      try {
        const insertPromiseData = data.map(async (item)=>{
         
          let result = false
          const isExistingRecord = await db('crawl_transaction')
            .select('id')
            .where({
              'broker': item.broker,
              'account': item.account,
              [item.platform === '4' ? 'ticket' : 'deal_id']: item.platform === '4' ? item.ticket : item.deal_id
            }).first()
  
          if (isExistingRecord) {
            result = await trx('crawl_transaction')
              .where('id', isExistingRecord.id)
              .update(item)
          } else {
            result = await trx('crawl_transaction').insert(item)
          }
          listResult.push(result)
        })
  
        await Promise.all(insertPromiseData)
  
        if (listResult.includes(false)) {
          throw new Error('Insert or update failed') //  rollback if insert/update fail
        }
        return true
      } catch (error) {
        console.log(error)
        await trx.rollback()
        return false
      }
    })
  }



module.exports = {
  insertCrawlTransaction,
  insertCrawlCashback
}
