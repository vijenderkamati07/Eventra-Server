//External Module
const { check } = require("express-validator");
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

    console.log("result revieved");

    if (!result || !Array.isArray(result) || result.length === 0) {
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
      quizType: 'adaptive',
      title: title,
      topic,
      slug,
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
        generatedFromSubmissions: userAttempt.map((obj) => obj._id),
        weakAreaFocus: Object.keys(freq),
        adaptiveDifficulty: difficultyLevel,
      },
    });
    await quiz.save();

    console.log("Quiz created");

    newWorkflow.difficulty = difficultyLevel;
    newWorkflow.status = "completed";
    newWorkflow.workflowMetadata.questionCount = result.length;
    newWorkflow.workflowMetadata.timeLimit = result.length;
    newWorkflow.completedAt = new Date();
    await newWorkflow.save();

    console.log("response send");

    return res.status(200).json({
      success: true,
      message: "Weak Area Quiz generated",
      data: {
        quizId : quiz._id,
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

    if(lastAdpativeQuiz){
      generatedQuiz.exists = true;
      generatedQuiz.quizId = lastAdpativeQuiz._id;
      generatedQuiz.questionCount = lastAdpativeQuiz.questionCount;
      generatedQuiz.estimatedTime = lastAdpativeQuiz.questionCount;
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