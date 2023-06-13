const message = Object.freeze({
  fields_cannot_blank: 'trans.fields_cannot_blank',
  fields_invalid: 'trans.fields_invalid',
  server_error: 'trans.server_error',
  account_locked: 'trans.account_locked',
  function_active: 'trans.function_is_active',
  cannot_reading_file: 'trans.cannot_reading_file',
  cannot_login_page: 'trans.cannot_login_page',
  date_not_exist: 'trans.date_not_exist',
})

const code = Object.freeze({
  SUCCESS: 200,
  ERROR: 500,
  INVALID: 402,
  VALIDATOR: 422,
  AUTHORIZATION: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  BAD_REQUEST: 400,
})

const flag = Object.freeze({
  TRUE: 1,
  FALSE: 0,
})

const dateFormat = Object.freeze({
  DATE: 'YYYY-MM-DD',
  DATE_1: 'YYYY.MM.DD',
  DATE_2: 'DD MMM YYYY',
  DATE_3: 'DD-MM-YYYY',
  DATE_TIME: 'YYYY-MM-DD HH:mm:ss',
  DATE_TIME_2: 'YYYY/MM/DD HH:mm:ss',
  DATE_TIME_3: 'DD MMM YYYY HH:mm:ss',
  DATE_TIME_ZONE: 'YYYY-MM-DDTHH:mm:ssZ',
})

const resCheck = Object.freeze({
  ERROR: 'error',
  OK: 'OK',
})

const crawlLogMessage = Object.freeze({
  crawl_success: 'Crawl success',
  login_error: 'Login error',
  data_empty: 'Crawl success and data empty',
  save_data_error: 'Error while save data into Database',
  reading_file_error: 'Error while reading ini file',
  cannot_crawl_data: 'Cannot crawl data',
})

const crawlResMessage = Object.freeze({
  exness: 'Request received. Exness page is being crawled.',
  milton_market: 'Request received. Milton Market page is being crawled.',
  three_trader: 'Request received. Three Trader page is being crawled.',
})


const modeAPI = Object.freeze({
  MANUAL: 'manual',
  BOT: 'bot',
})

const brokerAbbrev = Object.freeze({
  EXNESS: 'EXN',
  MILTON_MARKET: 'MIL',
  THREE_TRADER: 'THT',
})

const metaTradePlatform = Object.freeze({
  MT4: 'MT4',
  MT5: 'MT5',
})

module.exports = {
  code,
  message,
  flag,
  dateFormat,
  resCheck,
  crawlLogMessage,
  crawlResMessage,
  modeAPI,
  brokerAbbrev,
  metaTradePlatform,
}
