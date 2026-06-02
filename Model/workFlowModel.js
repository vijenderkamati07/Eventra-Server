const mongoose = require("mongoose");

const workflow = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
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
      type: String
    },
    status: {
      type: String
    },
    result: {
      type: String
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Workflow", workflow);
