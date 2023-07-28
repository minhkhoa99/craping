const { code, crawlLogMessage, message } = require('../constant')
const repository = require('../repository')
const { createResponse } = require('../utils')
const symbolInfo = async (req, res)=>{
  try {
    let isSaveDataSuccess
    // const jsonString = JSON.stringify(req.body).substring(2).replace(/\\|u0000":""}/g, '')
    // const json = JSON.parse(jsonString)

    // // create Set
    // const uniqueSet = new Set(json.map(JSON.stringify))
    // // convert array
    // const uniqueData = Array.from(uniqueSet).map(JSON.parse)
    const data = req.body
   for(const record of data){
    isSaveDataSuccess = await repository.inserted(record)
    console.log(record);
   }

    if (!isSaveDataSuccess) {
      return await createResponse(res, false, null, code.BAD_REQUEST, crawlLogMessage.save_data_error)
    }
    return await createResponse(res, true, null)
  } catch (error) {
    console.log(error)
    return await createResponse(res, false, null, code.ERROR, message.server_error)
  }
}

module.exports = {
  symbolInfo,
}
