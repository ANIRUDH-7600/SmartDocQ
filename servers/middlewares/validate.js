const { ZodError } = require("zod");
const { sendError } = require("./apiResponse");

// Generic Zod-based validation middleware
// Schemas should be defined against an object: { body, query, params, headers }
function validate(schema) {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers,
      });

      // Attach validated, sanitized data without mutating the original request
      req.validated = parsed;

      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        return sendError(
          res,
          400,
          "Validation error",
          err.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
            code: e.code,
          }))
        );
      }
      return sendError(res, 400, "Invalid request");
    }
  };
}

// Optional helper: returns [validate(schema), controller]
function createRoute(schema, controller) {
  return [validate(schema), controller];
}

module.exports = { validate, createRoute };
