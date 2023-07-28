const db = require("../services/db.service");

const inserted = async (data) => {
  try {
    return await db.transaction(async (trx) => {
      //check isExisting
      const isExistingRecord = await db("symbol_info")
        .select("id")
        .where({
          'broker': data.broker,
          kind: data.kind,
          symbol: data.symbol,
        })
        .first();

      let isInserted;
      if (isExistingRecord) {
        isInserted = await trx("symbol_info")
          .where("id", isExistingRecord.id)
          .update(data);
      }
       else {
        isInserted = await trx("symbol_info").insert(data);
      }
      
      if (!isInserted) {
        await trx.rollback();
        return false;
      }
      return true;
    });
  } catch (error) {
    console.log(error);
    return false;
  }
};
module.exports = {
  inserted,
};
