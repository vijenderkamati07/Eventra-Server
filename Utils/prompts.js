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
        "correctAnswer": "Option A",
        "explanation": "DBMS stands for Database Management System."
      }
    ]
    `;
};
