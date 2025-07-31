const express = require("express");
const app = express();

const PORT = process.env.PORT || 3001;

app.get("api/healthcheck", (req, res) => {
  res.json({
    message: "Up and running",
  });
});

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});
