const axios = require('axios')
const mysql = require('mysql2')
const moment = require('moment')
const db = require('knex')({
  client: 'mysql2',
  connection: {
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'crap_cashback'
  }
})
module.exports.saveData = async(req,res)=>{
  try {
    // const data = req.body.data
    // const sortDate = data.sort((a, b)=>{
    //   const dateA = moment(a.open_time)
    //   const dateB = moment(b.open_time)
    //   return dateA - dateB
    // })
    // for (const record of sortDate) {
    //   const isFirstRunning = await isExistDataOfCasback(record)
    //   if (isFirstRunning) {
    //     await db('crap_cash').insert(newData);
    //   }
    //   else{
    //     const { account_number, open_time, deal_id } = isFirstRunning;
    //     const newData = data.filter(
    //       (item) =>
    //         item.account_number !== account_number ||
    //         item.open_time !== open_time ||
    //         item.deal_id !== deal_id
    //     );
      
    //     if (newData.length > 0) {
    //       await db('crap_cash').insert(newData);
    //     }
    //   }
    
    //   } 
    const accc = 'djask34.83905ijuoidhfDĐẰEVj576903#=1.<html>&*#$^**###@'
    const cut = accc.replace(/[^\d.-]/g, '')

    console.log(cut);
  } catch (error) {
    console.log(error)
  }
}

const isExistDataOfCasback = async (data) => {
  try {
    const result = await db('crap_cash').where({
      account_number: data.account_number,
      open_time: data.open_time,
      deal_id: data.deal_id,
    }).count('account_number as rowCount')
    return result[0].rowCount === 0
  } catch (error) {
    console.error(error)
    return
  }
}