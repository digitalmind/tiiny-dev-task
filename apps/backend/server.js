const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, __dirname + "/uploads/files");
  },
  filename: (req, file, cb) => {
    cb(null, randomString(16) + "-" + file.originalname);
  },
});
const chunkUpload = multer().single("chunkData");

const upload = multer({ storage: storage });

const randomString = require("./utils/randomString.js");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Ensure uploads directory structure exists
const uploadsDir = path.join(__dirname, "uploads");
const filesDir = path.join(uploadsDir, "files");
const chunksDir = path.join(uploadsDir, "chunks");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(filesDir)) {
  fs.mkdirSync(filesDir, { recursive: true });
}
if (!fs.existsSync(chunksDir)) {
  fs.mkdirSync(chunksDir, { recursive: true });
}

app.get("/api/health-check", (req, res) => {
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

app.post("/api/upload-chunks", chunkUpload, (req, res) => {
  const { fileId, chunkIndex, totalChunks, fileName, totalSize } = req.body;

  if (!fileId || chunkIndex === undefined || !totalChunks || !fileName) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const chunkDir = path.join(chunksDir, fileId);
  const chunkPath = path.join(chunkDir, `chunk-${chunkIndex}`);
  const metadataPath = path.join(chunkDir, "metadata.json");

  try {
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }

    const metadata = {
      fileName,
      totalChunks: parseInt(totalChunks),
      totalSize: parseInt(totalSize),
      uploadedChunks: [],
      createdAt: new Date().toISOString(),
    };

    if (fs.existsSync(metadataPath)) {
      const existingMetadata = JSON.parse(
        fs.readFileSync(metadataPath, "utf8")
      );
      metadata.uploadedChunks = existingMetadata.uploadedChunks || [];
    }

    if (!metadata.uploadedChunks.includes(parseInt(chunkIndex))) {
      metadata.uploadedChunks.push(parseInt(chunkIndex));
    }

    if (req.file) {
      const chunkBuffer = req.file.buffer;
      fs.writeFileSync(chunkPath, chunkBuffer);
    }

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    const isComplete = metadata.uploadedChunks.length === metadata.totalChunks;

    res.json({
      success: true,
      chunkIndex: parseInt(chunkIndex),
      uploadedChunks: metadata.uploadedChunks,
      isComplete,
      message: isComplete
        ? "All chunks received, file ready for assembly"
        : "Chunk uploaded successfully",
    });
  } catch (error) {
    console.error("Chunk upload error:", error);
    res.status(500).json({ error: "Failed to save chunk" });
  }
});

app.post("/api/assemble-chunks", (req, res) => {
  const { fileId } = req.body;

  if (!fileId) {
    return res.status(400).json({ error: "Missing fileId" });
  }

  const chunkDir = path.join(chunksDir, fileId);
  const metadataPath = path.join(chunkDir, "metadata.json");

  try {
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ error: "File metadata not found" });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

    if (metadata.uploadedChunks.length !== metadata.totalChunks) {
      return res.status(400).json({
        error: "Not all chunks uploaded",
        uploadedChunks: metadata.uploadedChunks,
        totalChunks: metadata.totalChunks,
      });
    }
    const finalFileName = `${randomString(16)}-${metadata.fileName}`;
    const finalFilePath = path.join(filesDir, finalFileName);
    const writeStream = fs.createWriteStream(finalFilePath);

    for (let i = 0; i < metadata.totalChunks; i++) {
      const chunkPath = path.join(chunkDir, `chunk-${i}`);
      if (fs.existsSync(chunkPath)) {
        const chunkData = fs.readFileSync(chunkPath);
        writeStream.write(chunkData);
      }
    }

    writeStream.end();

    writeStream.on("finish", () => {
      fs.rmSync(chunkDir, { recursive: true, force: true });

      res.json({
        success: true,
        fileName: finalFileName,
        originalName: metadata.fileName,
        size: metadata.totalSize,
        message: "File assembled successfully",
      });
    });

    writeStream.on("error", (error) => {
      console.error("File assembly error:", error);
      res.status(500).json({ error: "Failed to assemble file" });
    });
  } catch (error) {
    console.error("Chunk assembly error:", error);
    res.status(500).json({ error: "Failed to assemble chunks" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});
