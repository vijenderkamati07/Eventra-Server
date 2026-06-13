//External Module
const { check, body } = require("express-validator");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

//Local Module
const Workflow = require("../Model/workFlowModel");
const Quiz = require("../Model/quizModel");
const QuizSubmitModel = require("../Model/quizSubmitModel");
const Subject = require("../Model/subjectModel");
const {
  generateQuiz,
  evaluateQuiz,
  generateWeakAreasQuiz,
} = require("../Services/AiService");


exports.postWeakAreasPractise = async (req, res) => {
  const userId = req.user.userId;
  const {slug} = req.body;
  const topic = slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  try {
    const newWorkflow = await new Workflow({
      userId: req.user.userId,
      workflowType: "weakArea_quiz_practise",
      topic,
      status: "pending",
    });
    await newWorkflow.save();
    console.log("wrokflow created");

    newWorkflow.status = "processing";
    newWorkflow.startedAt = new Date();
    await newWorkflow.save();

    const userAttempt = await QuizSubmitModel.find({ userId, slug, status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(5);
    console.log("Attempts found");

    if (
      !userAttempt ||
      !Array.isArray(userAttempt) ||
      userAttempt.length === 0
    ) {
      newWorkflow.status = "failed";
      newWorkflow.errorMessage = "No quiz submittion found";
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
      accuracyScore.push(
        Math.floor((obj.correctAnswers.length / obj.answers.length) * 100),
      );

      obj.weakAreas.forEach((area) => {
        freq[area] = (freq[area] || 0) + 1;
      });
    });

    console.log("loop end");

    //Layer2: Decide difficulty
    let totalScore = 0;
    for (let i = 0; i < accuracyScore.length; i++) {
      totalScore += Number(accuracyScore[i]);
    }
    const avgScore = Math.floor(totalScore / accuracyScore.length);

    let strongAreaPortion = 40;
    let difficultyLevel = "easy";

    if (avgScore > 40 && avgScore <= 80) {
      difficultyLevel = "medium";
      strongAreaPortion = 30;
    } else if (avgScore > 80 && avgScore <= 100) {
      difficultyLevel = "hard";
      strongAreaPortion = 20;
    }

    console.log("avg calculated");

    //Layer3: quiz partioning & AI
    const weakAreasPortion = 100 - strongAreaPortion;
    const generationStrategy = {
      weakAreasPortion,
      strongAreaPortion,
    };

    console.log("AI call");

    const result = await generateWeakAreasQuiz(
      topic,
      difficultyLevel,
      freq,
      generationStrategy,
    );


    if (!result) {
      newWorkflow.status = "failed";
      newWorkflow.errorMessage = "Invalid AI response";
      await newWorkflow.save();

      return res.status(400).json({
        success: false,
        message: "Quiz not generated",
        errors: ["RESPONSE_NOT_GENERATED"],
      });
    }

    const questions = result.questions;

    if (
      !questions ||
      !Array.isArray(questions) ||
      questions.length === 0
    ) {
      newWorkflow.status = "failed";
      newWorkflow.errorMessage = "Invalid AI response";
      await newWorkflow.save();

      return res.status(400).json({
        success: false,
        message: "Quiz not generated",
        errors: ["RESPONSE_NOT_GENERATED"],
      });
    }

    const title = `${newWorkflow.topic} ${difficultyLevel} Quiz`;

    const tags = questions.flatMap(
      (obj) => obj.tags || []
    );

    const uniqueTags = [...new Set(tags)];

    console.log("Quiz creation start");

    const quiz = new Quiz({
      userId: req.user.userId,
      workflowId: newWorkflow._id,
      quizType: "adaptive",
      title,
      topic,
      slug,
      difficulty: difficultyLevel,
      questions,
      questionCount: questions.length,
      status: "generated",
      aiModelUsed: "gemini-2.5-flash",

      quizMetadata: {
        timeLimit: result.timeLimit,
        quizMode: "mcq",
        tags: uniqueTags,
      },

      adaptiveMetadata: {
        generatedFromSubmissions: userAttempt.map(
          (obj) => obj._id
        ),

        weakAreaFocus: Object.keys(freq),

        adaptiveDifficulty: difficultyLevel,
      },
    });

    await quiz.save();

    console.log("Quiz created");

    await Subject.findOneAndUpdate(
      { slug },
      {
        $addToSet: {
          subtopics: {
            $each: uniqueTags,
          },
        },
      }
    );

    newWorkflow.difficulty = difficultyLevel;
    newWorkflow.status = "completed";
    newWorkflow.completedAt = new Date();

    newWorkflow.workflowMetadata = {
      questionCount: questions.length,
      timeLimit: result.timeLimit,
    };

    await newWorkflow.save();

    console.log("response send");

    return res.status(200).json({
      success: true,
      message: "Weak Area Quiz generated",

      data: {
        quizId: quiz._id,
        workflowId: newWorkflow._id,
        quiz
      },
    });
  } catch (err) {
    console.log("Error while Generating personalized Quiz :", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getAdaptiveIsEligible = async (req,res) => {
  try{

    const userId = req.user.userId;

    const subjects = await QuizSubmitModel.aggregate([
                    {
                      $match: {
                        userId: new mongoose.Types.ObjectId(userId),
                        status: "completed"
                      }
                    },
                    {
                      $group: {
                        _id: "$slug",
                        count: { $sum: 1 }
                      }
                    },
                  ]);
    if(!subjects || !Array.isArray(subjects)|| subjects.length===0){
      return res.status(400).json({
        success: false,
        message: "No subject found for adaptive learning",
        errors: ["NO_SUBJECT_FOUND"]
      })
    }
    return res.status(200).json({
        success: true,
        message: "subject found for adaptive learning",
        data:{
          unlockRequirement: 5,
          subjects
        }
      })
    
  }catch(err){
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching Adaptive eligibility",
      errors: err
    });
  }
}

exports.getAdaptiveLearningSubject = async (req, res) =>{
  try{

    const slug = req.params.slug;
    const userId = req.user.userId;

    const attempts = await QuizSubmitModel.find({userId, slug, status: 'completed'}).sort({createdAt: -1});

     if (!attempts || !Array.isArray(attempts) || attempts.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No quiz submittion found",
        errors: ["QUIZ_SUBMITTIONS_NOT_FOUND"],
      });
    }
    const attemptCount = attempts.length;

    const newAttempts = attempts.slice(0,6);

    const latestAccuracy = attempts[0].score.accuracy;
    
    let isElgible = false; 
    (attemptCount>=5)? isElgible = true : isElgible = false;
    const freq = {};

    newAttempts.forEach((obj) => {
      obj.weakAreas.forEach((area) => {
        freq[area] = (freq[area] || 0) + 1;
      });
    });

    const generatedQuiz = {
      exists: false,
      quizId: null,
      questionCount: null,
      estimatedTime: null
    }

    const lastAdpativeQuiz = await Quiz.findOne({slug, quizType: 'adaptive', status: 'generated'}).sort({createdAt: -1});
    

    //Add feature to check is user attempt
    const checkIsAttempted = await QuizSubmitModel.find({userId, quizId: lastAdpativeQuiz._id, status:'completed'});

    if(lastAdpativeQuiz && checkIsAttempted){
      generatedQuiz.exists = true;
      generatedQuiz.quizId = lastAdpativeQuiz._id;
      generatedQuiz.questionCount = lastAdpativeQuiz.questionCount;
      generatedQuiz.estimatedTime = lastAdpativeQuiz.quizMetadata.timeLimit;
    }

    return res.status(200).json({
      success: true,
      message: "Adaptive quiz past data found",
      data:{
        slug,
        latestAccuracy,
        attemptCount,
        isElgible,
        weakAreas: freq,
        generatedQuiz
      }
    })

  }catch(err){
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching Adaptive eligibility",
      errors: err
    });
  }
}

