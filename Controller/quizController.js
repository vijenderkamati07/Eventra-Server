//External Module
const { check } = require("express-validator");
const { validationResult } = require("express-validator");

//Local Module
const Workflow = require("../Model/workFlowModel");
const Quiz = require("../Model/quizModel");
const QuizSubmitModel = require("../Model/quizSubmitModel");
const { generateQuiz, evaluateQuiz, generateWeakAreasQuiz } = require("../Services/AiService");

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
      await newWorkflow.save();

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

      newWorkflow.status = "completed";
      newWorkflow.completedAt = new Date();
      await newWorkflow.save();

      const title = newWorkflow.topic + " " + newWorkflow.difficulty + " Quiz";

      const quiz = await new Quiz({
        userId: req.user?.userId,
        workflowId: newWorkflow._id,
        title: title,
        topic: newWorkflow.topic,
        difficulty: newWorkflow.difficulty,
        questions: result,
        questionCount: result.length,
        status: "generated",
        aiModelUsed: "gemini-2.5-flash",
        quizMetadata: {
          timeLimit: newWorkflow.workflowMetadata.timeLimit,
          quizMode: newWorkflow.workflowMetadata.quizMode,
          tags: result.map((obj) => obj.tags),
        },
      });

      await quiz.save();

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

exports.postEvaluateQuiz = async (req, res) => {
  const quizId = req.params.quizId;
  const { userId } = req.user;
  const { topic, difficulty, answers } = req.body;

  try {
    const actualAnswers = await Quiz.findById(quizId).select("questions");
    const questionCount = actualAnswers.questions.length;


    if (!Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: "Answers must be array",
        errors: ["INVALID_ANSWERS"],
      });
    }

    // check empty array
    if (answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Answers cannot be empty",
        errors: ["INVALID_ANSWERS"],
      });
    }

    const newWorkflow = await new Workflow({
      userId,
      workflowType: "quiz_evaluation",
      topic,
      difficulty,
      status: "pending",
      workflowMetadata: {
        questionCount,
        timeLimit: 10,
      },
    });

    newWorkflow.startedAt = new Date();
    await newWorkflow.save();

    newWorkflow.status = "processing";
    await newWorkflow.save();

    if (!actualAnswers) {
      newWorkflow.status = "failed";
      await newWorkflow.save();
      return res.status(400).json({
        success: false,
        message: "Quiz not evaluated",
        errors: ["RESPONSE_NOT_GENERATED"],
      });
    }

    //Answer check logic
    const correctAnswersArr = [];
    const wrongAnswersArr = [];

    answers.forEach((ans) => {
      const actualQuestion = actualAnswers.questions[ans.questionIndex];

      if (Number(ans.answer) === Number(actualQuestion.correctAnswer)) {
        correctAnswersArr.push({
          question: actualQuestion.question,
          correctAnswer: actualQuestion.options[ans.answer],
          tags: actualQuestion.tags,
        });
      } else {
        wrongAnswersArr.push({
          question: actualQuestion.question,
          wrongAnswer: actualQuestion.options[ans.answer],
          correctAnswer: actualQuestion.options[actualQuestion.correctAnswer],
          tags: actualQuestion.tags,
        });
      }
    });

    const tempAnswers = actualAnswers.questions.map((q) => ({
      question: q.question,
      answer: q.options[q.correctAnswer],
    }));
    const newQuizEvaluationModel = await new QuizSubmitModel({
      userId,
      quizId,
      workflowId: newWorkflow._id,
      answers: tempAnswers,
      topic,
      score: {
        gain: correctAnswersArr.length,
        total: questionCount,
      },
      correctAnswers: correctAnswersArr,
      wrongAnswers: wrongAnswersArr,
      status: "processing",
    });

    await newQuizEvaluationModel.save();

    //AI model call for feedback
    const response = await evaluateQuiz(wrongAnswersArr);
    console.log("AI response recieved");

    if (!response) {
      newWorkflow.status = "failed";
      newWorkflow.errorMessage = "Invalid AI response";
      await newWorkflow.save();

      newQuizEvaluationModel.status = "failed";
      await newQuizEvaluationModel.save();

      console.log("AI response failed");
      return res.status(400).json({
        success: false,
        message: "Quiz not evaluated",
        errors: ["RESPONSE_NOT_GENERATED"],
      });
    }

    await newWorkflow.save();

    newQuizEvaluationModel.weakAreas = response.weakAreas;
    newQuizEvaluationModel.feedback = response.feedback;
    newQuizEvaluationModel.status = "completed";
    await newQuizEvaluationModel.save();

    return res.status(200).json({
      success: true,
      message: "Quiz evaluation successfully",
      data: {
        score: correctAnswersArr.length,
        maxScore: questionCount,
        intelligenecResponse: response,
      },
    });
  } catch (err) {
    console.log("Error while Evaluating Quiz :", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.postWeakAreasPractise = async (req, res) => {
  const userId = req.user.userId;
  const topic  = req.params.topic;
  try {

    const newWorkflow = await new Workflow({
        userId: req.user.userId,
        workflowType: "weakArea_quiz_practise",
        topic,
        status: "pending",
      });
      await newWorkflow.save();
      console.log("wrokflow created");

      newWorkflow.status = 'processing';
      newWorkflow.startedAt = new Date();
      await newWorkflow.save();

    const userAttempt = await QuizSubmitModel.find({ userId, topic })
      .sort({ createdAt: -1 })
      .limit(3);
      console.log("Attempts found");

    if (
      !userAttempt ||
      !Array.isArray(userAttempt) ||
      userAttempt.length === 0
    ) {
      newWorkflow.status = 'failed';
      newWorkflow.errorMessage = 'No quiz submittion found';
      await newWorkflow.save();
      return res.status(404).json({
        success: false,
        message: "No quiz submittion found",
        errors: ["QUIZ_SUBMITTIONS_NOT_FOUND"],
      });
    }

    //Layer1: Performance Analytics Layer
    const accuracyScore = [];
    const freq = {};
    
    console.log("loop start");
    userAttempt.forEach((obj) => {
      accuracyScore.push(Math.floor(
        (obj.correctAnswers.length/obj.answers.length)*100
      ))

        obj.weakAreas.forEach((area) => {
          freq[area] = (freq[area] || 0) + 1;
        });
    });
    
      console.log("loop end");

    //Layer2: Decide difficulty
    let totalScore = 0;
    for(let i=0; i<accuracyScore.length; i++){
      totalScore+=Number(accuracyScore[i]);
    }
    const avgScore = Math.floor((totalScore/accuracyScore.length));
    
    const strongAreaPortion = 40;
    let difficultyLevel = 'easy';
    
    if(avgScore>40 && avgScore<=80){
      difficultyLevel = 'medium';
      strongAreaPortion = 30;

    }else if(avgScore>80 && avgScore<=100){
      difficultyLevel = 'hard';
      strongAreaPortion = 20;
    };
    
      console.log("avg calculated");

    //Layer3: quiz partioning & AI
    const weakAreasPortion = 100-strongAreaPortion;
    const generationStrategy = {
      weakAreasPortion,
      strongAreaPortion
    }

    
      console.log("AI call");
    const result = await generateWeakAreasQuiz(
      topic,
      difficultyLevel,
      freq,
      generationStrategy
    );
    
      console.log("result revieved");

    if(!result || !Array.isArray(result) || result.length === 0){
      newWorkflow.status = "failed";
        newWorkflow.errorMessage = "Invalid AI response";
        newWorkflow.save();
        return res.status(400).json({
          success: false,
          message: "Quiz not generated",
          errors: ["RESPONSE_NOT_GENERATED"],
        });
    }

      const title = newWorkflow.topic + " " + difficultyLevel + " Quiz";

      
      console.log("Quiz creation start");
      const quiz = await new Quiz({
        userId: req.user?.userId,
        workflowId: newWorkflow._id,
        title: title,
        topic,
        difficulty: difficultyLevel,
        questions: result,
        questionCount: result.length,
        status: "generated",
        aiModelUsed: "gemini-2.5-flash",
        quizMetadata: {
          timeLimit: newWorkflow.workflowMetadata.timeLimit,
          quizMode: newWorkflow.workflowMetadata.quizMode,
          tags: result.map((obj) => obj.tags),
        },
        adaptiveMetadata: {
          generatedFromSubmissions: userAttempt.map((obj)=> obj._id),
          weakAreaFocus: Object.keys(freq),
          adaptiveDifficulty: difficultyLevel
        }
      });
      await quiz.save();
      
      console.log("Quiz created");

      newWorkflow.difficulty = difficultyLevel;
      newWorkflow.status = 'completed';
      newWorkflow.workflowMetadata.questionCount = result.length;
      newWorkflow.workflowMetadata.timeLimit = result.length;
      newWorkflow.completedAt = new Date();
      await newWorkflow.save();
      
      console.log("response send");

      return res.status(200).json({
        success: true,
        message: "Weak Area Quiz generated",
        data: {
          result
        }
      });

  } catch (err) {
    console.log("Error while Generating personalized Quiz :", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
