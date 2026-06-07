// External Modules
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenev = require("dotenv").config();

//Prompts
const { generateQuizPrompt, evaluateWeakAreasPrompt, generateWeakAreasQuiz } = require('../Utils/prompts')

const genAI = new GoogleGenerativeAI(process.env.AI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

// Main Quiz Generation Service
exports.generateQuiz = async (
  topic,
  difficulty = "medium",
  questionCount = 10
) => {
  try {
    const prompt = generateQuizPrompt(topic, difficulty, questionCount);

    const result = await model.generateContent(prompt);

    const response = result.response.text();

    const cleanedResponse = response
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const quizData = JSON.parse(cleanedResponse);

    return quizData;

  } catch (err) {
    console.error("AI Quiz Generation Error:", err);
    throw new Error("QUIZ_GENERATION_FAILED");
  }
};

exports.evaluateQuiz = async (wrongAnswers) =>{

  try{

    const prompt = evaluateWeakAreasPrompt(wrongAnswers);

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    const cleanedResponse = response
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const weakAreaData = JSON.parse(cleanedResponse);

    return weakAreaData;

  }catch(err){
    console.log("Error while evaluating quiz by AI");
    throw new Error("Evaluation failed")
  }

}

exports.generateWeakAreasQuiz = async (
  topic, 
  adaptiveDifficulty,
  weakAreas,
  generationStrategy
) => {
  try{
  const prompt = generateWeakAreasQuiz(topic, adaptiveDifficulty,weakAreas, generationStrategy);

      const result = await model.generateContent(prompt);

      const response = result.response.text();

      const cleanedResponse = response
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const quizData = JSON.parse(cleanedResponse);

      return quizData;

    } catch (err) {
      console.error("AI Weak Areas Quiz Generation Error:", err);
      throw new Error("QUIZ_GENERATION_FAILED");
    }
}