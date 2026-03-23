const { z } = require("zod");

// Shared ObjectId validator for route params
const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

// Generic schema for routes that use ":id" in params
const idParamSchema = z.object({
  params: z.object({
    id: objectId,
  }),
});

module.exports = {
  idParamSchema,
};
