const jwt = require('jsonwebtoken');
const dotenev = require("dotenv").config();

exports.isAuth = (req, res, next)=>{
  const token = req.cookies?.token;

  if(!token){
    return res.status(401).json(
      {
        success: false,
        message: "Not authenticated",
        errors: ["NOT_AUTHENTICATED"]
      }
    );
  }

  try{

    const decode = jwt.verify(token, process.env.JWT_KEY);
    req.user=decode;
    next();

  }catch(err){
    return res.status(401).json(
      {
        success: false,
        message: "Not Authenticates",
        errors: ["TOKEN_NOT_FOUND_OR_EXPIRE"]
      }
    );
  }
} 
