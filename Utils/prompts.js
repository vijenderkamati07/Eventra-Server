exports.generateQuizPrompt = (topic, difficulty, questionCount) => {
  return `Generate ${questionCount} ${difficulty} level multiple-choice quiz questions on the topic "${topic}".

IMPORTANT RULES:
- Return ONLY valid JSON.
- Do not add markdown.
- Do not add explanation outside JSON.
- Do not include any text before or after the JSON.

The response MUST follow this exact structure:

{
  "timeLimit": number,
  "questions": [
    {
      "question": string,
      "options": [string, string, string, string],
      "correctAnswer": number,
      "explanation": string,
      "tags": [string]
    }
  ]
}

Rules:
- Generate exactly ${questionCount} questions.
- The difficulty level must be "${difficulty}".
- "correctAnswer" must be the INDEX (0-3) of the correct option.
- "options" must always contain exactly 4 choices.
- "explanation" should briefly explain why the answer is correct.
- "tags" should contain 1-3 subtopic names relevant to the question.
- "timeLimit" should be the recommended total quiz duration in minutes based on the question count and difficulty level.
- Ensure the JSON is valid and parsable.

Example:

{
  "timeLimit": 12,
  "questions": [
    {
      "question": "What is DBMS?",
      "options": [
        "Database Management System",
        "Data Backup Management Service",
        "Digital Binary Memory Storage",
        "Distributed Base Model System"
      ],
      "correctAnswer": 0,
      "explanation": "DBMS stands for Database Management System.",
      "tags": ["DBMS Fundamentals"]
    }
  ]
}`;
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

- Generate a minimum of 10 questions.
- You may generate more questions if required for better learning coverage.
- Focus mainly on weak concepts.
- Do NOT generate questions only from weak areas.
- Include reinforcement questions from other important concepts of the topic.
- Prioritize concepts with higher weakness frequency.
- Questions should match the adaptive difficulty level.
- Questions should be conceptually diverse.
- Avoid duplicate or repeated questions.
- Make questions educational and realistic.

QUESTION DISTRIBUTION RULES:

- Around ${generationStrategy.weakAreaFocusPercentage}% of questions should focus on weak areas.
- Around ${generationStrategy.reinforcementPercentage}% of questions should reinforce other important concepts of the topic.

IMPORTANT RESPONSE RULES:

- Return ONLY valid JSON.
- Do NOT return markdown.
- Do NOT add explanations outside JSON.
- Do NOT include any text before or after the JSON.

The response MUST follow this EXACT structure:

{
  "timeLimit": number,
  "questions": [
    {
      "question": string,
      "options": [string, string, string, string],
      "correctAnswer": number,
      "explanation": string,
      "tags": [string]
    }
  ]
}

QUESTION RULES:

- Generate at least 10 questions.
- "question" must be clear and unambiguous.
- "options" must always contain exactly 4 options.
- "correctAnswer" must be the INDEX NUMBER (0-3) of the correct option.
- "explanation" should briefly explain why the answer is correct.
- "tags" must contain 1 to 3 related subtopics/concepts as an array of strings.

TIME LIMIT RULE:

- Recommend a suitable total quiz duration in minutes based on:
  - Number of generated questions
  - Adaptive difficulty level
  - Additional thinking time required for weak-area practice

EXAMPLE RESPONSE:

{
  "timeLimit": like 15 in minutes,
  "questions": [
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
        "OOP Principles"
      ]
    }
  ]
}

Generate the adaptive quiz now.
`;
};
