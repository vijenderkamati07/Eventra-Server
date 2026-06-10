// External Modules
require("dotenv").config();
const mongoose = require("mongoose");

// Local Modules
const Subject = require("../Model/subjectModel");

const subjects = [
  {
    name: "DBMS",
    slug: "dbms",
    description: "Learn database concepts and SQL.",
    popularity: 96,
  },
  {
    name: "Object-Oriented Programming",
    slug: "object-oriented-programming",
    description: "Learn OOP principles and concepts.",
    popularity: 92,
  },
  {
    name: "Operating Systems",
    slug: "operating-systems",
    description: "Learn processes, threads and scheduling.",
    popularity: 88,
  },
  {
    name: "Computer Networks",
    slug: "computer-networks",
    description: "Learn networking fundamentals.",
    popularity: 82,
  },
  {
    name: "Data Structures and Algorithms",
    slug: "data-structures-and-algorithms",
    description: "Practice DSA concepts.",
    popularity: 99,
  },
  {
    name: "Java",
    slug: "java",
    description: "Java programming language.",
    popularity: 90,
  },
  {
    name: "Python",
    slug: "python",
    description: "Python programming language.",
    popularity: 94,
  },
  {
    name: "SQL",
    slug: "sql",
    description: "Structured Query Language.",
    popularity: 80,
  },
  {
    name: "JavaScript",
    slug: "javascript",
    description: "JavaScript programming language.",
    popularity: 93,
  },
  {
    name: "Node.js",
    slug: "node-js",
    description: "Backend development using Node.js.",
    popularity: 78,
  },
  {
    name: "React",
    slug: "react",
    description: "Frontend development using React.",
    popularity: 85,
  },
  {
    name: "Express.js",
    slug: "express-js",
    description: "Build APIs using Express.js.",
    popularity: 70,
  },
  {
    name: "MongoDB",
    slug: "mongodb",
    description: "Learn NoSQL database concepts.",
    popularity: 76,
  },
  {
    name: "MySQL",
    slug: "mysql",
    description: "Learn relational database concepts.",
    popularity: 84,
  },
  {
    name: "C Programming",
    slug: "c-programming",
    description: "Programming fundamentals using C.",
    popularity: 75,
  },
  {
    name: "C++",
    slug: "cpp",
    description: "Object-oriented programming with C++.",
    popularity: 83,
  },
  {
    name: "Machine Learning",
    slug: "machine-learning",
    description: "Introduction to ML concepts and algorithms.",
    popularity: 87,
  },
  {
    name: "Artificial Intelligence",
    slug: "artificial-intelligence",
    description: "Explore AI concepts and applications.",
    popularity: 89,
  },
  {
    name: "Cloud Computing",
    slug: "cloud-computing",
    description: "Learn cloud concepts and services.",
    popularity: 72,
  },
  {
    name: "AWS",
    slug: "aws",
    description: "Amazon Web Services fundamentals.",
    popularity: 68,
  },
  {
    name: "Docker",
    slug: "docker",
    description: "Containerization using Docker.",
    popularity: 66,
  },
  {
    name: "Kubernetes",
    slug: "kubernetes",
    description: "Container orchestration with Kubernetes.",
    popularity: 61,
  },
  {
    name: "Cyber Security",
    slug: "cyber-security",
    description: "Learn security principles and practices.",
    popularity: 74,
  },
  {
    name: "System Design",
    slug: "system-design",
    description: "Design scalable distributed systems.",
    popularity: 79,
  },
  {
    name: "Git & GitHub",
    slug: "git-github",
    description: "Version control and collaboration.",
    popularity: 73,
  },
  {
    name: "Redis",
    slug: "redis",
    description: "In-memory data structures and caching.",
    popularity: 58,
  },
  {
    name: "REST APIs",
    slug: "rest-apis",
    description: "Design and consume RESTful APIs.",
    popularity: 77,
  },
  {
    name: "Software Engineering",
    slug: "software-engineering",
    description: "Software development principles and practices.",
    popularity: 71,
  },
  {
    name: "Aptitude",
    slug: "aptitude",
    description: "Quantitative aptitude and reasoning practice.",
    popularity: 81,
  },
];

async function seedSubjects() {
  try {
    // Connect DB
    await mongoose.connect(process.env.DB_BASE_URL);

    console.log("MongoDB Connected");

    for (const subject of subjects) {

      // Check if already exists
      const exists = await Subject.findOne({
        slug: subject.slug,
      });

      if (exists) {
        console.log(`Skipped: ${subject.name}`);
        continue;
      }

      // Insert
      await Subject.create({
        ...subject,
        isSystemSubject: true,
        popularity: 0,
        createdBy: null,
        subtopics: [],
      });

      console.log(`Added: ${subject.name}`);
    }

    console.log("Subject seeding completed.");

  } catch (err) {
    console.log("Error while seeding:", err);

  } finally {

    await mongoose.disconnect();

    console.log("MongoDB Disconnected");
  }
}

seedSubjects();