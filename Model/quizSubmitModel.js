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
        },
        answer: {
          type: String,
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
        },
        correctAnswer: {
          type: String,
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
        },
        wrongAnswer: {
          type: String,
        },
        tags: [{
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
    userAttempt:{
      type: String,
      enum: ['attempted','draft','not_attempted']
    },
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
    },
    draftMetadata: {
          currentQuestionIndex:{
            type: Number,
          },
          remainingTime:{
            type: Number
          },
          totalQuestion:{
            type: Number
          },
          timeLimit:{
            type: Number
          },
        }
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("QuizSubmitModel", quizSubmitSchema);
