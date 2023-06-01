const querystring = require('querystring')

module.exports.convertObj = (data)=>{
    let modifiedArray = data[0].split('\n').filter(item => item !== '' && item !=='\t');
    modifiedArray.shift()
    let result = {};
 
    for (let i = 0; i < modifiedArray.length; i++) {
      let keyValue = modifiedArray[i].split('\t');
      let key = keyValue[0];
      let value = keyValue[1];
      if (value) {
        value = value.trim();
      }
      result[key] = value;
    }
   
    let formattedResult = {
        'Order in MT': parseInt(result['Order in MT']),
        'Open time': result['Open time'] + ' ' + result[''],
        'Close time': result['Close time'] + ' ' + result[''],
        'Volume ': result['Volume']+' '+ Object.keys(result)[10],
        'Profit ': result['Profit']
      };
    
    return formattedResult
    
}

async function getDataExness(page, url, res, queryParams, diffDays, startDate, endDate, currentStartDate, currentEndDate) {
  try {
      const utc = new Date().toJSON().slice(0, 10).replace(/-/g, '-')
      const urlGetDay = `${url}/initial_start_day/${utc}/initial_end_day/${utc}`
      const queryString = querystring.stringify(queryParams)
      const urlData = `${urlGetDay}/?${queryString}`
      await page.goto(urlData)
      await page.click('[data-auto="language_switcher_button"]')
      await page.waitForTimeout(2000)
      await page.click('#language_select_values_en > ._1Fc6m')
      await page.waitForTimeout(5000)
      if (diffDays >= 7) {
        const totalWeeks = Math.ceil(diffDays / 7)
        for(let i = 0; i<totalWeeks; i++){
          if (currentEndDate.isAfter(endDate)) {
            currentEndDate = moment(endDate)
          }
          const getTitle = []
    const getInstrument = await page.getByText('Instrument').first().textContent()
    await page.waitForTimeout(1000)
    const getUsd = await page.getByText('USDJPYm').first().textContent()
    getTitle.push(getInstrument, getUsd)
    const divs = await page.$$('div._2i-_7 div._2WW5r div._3SxZ6')
    const data = []
    for (const div of divs) {
      const click = await div.$('span._1ZDRI')
      await click.click()
      await div.waitForSelector('div._2fam6', { state: 'visible' })
      const result = await div.$eval('div._2pyAa', (element) => element.textContent)
      data.push(result)
      await page.waitForTimeout(3000)
    }
    const returnData = convertObj(data)
    currentStartDate = moment(currentEndDate).add(1, 'day')
        currentEndDate = moment(currentStartDate).add(6, 'days')
    return createResponse(res, true, { title: getTitle, getData: returnData })
        }
      }
  } catch (error) {
    console.log(error)
  }
}