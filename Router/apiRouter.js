//External Module
const express = require('express');

//Local Modules -> Controllers
const { postLogin, postSignup, postLogout, getMe } = require('../Controller/authController');
const { postGenerateQuiz, postEvaluateQuiz, postWeakAreasPractise, getPopularSubject, getOneSubject, getOneQuiz } = require('../Controller/quizController');
const { isAuth } = require('../Middleware/isAuth');


const apiRouter = express.Router();

//Auth router
apiRouter.post('/user/signup', postSignup);
apiRouter.post('/user/login', postLogin);
apiRouter.post('/user/logout', postLogout);
apiRouter.get('/user/me', isAuth, getMe);

//Quiz Workflow
apiRouter.post('/quizzes/generate',isAuth, postGenerateQuiz);
apiRouter.post('/quizzes/:quizId/submit',isAuth, postEvaluateQuiz);
apiRouter.post('/quizzes/regenerate/:topic',isAuth, postWeakAreasPractise);
apiRouter.get('/quizzes/popular-subjects', isAuth, getPopularSubject);
apiRouter.get('/quizzes/subjects/:slug', isAuth, getOneSubject);
apiRouter.get('/quizzes/find/:quizId', isAuth, getOneQuiz);



module.exports = apiRouter;