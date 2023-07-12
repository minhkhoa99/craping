const db = require('../services/db.service')

const inserted = async(data)=>{
    try {
        return await db.transaction(async (trx)=>{
          const isInsertedCrawlCashback = await trx('symbol_info').insert(data)
          .onConflict(['broker', 'kind', 'symbol']).merge().then(async()=>{
            const insertedId = await trx('symbol_info').select('id').where({ broker: data.broker, kind: data.kind, symbol: data.symbol }).first();
            console.log(insertedId);
    // Cập nhật lại id trong đối tượng data
    data.id = insertedId.id;
          })
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
module.exports ={
    inserted,
}