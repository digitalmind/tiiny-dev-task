require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  forcePathStyle: false, // Configures to use subdomain/virtual calling format.
  ...(process.env.S3_ENDPOINT && { endpoint: process.env.S3_ENDPOINT }),
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "your-upload-bucket";

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

  const uploadChunkToS3 = async () => {
    try {
      const chunkKey = `chunks/${fileId}/chunk-${chunkIndex}`;

      if (req.file) {
        const uploadParams = {
          Bucket: BUCKET_NAME,
          Key: chunkKey,
          Body: req.file.buffer,
          ContentType: "application/octet-stream",
        };

        await s3Client.send(new PutObjectCommand(uploadParams));
        console.log(`Chunk ${chunkIndex} uploaded to S3: ${chunkKey}`);
      }

      const metadataKey = `metadata/${fileId}.json`;
      let metadata = {
        fileName,
        totalChunks: parseInt(totalChunks),
        totalSize: parseInt(totalSize),
        uploadedChunks: [],
        createdAt: new Date().toISOString(),
      };

      try {
        const existingMetadata = await s3Client.send(
          new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: metadataKey,
          })
        );

        const metadataString = await existingMetadata.Body.transformToString();
        metadata = JSON.parse(metadataString);
      } catch (error) {
        if (
          error.name === "NoSuchKey" ||
          error.$metadata?.httpStatusCode === 404
        ) {
          // Metadata doesn't exist yet, use the default metadata we created above
          console.log(`Creating new metadata for file ${fileId}`);
        } else {
          throw error;
        }
      }

      if (!metadata.uploadedChunks.includes(parseInt(chunkIndex))) {
        metadata.uploadedChunks.push(parseInt(chunkIndex));
      }

      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: metadataKey,
          Body: JSON.stringify(metadata, null, 2),
          ContentType: "application/json",
        })
      );

      const isComplete =
        metadata.uploadedChunks.length === metadata.totalChunks;

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
      console.error("S3 upload error:", error);
      res.status(500).json({ error: "Failed to upload chunk to S3" });
    }
  };

  uploadChunkToS3();
});

app.post("/api/assemble-chunks", async (req, res) => {
  const { fileId } = req.body;

  if (!fileId) {
    return res.status(400).json({ error: "Missing fileId" });
  }

  try {
    const metadataKey = `metadata/${fileId}.json`;

    const metadataResponse = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: metadataKey,
      })
    );

    const metadataString = await metadataResponse.Body.transformToString();
    const metadata = JSON.parse(metadataString);

    if (metadata.uploadedChunks.length !== metadata.totalChunks) {
      return res.status(400).json({
        error: "Not all chunks uploaded",
        uploadedChunks: metadata.uploadedChunks,
        totalChunks: metadata.totalChunks,
      });
    }

    const finalFileName = `${randomString(16)}-${metadata.fileName}`;
    const finalFileKey = `files/${finalFileName}`;

    const assembledChunks = [];

    for (let i = 0; i < metadata.totalChunks; i++) {
      const chunkKey = `chunks/${fileId}/chunk-${i}`;

      const chunkResponse = await s3Client.send(
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: chunkKey,
        })
      );

      const chunkBuffer = await chunkResponse.Body.transformToByteArray();
      assembledChunks.push(Buffer.from(chunkBuffer));
    }

    const finalFileBuffer = Buffer.concat(assembledChunks);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: finalFileKey,
        Body: finalFileBuffer,
        ContentType: "application/octet-stream",
      })
    );

    const chunksPrefix = `chunks/${fileId}/`;

    const listChunksResponse = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: chunksPrefix,
      })
    );

    const deletePromises = listChunksResponse.Contents.map((obj) =>
      s3Client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: obj.Key,
        })
      )
    );

    await Promise.all(deletePromises);
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: metadataKey,
      })
    );

    res.json({
      success: true,
      fileName: finalFileName,
      originalName: metadata.fileName,
      size: metadata.totalSize,
      s3Key: finalFileKey,
      message: "File assembled and uploaded to S3 successfully",
    });
  } catch (error) {
    console.error("S3 assembly error:", error);
    res.status(500).json({ error: "Failed to assemble file in S3" });
  }
});

app.get("/api/upload-progress/:fileId", async (req, res) => {
  const { fileId } = req.params;
  const metadataKey = `metadata/${fileId}.json`;

  try {
    const metadataResponse = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: metadataKey,
      })
    );

    const metadataString = await metadataResponse.Body.transformToString();
    const metadata = JSON.parse(metadataString);

    res.json({
      fileId,
      fileName: metadata.fileName,
      uploadedChunks: metadata.uploadedChunks,
      totalChunks: metadata.totalChunks,
      progress: (metadata.uploadedChunks.length / metadata.totalChunks) * 100,
    });
  } catch (error) {
    if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: "Upload not found" });
    }
    console.error("Progress check error:", error);
    res.status(500).json({ error: "Failed to get progress" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});
