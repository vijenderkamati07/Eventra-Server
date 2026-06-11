// External Modules
require("dotenv").config();
const mongoose = require("mongoose");

// Local Modules
const QuizSubmit = require("../Model/quizSubmitModel");

async function addAccuracyField() {
  try {
    // Connect DB
    await mongoose.connect(process.env.DB_BASE_URL);

    console.log("MongoDB Connected");

    const result = await QuizSubmit.collection.updateMany(
      {},
      [
        {
          $set: {
            "score.accuracy": {
              $cond: [
                { $eq: ["$score.total", 0] },
                0,
                {
                  $round: [
                    {
                      $multiply: [
                        {
                          $divide: [
                            "$score.gain",
                            "$score.total",
                          ],
                        },
                        100,
                      ],
                    },
                    0, // 0 decimal places
                  ],
                },
              ],
            },
          },
        },
      ]
    );

    console.log(
      `Updated ${result.modifiedCount} documents out of ${result.matchedCount} matched documents.`
    );
  } catch (err) {
    console.error(
      "Error while updating accuracy:",
      err
    );
  } finally {
    await mongoose.disconnect();

    console.log("MongoDB Disconnected");
  }
}

addAccuracyField();