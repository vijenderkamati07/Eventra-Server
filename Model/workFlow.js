const { ObjectId } = require("mongodb");
const mongoose = require("mongoose");

const workflow = new mongoose.Schema(
  {
    userId: {
      type: ObjectId,
      require: true,
    },
    title: {
      type: String,
      require: true,
    },
    inputText: {
      type: String,
      require: true,
    },
    type: {
      type: String,
      require: true,
    },
    status: {
      type: String,
      require: true,
    },
    result: {
      type: String,
      require: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Workflow", workflow);
