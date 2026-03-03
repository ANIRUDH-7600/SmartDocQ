const pino = require("pino");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: undefined,
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "password", "token"],
    remove: true,
  },
});

module.exports = logger;
