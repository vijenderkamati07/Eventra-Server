//External Module
const express = require('express');

//Local Modules -> Controllers
const { postLogin, postSignup, postLogout } = require('../Controller/authController');
const { postWorkflow } = require('../Controller/workflowController');
const { isAuth } = require('../Middleware/isAuth');


const apiRouter = express.Router();

//Auth router
apiRouter.post('/user/signup', postSignup);
apiRouter.post('/user/login', postLogin);
apiRouter.post('/user/logout', postLogout);

//Workflow Routes
apiRouter.post('/workflow',isAuth, postWorkflow);//Send title, inputText, type

module.exports = apiRouter;