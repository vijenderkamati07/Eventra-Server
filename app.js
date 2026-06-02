//External Modules
const express = require("express");
const dotenev = require("dotenv").config();
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");


//Local Modules
const apiRouter = require("./Router/apiRouter");

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use("/api", apiRouter);


mongoose
  .connect(process.env.DB_BASE_URL)
  .then(()=>{
    console.log("Mongo connected..");
    app.listen(process.env.PORT_NUM,()=>{
      console.log("Try to connect with server..");
      console.log(`Server is running on: http://localhost:${process.env.PORT_NUM}`)
  });
  })
  .catch((err)=>{
    console.log("Error while strtinh the server", err);
  })

