// External Modules
const express = require("express");
const dotenv = require("dotenv").config();
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");

// Local Modules
const apiRouter = require("./Router/apiRouter");

const app = express();


// CORS Configuration
app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
);


// Body Parsers
app.use(express.json());

app.use(express.urlencoded({ extended: true }));


// Cookie Parser
app.use(cookieParser());


// Routes
app.use("/api", apiRouter);


// Database Connection
mongoose
  .connect(process.env.DB_BASE_URL)
  .then(() => {
    console.log("Mongo connected...");

    app.listen(process.env.PORT_NUM, () => {
      console.log(
        `Server is running on: http://localhost:${process.env.PORT_NUM}`
      );
    });
  })
  .catch((err) => {
    console.log("Error while starting the server:", err);
  });