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
    const test = result['Volume'] + ' ' +  result['0.0020Mln. USD'];
  
    
    console.log(result);
    let formattedResult = [
      {
        'Order in MT': parseInt(result['Order in MT']),
        'Open time': result['Open time'] + ' ' + result[''],
        'Close time': result['Close time'] + ' ' + result[''],
        'Volume ': test,
        'Profit ': result['Profit']
      }
    ];
    return formattedResult
}