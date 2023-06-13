const { s3Client } = require('../configs/index')
const { PutObjectCommand } = require('@aws-sdk/client-s3')

const uploadFileToS3 = async (file, directory, bucket) => {
  try {
    const params = {
      Bucket: bucket,
      Key: directory,
      Body: file,
    }
    const command = new PutObjectCommand(params)
    const result = await s3Client.send(command)
    if (result?.$metadata?.httpStatusCode === 200) {
      return {
        Location: `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${directory}`,
      }
    } else {
      return false
    }
  } catch (error) {
    console.log(error)
    return false
  }
}

module.exports = {
  uploadFileToS3,
}
