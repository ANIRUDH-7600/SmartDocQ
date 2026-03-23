function sendError(res, statusCode, message, errors) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors: Array.isArray(errors) ? errors : [],
  });
}

function sendSuccess(res, statusCode, data = {}, message) {
  const payload = { success: true };
  if (message) payload.message = message;
  if (data && typeof data === "object") {
    Object.assign(payload, data);
  }
  return res.status(statusCode).json(payload);
}

module.exports = { sendError, sendSuccess };
