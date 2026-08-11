const { createApp } = require("../src/app");

let app;

try {
  app = createApp();
} catch (error) {
  console.error("Failed to boot WorkNest API:", error);
  module.exports = (req, res) => {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        success: false,
        message: "API failed to start",
        error: error?.message || "Unknown boot error",
      })
    );
  };
  return;
}

module.exports = app;
