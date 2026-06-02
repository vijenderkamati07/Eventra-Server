const jwt = require('jsonwebtoken');
const dotenev = require("dotenv").config();

exports.generateToken = (userId, email) =>{
  const token = jwt.sign(
    {
      userId: userId,
      email: email
    },
    process.env.JWT_KEY,
    {
      expiresIn: '7d'
    }
  )
  return token;
}