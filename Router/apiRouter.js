//External Module
const express = require('express');

//Local Modules -> Controllers
const { postLogin, postSignup, postLogout } = require('../Controller/authController');
const { postWorkflow, getWorkflows, getOneWorkflow } = require('../Controller/workflowController');
const { isAuth } = require('../Middleware/isAuth');


const apiRouter = express.Router();

//Auth router
apiRouter.post('/user/signup', postSignup);
apiRouter.post('/user/login', postLogin);
apiRouter.post('/user/logout', postLogout);

//Workflow Routes
apiRouter.post('/create-workflows',isAuth, postWorkflow);//purpose-> add workflow
apiRouter.get('/myworkflows', isAuth, getWorkflows);//purpose-> get one user all workflows
apiRouter.get('/workflow/:id', isAuth, getOneWorkflow);

module.exports = apiRouter;