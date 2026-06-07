
exports.generateQuizPrompt = (topic, difficulty, questionCount) => {
    return `Generate ${questionCount} ${difficulty} level multiple-choice quiz questions on the topic "${topic}".
    IMPORTANT RULES:
    - Return ONLY valid JSON.
    - Do not add markdown.
    - Do not add explanation outside JSON.
    - Response must be an array.

    Each question object must contain:
    - question
    - options (array of 4 options)
    - correctAnswer
    - explanation

    Example format:

    [
      {
        "question": "What is DBMS?",
        "options": [
          "Option A",
          "Option B",
          "Option C",
          "Option D"
        ],
        "correctAnswer": "give index of correct answer from options like an array",
        "explanation": "DBMS stands for Database Management System.",
        "tags" : "subtopic name like if this question is about encapsulation, then tags will be: "encapsulation""
      }
    ]
    `;
};

exports.evaluateWeakAreasPrompt = (wrongAnswers) => {
return `
      You are an AI learning evaluation assistant.

      Your task is to analyze the student's incorrect answers and identify:

      1. Weak learning areas
      2. Personalized feedback
      3. Learning recommendations

      IMPORTANT RULES:

      * Return ONLY valid JSON.
      * Do not add markdown.
      * Do not add explanations outside JSON.
      * weakAreas must be an array of strings.
      * recommendations must be an array of strings.
      * feedback must be a short paragraph.

      Student Wrong Answers Data:

      ${JSON.stringify(wrongAnswers, null, 2)}

      Expected JSON Response Format:

      {
      "weakAreas": [
      "Normalization",
      "Joins",
      "Encapsulation"
      ],

      "feedback": "The student is struggling with DBMS normalization concepts and some OOP fundamentals. More conceptual practice is recommended.",

      "recommendations": [
      "Revise normalization forms with examples",
      "Practice SQL joins questions",
      "Solve OOP concept-based MCQs"
      ]
      }
      `;
};

exports.generateWeakAreasQuiz = (
topic,
adaptiveDifficulty,
weakAreas,
generationStrategy
) => {

  return `
  You are an AI adaptive learning engine.

  Your task is to generate a personalized quiz based on the student's weak learning areas and adaptive learning strategy.

  TOPIC:
  ${topic}

  ADAPTIVE DIFFICULTY:
  ${adaptiveDifficulty}

  WEAK AREAS WITH PRIORITY:
  ${JSON.stringify(weakAreas, null, 2)}

  GENERATION STRATEGY:
  ${JSON.stringify(generationStrategy, null, 2)}

  IMPORTANT INSTRUCTIONS:

  * Generate a minimum of 10 questions.
  * You may generate more questions if required for better learning coverage.
  * Focus mainly on weak concepts.
  * Do NOT generate questions only from weak areas.
  * Include some reinforcement questions from the overall topic.
  * Prioritize concepts with higher weakness frequency.
  * Questions should match the adaptive difficulty level.
  * Questions should be conceptually diverse.
  * Avoid duplicate or repeated questions.
  * Make questions educational and realistic.

  QUESTION DISTRIBUTION RULES:

  * Around ${generationStrategy.weakAreaFocusPercentage}% questions should focus on weak areas.
  * Around ${generationStrategy.reinforcementPercentage}% questions should be reinforcement questions from other important concepts of the topic.

  IMPORTANT RESPONSE RULES:

  * Return ONLY valid JSON.
  * Do NOT return markdown.
  * Do NOT add explanations outside JSON.
  * Response must be a JSON array.
  * Each question must contain exactly:

    * question
    * options
    * correctAnswer
    * explanation
    * tags

  IMPORTANT correctAnswer RULE:

  * correctAnswer MUST be the INDEX NUMBER of the correct option.
  * Example:
    0 = first option
    1 = second option
    2 = third option
    3 = fourth option

  IMPORTANT options RULE:

  * options must always contain exactly 4 options.

  TAGS RULE:

  * tags must contain related concept/subtopic names.
  * tags must be an array of strings.

  EXAMPLE RESPONSE FORMAT:

  [
  {
  "question": "What is encapsulation in OOP?",
  "options": [
  "Binding data and methods together",
  "Creating multiple objects",
  "Connecting databases",
  "Writing APIs"
  ],
  "correctAnswer": 0,
  "explanation": "Encapsulation means binding data and methods into a single unit.",
  "tags": [
  "Encapsulation",
  "OOP"
  ]
  }
  ]

  Generate the adaptive quiz now.
  `;
};
