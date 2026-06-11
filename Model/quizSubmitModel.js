const mongoose = require("mongoose");

const quizSubmitSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
    },
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workflow",
      required: true,
    },
    topic:{
      type: String,
      required: true,
    },
    slug:{
      type: String,
      required: true,
    },
    answers: [
      {
        question: {
          type: String,
          required: true,
        },
        answer: {
          type: String,
          required: true,
        },
      },
    ],

    score: {
      gain: {
        type: Number,
      },
      total: {
        type: Number,
      },
      accuracy: {
        type: Number,
      }
    },

    correctAnswers: [
      {
        question: {
          type: String,
          required: true,
        },
        correctAnswer: {
          type: String,
          required: true,
        },
        tags: [{
          type: String,
        }]
      },
    ],
    wrongAnswers: [
      {
        question: {
          type: String,
          required: true,
        },
        wrongAnswer: {
          type: String,
          required: true,
        },tags: [{
          type: String,
        }]
      },
    ],
    weakAreas: [
      {
        type: String,
      },
    ],
    feedback: {
      type: String,
    },
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("QuizSubmitModel", quizSubmitSchema);
