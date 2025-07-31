const express = require("express");
const cors = require("cors");
const multer = require("multer");
const randomString = require("./utils/randomString.js");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, __dirname + "/uploads");
  },
  filename: (req, file, cb) => {
    cb(null, randomString(16) + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3001;

app.get("/api/healthcheck", (req, res) => {
  res.json({
    message: "Up and running",
  });
});

app.post("/api/upload", upload.single("file"), (req, res, next) => {
  console.log("Request received", req.file);
  const fileId = randomString(16);
  const fileName = req.file.originalname;
  const fileSize = req.file.size;
  const fileType = req.file.mimetype;
  res.json({
    message: `File ${fileId} received`,
    fileName,
    fileSize,
    fileType,
  });
});
app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});
