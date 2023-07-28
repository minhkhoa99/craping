const { code, crawlLogMessage, message } = require('../constant')
const repository = require('../repository')
const { createResponse } = require('../utils')

const crawlCashback = async (req, res)=>{
  try {
    // const jsonString = JSON.stringify(req.body).substring(2).replace(/\\|u0000":""}/g, '')
    // const json = JSON.parse(jsonString)
    const json = req.body
    // create Set
    // const uniqueSet = new Set(json.map(JSON.stringify))
    // // convert array
    // const uniqueData = Array.from(uniqueSet).map(JSON.parse)
    const isSaveDataSuccess = await repository.insertCrawlCashback(json)

    if (!isSaveDataSuccess) {
      return await createResponse(res, false, null, code.BAD_REQUEST, crawlLogMessage.save_data_error)
    }
    return await createResponse(res, true, null)
  } catch (error) {
    console.log(error)
    return await createResponse(res, false, null, code.ERROR, message.server_error)
  }
}
const crawlEA = async (req,res)=>{
  try{
  let isSaveDataSuccess
  const data = req.body
  for(const record of data){
    isSaveDataSuccess = await repository.inserted(record)
  
   }
if(!isSaveDataSuccess){
  return await createResponse(res, false, null, code.BAD_REQUEST, crawlLogMessage.save_data_error)
}
return await createResponse(res, true, null)
  }
  catch(error){
    console.log(error)
    return await createResponse(res, false, null, code.ERROR, message.server_error)
  }
}

module.exports = {
  crawlCashback,
  crawlEA
}
