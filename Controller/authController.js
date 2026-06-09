//External Module
const { check } = require("express-validator");
const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");

//Local Module
const User = require("../Model/userModel");
const { generateToken } = require("../Utils/generateToken");

exports.getMe = async (req, res) => {
  try{

    const user = await User.findById(req.user.userId);

    if(!user){
      return res.status(401).json({
        success: false,
        message: "User does not exists",
        errors: ["USER_NOT_FOUND"],
      });
    }
    return res.status(200).json({
      success: true,
      message: "User detail found",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          email: user.email,
        },
      },
    });
  }catch(err){
    return res.status(500).json({
        success: false,
        message: "Error while finding user",
        errors: ["INTERNAL_SERVER_ERROR"],
      });
  }
}


exports.postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        errors: ["USER_NOT_FOUND"],
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Email or Password does not match",
        errors: ["INVALID_CREDENTIALS"],
      });
    }
    const token = generateToken(user._id, user.email);

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    console.log('login Success');

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          name: user.firstName,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error while login",
    });
  }
};

exports.postLogout = async (req, res) => {
    res.clearCookie("token");
    return res.json({
      success: true,
      message: "Logged out successfully",
    });
};

exports.postSignup = [
  check("firstName")
    .notEmpty()
    .withMessage("First Name is required")
    .trim()
    .isLength({ min: 2 })
    .withMessage("First Name must be at least 2 characters long")
    .matches(/^[A-Za-z]+$/)
    .withMessage("First Name must contain only alphabetic characters"),

  check("lastName")
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[A-Za-z]+$/)
    .withMessage("Last Name must contain only alphabetic characters"),

  check("email")
    .isEmail()
    .withMessage("Please enter a valid email address")
    .normalizeEmail(),

  check("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number")
    .matches(/[\W_]/)
    .withMessage("Password must contain at least one special character"),

  check("confirmPassword")
    .trim()
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),

  check("terms").custom((value) => {
    if (!value) {
      throw new Error("You must accept the terms and conditions");
    }
    return true;
  }),
  (req, res) => {
    const { firstName, lastName, email, password, confirmPassword } = req.body;
    console.log("cgeck start", req.body);
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      console.log(errors.array().map((err) => err.msg));
      return res.status(422).json({
        success: false,
        message: "Invalid input",
        errors: errors.array().map((err) => err.msg),
      });
    }
    console.log("requested for signup")

    bcrypt
      .hash(password, 12)
      .then((hashedPassword) => {
        const newUser = new User({
          firstName,
          lastName,
          email,
          password: hashedPassword,
        });
        return newUser.save();
      })
      .then(() => {
        console.log("User registered successfully");
        res.status(201).json({
          success: true,
          message: "User Created",
        });
      })
      .catch((err) => {
        console.log("Error registering user:", err);
        return res.status(400).json({
          success: false,
          message: "Internal server error",
        });
      });
  },
];
