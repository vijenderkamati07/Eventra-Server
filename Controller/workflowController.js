//External Module

//Local Module
const Workflow = require("../Model/workFlowModel");

exports.postWorkflow = async (req, res) => {
  const { title, inputText, type } = req.body;
  const { userId } = req.user;

  try {
    const new_workflow = await new Workflow({
      userId,
      title,
      inputText,
      type,
      status: "pending",
      result: "",
    });

    await new_workflow.save();
    return res.status(201).json({
      success: true,
      message: "Your workflow is created",
      data: {
        new_workflow,
      },
    });
  } catch (err) {
    console.log("Error while creating workflow: ", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      errors: ["WORKFLOW_CREATION_ERROR"],
    });
  }
};

exports.getWorkflows = async (req, res) => {
  const { userId } = req.user;

  try {
    const myworkflows = await Workflow.find({ userId }).sort({
      createdAt: -1,
    });

    if (!myworkflows) {
      return res.status(400).json({
        success: false,
        message: "You have not any workflow yet",
        errors: ["NOT_WORKFLOW_FOUND"],
      });
    }

    return res.status(200).json({
      success: true,
      message: "Workflow found",
      data: {
        myworkflows,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      errors: ["SERVER_ERROR_WHILE_FECHING_WORKFLOWS"],
    });
  }
};

exports.getOneWorkflow = async (req, res) => {
  const { userId } = req.user;
  const id = req.params.id;
  
      console.log(req.params.id);


  try {

    const myOneWorkflow = await Workflow.findById(id);
    
      console.log(myOneWorkflow)

    if(!myOneWorkflow){
      return res.status(400).json(
        {
          success: false,
          message: 'This workflow is not exists',
          errors: ['NOT_FOUND']
        }
      )
    }

    if(myOneWorkflow.userId!=userId){
      return res.status(401).json(
        {
          success: false,
          message: 'You are trying to access someone else resource',
          errors: ['UNAUTHORIZED_ACCESS']
        }
      )
    }

    return res.status(200).json({
      success: true,
      message: "Workflow found",
      data: {
        myOneWorkflow,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      errors: ["SERVER_ERROR_WHILE_FECHING_WORKFLOWS"],
    });
  }
};