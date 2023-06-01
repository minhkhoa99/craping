const { chromium } = require('playwright')
const { code, message, dateFormat, flag, resMessage, scrapLogMessage } = require('../constant')
const { createResponse, readingConfigIni, saveScrapLog } = require('../utils')
const moment = require('moment')

const repository = require('../repository')

const querystring = require('querystring')

let isFunctionActive = false
const URL_PAGE = 'exness'

async function crawlDataExness(req, res) {
  // Check if the function is already active
  if (isFunctionActive) {
    return createResponse(res, false, null, code.CONFLICT, message.function_active)
  }
  isFunctionActive = true

  // Respond successfully to customers before data crawl
  res.status(code.SUCCESS).json({ message: resMessage.exness })

  const browserHeadlessMode = process.env.BROWSER_HEADLESS_MODE === 'true'
  const browser = await chromium.launch({ headless: browserHeadlessMode })
  try {
    const context = await browser.newContext()
    const page = await context.newPage()

    // get page config ini
    const iniConfig = await readingConfigIni()
    if (!iniConfig) {
      const dateNow = moment(Date.now()).format(dateFormat.DATE)
      await saveScrapLog(URL_PAGE, dateNow, dateNow, flag.FALSE, scrapLogMessage.reading_file_error)
      await browser.close()
      isFunctionActive = false
      return
    }
    const { USERNAME, PASSWORD, URL_LOGIN, URL_CRAWL_REWARDS, URL_CRAWL_ORDER } = iniConfig.EXNESS

    // login
    const isLogin = await login(page, URL_LOGIN, USERNAME, PASSWORD)
    if (!isLogin) {
      const dateNow = moment(Date.now()).format(dateFormat.DATE)
      await saveScrapLog(URL_PAGE, dateNow, dateNow, flag.FALSE, scrapLogMessage.login_error)
      await browser.close()
      isFunctionActive = false
      return
    }

    const listDate = [{
      fromDate: '2023-05-20',
      toDate: '2023-05-20',
    }]
    for (const obj of listDate) {
      // TODO plus 1 day to obj.fromDate, obj.toDate
      const queryParams = {
        'reward_date_from': obj.fromDate,
        'reward_date_to': obj.toDate,
        'sorting[reward_date]': 'DESC',
        'page': 0,
        'limit': 10,
      }

      // Crawl data from page
      await getDataExness(page, URL_CRAWL_REWARDS, URL_CRAWL_ORDER, queryParams)
    }

    await browser.close()
    isFunctionActive = false
    return
  } catch (error) {
    console.log(error)
    await browser.close()
    isFunctionActive = false
    return
  }
}

// login
async function login(page, urlLogin, username, password) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 3000))
    await page.goto(urlLogin)
    await page.waitForLoadState('networkidle')
    await page.click('[data-auto="language_switcher_button"]')

    await page.click('#language_select_values_en > ._1Fc6m')


    await page.fill('input[name = "login"]', username)
    await page.fill('input[name = "password"]', password)


    await page.click('#mui-1')
    await page.waitForNavigation()
    return true
  } catch (error) {
    console.log(error)
    return false
  }
}

