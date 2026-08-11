const { createApp } = require("./app");
const { env } = require("./config/env");

const app = createApp();

app.listen(env.port, () => {
  console.log(`WorkNest API listening on http://localhost:${env.port}`);
});
