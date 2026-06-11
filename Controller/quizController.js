//External Module
const { check } = require("express-validator");
const { validationResult } = require("express-validator");

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

exports.getPopularSubject = async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ popularity: -1 }).limit(15);

    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No popular subject found for quiz",
        errors: ["QUIZ_SUBJECT_NOT_FOUND"],
      });
    }

    return res.status(200).json({
      success: true,
      message: "Popular Subjects for quiz found",
      data: {
        subjects,
      },
    });
  } catch (err) {
    return res.status(404).json({
      success: false,
      message: "Server error while finding subjects",
      errors: err,
    });
  }
};

exports.getOneSubject = async (req, res) => {
  const slug = req.params.slug;
  try {
    const subject = await Subject.findOne({ slug });
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "No subject found for quiz",
        errors: ["QUIZ_SUBJECT_NOT_FOUND"],
      });
    }

    const attempt = await QuizSubmitModel.find({
      userId: req.user.userId,
      slug: slug,
    }).sort({ createdAt: -1 });
    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "user attempts not found",
        errors: ["USER_ATTEMPT_NOT_FOUND"],
      });
    }
    const communityQuizzes = await Quiz.find({ slug })
      .select("_id title difficulty questionCount createdAt userId")
      .populate("userId", "firstName")
      .sort({ createdAt: -1 })
      .limit(10);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Community Quizzes not found",
        errors: ["QUIZZES_NOT_FOUND"],
      });
    }

    return res.status(200).json({
      success: true,
      message: "Subject for quiz found",
      data: {
        subject,
        attempt,
        communityQuizzes,
      },
    });
  } catch (err) {
    return res.status(404).json({
      success: false,
      message: "Server error while finding subjects",
      errors: err,
    });
  }
};