// getData
async function getDataExness(page, urlCrawlRewards, urlCrawlOrder, queryParams) {
  try {
    const listData = []
    const { reward_date_from, reward_date_to } = queryParams

    const queryString = querystring.stringify(queryParams)
    const urlReportRewards = `${urlCrawlRewards}/?${queryString}`
    await page.goto(urlReportRewards)

    page.waitForTimeout(3000)

    const parentElements = await page.$$('div[data-auto="row"]')
    if (parentElements.length === 0) {
      await saveScrapLog(URL_PAGE, reward_date_from, reward_date_to, flag.TRUE, scrapLogMessage.data_empty)
      return
    }

    const listAccountInfo = []
    for (const child of parentElements) {
      const accountInfo = {}
      const preElement = await child.$$('pre')
      for (let index = 0; index < preElement.length; index++) {
        switch (index) {
          case 0:
            accountInfo.date = await preElement[index].textContent()
          case 7:
            accountInfo.accountId = await preElement[index].textContent()
          case 8:
            accountInfo.accountType = await preElement[index].textContent()
          default:
            continue
        }
      }
      listAccountInfo.push(accountInfo)
    }

    for (const accountInfo of listAccountInfo) {
      const transactionObj = {
        account_id: accountInfo.accountId,
        account_type: accountInfo.accountType,
      }

      // Custom report orders url from account info
      const initialDate = moment(accountInfo.date, 'DD MMM YYYY').format('YYYY-MM-DD')
      const initialDatePath = `initial_start_day/${initialDate}/initial_end_day/${initialDate}/`
      const dateFilter = `date_from=${initialDate}&date_to=${initialDate}`
      const urlReportOrders = `${urlCrawlOrder}/${initialDatePath}?${dateFilter}&client_account=${accountInfo.accountId}`
      await page.goto(urlReportOrders)
      await page.waitForTimeout(3000)

      const getUsd = await page.getByText('USDJPYm').first().textContent()
      transactionObj.instrument = getUsd

      await page.waitForTimeout(2000)

      const listDetailElements = await page.$$('div.ke3xz div._2i-_7 div._2WW5r div._3SxZ6')

      for (const detailElement of listDetailElements) {
        const click = await detailElement.$('span._1ZDRI')
        await click.click()
        await detailElement.waitForSelector('div._2fam6', { state: 'visible' })
        await page.waitForTimeout(3000)
        const result = await detailElement.$eval('div._2pyAa', (element) => element.textContent)
        await page.waitForTimeout(3000)
        convertStringToObj(result, transactionObj)
        listData.push(transactionObj)

        await page.waitForTimeout(3000)
      }
    }

    // save to db
    if (listData.length === 0) {
      await saveScrapLog(URL_PAGE, reward_date_from, reward_date_to, flag.TRUE, scrapLogMessage.data_empty)
    } else {
      const isInsertExness = await repository.insertScrapExness(listData, reward_date_from, reward_date_to)
      if (!isInsertExness) {
        await saveScrapLog(URL_PAGE, reward_date_from, reward_date_to, flag.FALSE, scrapLogMessage.save_data_error )
      }
    }
    return
  } catch (error) {
    console.log(error)
    await saveScrapLog(URL_PAGE, queryParams.reward_date_from, queryParams.reward_date_to, flag.FALSE, scrapLogMessage.cannot_crawl_data)
    return
  }
}

// convert data
function convertStringToObj(data, transactionObj) {
  try {
    const orderMatch = data.match(/Order in MT(\d+)/)
    const openTimeMatch = data.match(/Open time(.+?)Close time/)
    const closeTimeMatch = data.match(/Close time(.+?)Tick History/)
    const volumeMatch = data.match(/Volume(.+?)Lots/)
    const profitMatch = data.match(/Profit(.+)/)
    const volumeLots = volumeMatch ? volumeMatch[1].trim() + ' ' + 'Lots' : null
    const volumeMlnMatch = data.match(/Lots(.+?)Mln\. USD/)
    const volumeMln = volumeMlnMatch ? volumeMlnMatch[1].trim() + ' ' + 'Mln. USD' : null

    transactionObj.order_in_mt = orderMatch ? orderMatch[1] : null
    transactionObj.profit = profitMatch ? profitMatch[1].trim() : null
    transactionObj.open_date = openTimeMatch ? moment(openTimeMatch[1].trim(), dateFormat.DATE_TIME_3).format(dateFormat.DATE_TIME) : null
    transactionObj.close_date = closeTimeMatch ? moment(closeTimeMatch[1].trim(), dateFormat.DATE_TIME_3).format(dateFormat.DATE_TIME) : null
    transactionObj.volume_lots = volumeLots
    transactionObj.volume_mln_usd = volumeMln
  } catch (error) {
    console.log(error)
  }
}

module.exports = {
  crawlDataExness,
}
