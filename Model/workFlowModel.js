const mongoose = require("mongoose");

const workflowSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    workflowType: {
      type: String,
      enum: [
        "quiz_generation",
        "quiz_evaluation",
        "revision_plan",
        "weakness_analysis",
      ],
      required: true,
    },

    topic: {
      type: String,
      required: true,
      trim: true,
    },

    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },

    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },

    workflowMetadata: {
      questionCount: {
        type: Number,
        default: 10,
      },

      quizMode: {
        type: String,
        enum: ["mcq", "mixed", "theory"],
        default: "mcq",
      },

      timeLimit: {
        type: Number,
      },
    },

    resultReference: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "resultModel",
    },

    resultModel: {
      type: String,
      enum: ["Quiz", "Evaluation", "RevisionPlan"],
    },

    errorMessage: {
      type: String,
      default: "",
    },

    startedAt: {
      type: Date,
    },

    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Workflow", workflowSchema);