exports.postGenerateQuiz = [
  check("topic")
    .notEmpty()
    .withMessage("Topic Name is required")
    .trim()
    .isLength({ min: 2 })
    .withMessage("Topic Name must be at least 2 characters long")
    .matches(/^[A-Za-z ]+$/)
    .withMessage(
      "Topic Name must contain only alphabetic characters and spaces",
    ),
  check("title")
    .notEmpty()
    .withMessage("Title Name is required")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Title Name must be between 2 and 100 characters long")
    .matches(/^[A-Za-z0-9#+.-]+(?: [A-Za-z0-9#+.-]+)*$/)
    .withMessage(
      "Title Name can contain letters, numbers, spaces, +, #, . and -",
    ),
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
    .matches(/^([1-9]|[12][0-9]|30)$/)
    .withMessage("questionCount must be a number between 1 and 30"),
  async (req, res) => {
    const { topic, difficulty, questionCount, title } = req.body;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      console.log("Error is ", errors);
      return res.status(422).json({
        success: false,
        message: "Invalid input",
        errors: errors.array().map((err) => err.msg),
      });
    }

    try {
      const slug = topic
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

      const currentSubject = await Subject.findOne({ slug });
      let subjectid = null;

      if (!currentSubject) {
        const newSubject = new Subject({
          name: topic,
          slug,
          description: "",
          isSystemSubject: false,
          createdBy: req.user.userId,
          popularity: 1,
          subtopics: [],
        });
        subjectid = newSubject._id;

        await newSubject.save();
      } else {
        subjectid = currentSubject._id;
        await Subject.findByIdAndUpdate(subjectid, { $inc: { popularity: 1 } });
      }

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
        await newWorkflow.save();
        return res.status(400).json({
          success: false,
          message: "Quiz not generated",
          errors: ["RESPONSE_NOT_GENERATED"],
        });
      }

      newWorkflow.status = "completed";
      newWorkflow.completedAt = new Date();
      await newWorkflow.save();

      const tags = result.map((obj) => obj.tags);

      const quiz = await new Quiz({
        userId: req.user?.userId,
        workflowId: newWorkflow._id,
        title: title,
        topic: newWorkflow.topic,
        slug,
        difficulty: newWorkflow.difficulty,
        questions: result,
        questionCount: result.length,
        status: "generated",
        aiModelUsed: "gemini-2.5-flash",
        quizMetadata: {
          timeLimit: newWorkflow.workflowMetadata.timeLimit,
          quizMode: newWorkflow.workflowMetadata.quizMode,
          tags,
        },
      });

      await quiz.save();

      const uniqueTags = [...new Set(tags)];

      await Subject.findByIdAndUpdate(subjectid, {
        $addToSet: {
          subtopics: {
            $each: uniqueTags,
          },
        },
      });

      return res.status(200).json({
        success: true,
        message: "Quiz generated successfully",
        data: {
          quizId: quiz._id,
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
  const { topic, difficulty, answers, timeTaken } = req.body;
  const slug = topic
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

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
    let accuracy = 0;

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
    accuracy =
      (correctAnswersArr.length /
        (correctAnswersArr.length + wrongAnswersArr.length)) *
      100;
    const newQuizEvaluationModel = await new QuizSubmitModel({
      userId,
      quizId,
      workflowId: newWorkflow._id,
      answers: tempAnswers,
      topic,
      slug,
      score: {
        gain: correctAnswersArr.length,
        total: questionCount,
        accuracy,
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

    await Subject.findOneAndUpdate(
      { slug },
      {
        $inc: { popularity: 1 },
      },
    );

    return res.status(200).json({
      success: true,
      message: "Quiz evaluation successfully",
      data: {
        submittionId: newQuizEvaluationModel._id,
        score: correctAnswersArr.length,
        maxScore: questionCount,
        topic,
        difficulty,
        timeTaken,
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

exports.getQuizResult = async (req, res) => {
  const submittionid = req.params.submittionid;
  try {
    const result = await QuizSubmitModel.findById(submittionid);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Quiz submittion not found",
        errors: err,
      });
    }
    const slug = result.slug;

    const allPrevResults = await QuizSubmitModel.find({
      slug,
      status: "completed",
    })
      .sort({ createdAt: -1 })
      .limit(5);
    let eligible = false;
    let prevAccuracy = 0;
    let attempts = 0;
    if (!allPrevResults) {
      eligible = false;
    } else {
      if (allPrevResults.length >= 5) {
        eligible = true;
      }
      attempts = allPrevResults.length;
      prevAccuracy =
        (allPrevResults[1].correctAnswers.length /
          (allPrevResults[1].correctAnswers.length +
            allPrevResults[1].wrongAnswers.length)) *
        100;
    }

    const currentAccuracy =
      (result.correctAnswers.length /
        (result.correctAnswers.length + result.wrongAnswers.length)) *
      100;

    return res.status(200).json({
      success: true,
      message: "Result found",
      data: {
        result,
        currentAccuracy,
        prevAccuracy,
        change: currentAccuracy - prevAccuracy,
        adaptiveLearning: {
          eligible,
          attemptsNeed: 5 - attempts,
        },
      },
    });
  } catch (err) {
    return res.status(404).json({
      success: false,
      message: "Server error while finding quiz result",
      errors: err,
    });
  }
};

exports.postWeakAreasPractise = async (req, res) => {
  const userId = req.user.userId;
  const topic = req.params.topic;
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

    const userAttempt = await QuizSubmitModel.find({ userId, topic })
      .sort({ createdAt: -1 })
      .limit(3);
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

    const strongAreaPortion = 40;
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
        result,
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

exports.getOneQuiz = async (req, res) => {
  const quizId = req.params.quizId;
  try {
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "No Quiz found with given Id",
        errors: ["QUIZ_NOT_FOUND"],
      });
    }

    return res.status(200).json({
      success: true,
      message: "Quiz found for given Id",
      data: {
        quiz,
      },
    });
  } catch (err) {
    return res.status(404).json({
      success: false,
      message: "Server error while finding quiz",
      errors: err,
    });
  }
};

exports.getAllSubmittions = async (req, res) => {
  const userId = req.user.userId;
  try {
    const allSubmittions = await QuizSubmitModel.find({
      userId,
      status: "completed",
    }).sort({ createdAt: -1 });

    if (
      !allSubmittions ||
      !Array.isArray(allSubmittions) ||
      allSubmittions.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message: "Server error while finding quiz",
        errors: ["NO_HISTORY_FOUND"],
      });
    }

    return res.status(200).json({
      success: true,
      message: "User submittion history found",
      data: {
        submissions: allSubmittions,
      },
    });
  } catch (err) {
    return res.status(404).json({
      success: false,
      message: "Server error while finding history",
      errors: err,
    });
  }
};

exports.getHome = async (req, res) => {
  try {
    const userId = req.user.userId;

    const submissions = await QuizSubmitModel.find({
      userId,
      status: "completed",
    }).sort({ createdAt: -1 });

    const totalAttempts = submissions.length;

    let totalAccuracy = 0;

    submissions.forEach((submission) => {
      totalAccuracy += submission.score?.accuracy || 0;
    });

    const averageAccuracy =
      totalAttempts > 0 ? Math.floor(totalAccuracy / totalAttempts) : 0;

    const continueLearning = [];

    const trendingSubjectsDB = await Subject.find()
      .select("slug name popularity")
      .sort({ popularity: -1 })
      .limit(4);

    const trendingSubjects = await Promise.all(
      trendingSubjectsDB.map(async (subject) => {
        const quizCount = await Quiz.countDocuments({
          slug: subject.slug,
        });

        return {
          slug: subject.slug,
          title: subject.name,
          popularity: subject.popularity,
          quizCount,
        };
      }),
    );

    const weakFreq = {};

    submissions.forEach((submission) => {
      const subject = submission.topic;

      if (!weakFreq[subject]) {
        weakFreq[subject] = {};
      }

      submission.weakAreas.forEach((area) => {
        weakFreq[subject][area] = (weakFreq[subject][area] || 0) + 1;
      });
    });

    const recommendations = Object.entries(weakFreq)
      .map(([subject, areas]) => {
        const sortedAreas = Object.entries(areas).sort((a, b) => b[1] - a[1]);

        const totalFrequency = sortedAreas.reduce(
          (sum, [, count]) => sum + count,
          0,
        );

        return {
          subject,
          totalFrequency,
          areas: sortedAreas.slice(0, 3).map(([area]) => area),
        };
      })
      .sort((a, b) => b.totalFrequency - a.totalFrequency)
      .slice(0, 3)
      .map((item) => ({
        subject: item.subject,
        areas: item.areas,
      }));

    const strengthFreq = {};

    submissions.forEach((submission) => {
      const subject = submission.topic;

      if (!strengthFreq[subject]) {
        strengthFreq[subject] = {};
      }

      submission.correctAnswers.forEach((answer) => {
        if (!answer.tags) return;

        answer.tags.forEach((tag) => {
          strengthFreq[subject][tag] = (strengthFreq[subject][tag] || 0) + 1;
        });
      });
    });

    const strengths = Object.entries(strengthFreq)
      .map(([subject, areas]) => {
        const sortedAreas = Object.entries(areas).sort((a, b) => b[1] - a[1]);

        const totalFrequency = sortedAreas.reduce(
          (sum, [, count]) => sum + count,
          0,
        );

        return {
          subject,
          totalFrequency,
          areas: sortedAreas.slice(0, 3).map(([area]) => area),
        };
      })
      .sort((a, b) => b.totalFrequency - a.totalFrequency)
      .slice(0, 3)
      .map((item) => ({
        subject: item.subject,
        areas: item.areas,
      }));

    let summary = "Keep practicing consistently to improve your performance.";

    if (recommendations.length > 0) {
      summary = `Your recent attempts suggest revisiting ${recommendations[0].subject} fundamentals before progressing further.`;
    }

    const insights = {
      summary,
      strengths,
      focusAreas: recommendations,
    };

    return res.status(200).json({
      success: true,

      data: {
        overview: {
          totalAttempts,
          averageAccuracy,
        },

        continueLearning,

        trendingSubjects,

        recommendations,

        insights,
      },
    });
  } catch (error) {
    console.error("getHome Error:", error);

    return res.status(500).json({
      success: false,
      errors: ["Failed to fetch home data."],
    });
  }
};