exports.postAdaptiveSaveDraft = [
  check("quizId")
    .notEmpty()
    .withMessage("Quiz ID is required")
    .isMongoId()
    .withMessage("Invalid Quiz ID"),

  check("slug")
    .notEmpty()
    .withMessage("Slug is required")
    .trim()
    .matches(/^[a-z0-9-]+$/)
    .withMessage("Invalid slug"),

  check("difficulty")
    .notEmpty()
    .withMessage("Difficulty is required")
    .isIn(["easy", "medium", "hard"])
    .withMessage("Invalid difficulty"),

  check("attemptedQuestionWithAnswers")
    .isArray()
    .withMessage("attemptedQuestionWithAnswers must be an array"),

  body("attemptedQuestionWithAnswers.*.questionIndex")
    .isInt({ min: 0 })
    .withMessage("questionIndex must be a valid number"),

  body("attemptedQuestionWithAnswers.*.answer")
    .isInt({ min: 0, max: 3 })
    .withMessage("answer must be between 0 and 3"),

  check("currentQuestionIndex")
    .isInt({ min: 0 })
    .withMessage("currentQuestionIndex must be a valid number"),

  check("remainingTime")
    .isFloat({ min: 0 })
    .withMessage("remainingTime must be a valid number"),

  check("totalQuestion")
    .isInt({ min: 1 })
    .withMessage("totalQuestion must be a valid number"),

  check("timeLimit")
    .isFloat({ min: 0 })
    .withMessage("timeLimit must be a valid number"),

  async (req, res) => {
    try {
      const {
        quizId,
        slug,
        attemptedQuestionWithAnswers,
        currentQuestionIndex,
        difficulty,
        remainingTime,
        totalQuestion,
        timeLimit,
      } = req.body;

      const userId = req.user.userId;

      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(422).json({
          success: false,
          message: "Invalid input",
          errors: errors.array().map((err) => err.msg),
        });
      }

      const topic = slug
        .split("-")
        .map(
          (word) =>
            word.charAt(0).toUpperCase() + word.slice(1)
        )
        .join(" ");

      let existingDraft = await QuizSubmitModel.findOne({
        userId,
        quizId,
        userAttempt: "draft",
      });

      if (existingDraft) {
        existingDraft.answers =
          attemptedQuestionWithAnswers;

        existingDraft.draftMetadata = {
          currentQuestionIndex,
          remainingTime,
          totalQuestion,
          timeLimit,
        };

        await existingDraft.save();

        return res.status(200).json({
          success: true,
          message: "Quiz draft updated successfully",
          data: {
            submissionId: existingDraft._id,
          },
        });
      }

      const newWorkflow = new Workflow({
        userId,
        workflowType: "quiz_draft_save",
        topic,
        difficulty,
        status: "pending",
        workflowMetadata: {
          questionCount: totalQuestion,
          timeLimit,
        },
      });

      await newWorkflow.save();

      newWorkflow.status = "processing";
      newWorkflow.startedAt = new Date();

      await newWorkflow.save();

      const newQuizSubmit = new QuizSubmitModel({
        userId,
        quizId,
        workflowId: newWorkflow._id,
        topic,
        slug,
        answers: attemptedQuestionWithAnswers,

        userAttempt: "draft",

        draftMetadata: {
          currentQuestionIndex,
          remainingTime,
          totalQuestion,
          timeLimit,
        },

        status: "processing",
      });

      await newQuizSubmit.save();

      newWorkflow.status = "completed";
      newWorkflow.completedAt = new Date();

      await newWorkflow.save();

      return res.status(200).json({
        success: true,
        message: "Quiz draft saved successfully",
        data: {
          submissionId: newQuizSubmit._id,
        },
      });
    } catch (err) {
      console.log(
        "Error while saving adaptive draft:",
        err
      );

      return res.status(500).json({
        success: false,
        message:
          "Internal server error while saving quiz draft",
        errors: [err.message],
      });
    }
  },
];

exports.getAdaptiveDraft = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.userId;

    const draft = await QuizSubmitModel.findOne({
      userId,
      quizId,
      userAttempt: "draft",
    }).sort({ updatedAt: -1 });

    if (!draft) {
      return res.status(200).json({
        success: true,
        message: "No draft found",
        data: {
          hasDraft: false,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Draft found",
      data: {
        hasDraft: true,

        draft: {
          submissionId: draft._id,

          topic: draft.topic,

          slug: draft.slug,

          attemptedQuestionWithAnswers:
            draft.answers.map((item) => ({
              answer: Number(item.answer),
            })),

          currentQuestionIndex:
            draft.draftMetadata.currentQuestionIndex,

          remainingTime:
            draft.draftMetadata.remainingTime,

          totalQuestion:
            draft.draftMetadata.totalQuestion,

          timeLimit:
            draft.draftMetadata.timeLimit,

          lastSavedAt: draft.updatedAt,
        },
      },
    });
  } catch (err) {
    console.log(
      "Error while fetching adaptive draft:",
      err
    );

    return res.status(500).json({
      success: false,
      message:
        "Internal server error while fetching adaptive draft",
      errors: [err.message],
    });
  }
};