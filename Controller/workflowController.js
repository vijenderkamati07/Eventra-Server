//External Module
const { check } = require("express-validator");
const { validationResult } = require("express-validator");

//Local Module
const Workflow = require("../Model/workFlowModel");
const { generateQuiz } = require("../Services/AiService");

//Quiz workflows
exports.postGenerateQuiz = [
  check("topic")
    .notEmpty()
    .withMessage("Topic Name is required")
    .trim()
    .isLength({ min: 2 })
    .withMessage("Topic Name must be at least 2 characters long")
    .matches(/^[A-Za-z]+$/)
    .withMessage("Topic Name must contain only alphabetic characters"),
  check("difficulty")
    .notEmpty()
    .withMessage("Difficulty value is required")
    .trim()
    .isLength({ min: 2 })
    .withMessage("Difficulty value must be at least 2 characters long")
    .matches(/^[A-Za-z]+$/)
    .withMessage("Difficulty value must contain only alphabetic characters"),
  check("questionCount")
    .notEmpty()
    .withMessage("questionCount value is required")
    .matches(/^[0-9]$/)
    .withMessage("questionCount value must contain only numeric values"),
  async (req, res) => {
    const { topic, difficulty, questionCount } = req.body;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        message: "Invalid input",
        errors: errors.array().map((err) => err.msg),
      });
    }

    try {
      const newWorkflow = await new Workflow({
        userId: req.user.userId,
        workflowType: "quiz_generation",
        topic,
        difficulty,
        status: "pending",
        workflowMetadata: {
          questionCount,
          timeLimit: 10,
        },
      });

      await newWorkflow.save();

      //call AI later & update status to processing
      newWorkflow.status = "processing";
      newWorkflow.startedAt = new Date();
      newWorkflow.save();

      //dont know how to update state to processing
      const result = await generateQuiz(topic, difficulty, questionCount);

      if (!result || !Array.isArray(result) || result.length === 0) {
        //dont know how to update state to failed
        newWorkflow.status = "failed";
        newWorkflow.errorMessage = "Invalid AI response";
        newWorkflow.save();
        return res.status(400).json({
          success: false,
          message: "Quiz not generated",
          errors: ["RESPONSE_NOT_GENERATED"],
        });
      }

      //dont know how to update state to success
      newWorkflow.status = "completed";
      newWorkflow.completedAt = new Date();
      newWorkflow.save();

      //i will store into QUIZ model but not now as i does not exists right now

      return res.status(200).json({
        success: true,
        message: "Quiz generated successfully",
        data: {
          workflowId: newWorkflow._id,
          result,
        },
      });
    } catch (err) {
      console.log("Error while Generating Quiz :", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
];


