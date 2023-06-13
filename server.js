const express = require('express')
const dotenv = require('dotenv')
const morgan = require('morgan')
const bodyParser = require('body-parser')
const cors = require('cors')
const checkLogin = require('./routers/checkLogin.Routes')
dotenv.config()
const server = express()
server.use(morgan('dev'))
server.use(bodyParser.json())
server.use(bodyParser.urlencoded({ extended: true }));
server.use(express.json())
server.use(express.urlencoded({extended: true}))
server.use(cors({
    origin:'*'
}))
server.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    if (req.method === "OPTIONS") {
      res.header("Access-Control-Allow-Methods", "PUT, POST, PATCH, DELETE, GET");
      return res.status(200).json({});
    }
    next();
  });
//use router

server.use(checkLogin)

  server.listen(process.env.PORT,console.log(`server running on port ${process.env.PORT}`))