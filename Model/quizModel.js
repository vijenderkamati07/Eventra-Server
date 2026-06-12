const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workflow",
      required: true,
    },
    quizType:{
      type: String,
      enum: ['adaptive', 'normal'],
    },
    title: {
      type: String,
      required: true,
    },

    topic: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },

    questions: [{
      question: {
        type: String,
        required: true
      },
      options: [{
        type: String,
      }],
      correctAnswer: {
        type: Number,
      },
      explanation: {
        type: String,
      },
      tags: [{
        type: String
      }]
    }],

    questionCount: {
      type: Number,
      default: 10,
    },

    status: {
      type: String,
      enum: ["draft", "generated", "failed", "archived"],
      default: "generated",
    },
    aiModelUsed: {
      type: String,
      default: "gemini-2.5-flash",
    },
    quizMetadata: {
      timeLimit: {
        type: Number,
      },
      quizMode: {
        type: String,
        enum: ["mcq", "mixed", "theory"],
        default: "mcq",
      },
    },
    adaptiveMetadata: {
      generatedFromSubmissions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "QuizSubmitModel", 
      }],
      weakAreaFocus: [{
        type: String
      }],
      adaptiveDifficulty: {
        type: String
      }
    }
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Quiz", quizSchema);
