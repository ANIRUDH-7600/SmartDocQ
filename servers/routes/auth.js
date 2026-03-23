const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const multer = require("multer");
const path = require("path");
const streamifier = require("streamifier");
const cloudinary = require('cloudinary').v2;
const Chat = require("../models/Chat");
const Document = require("../models/Document");
const ContactReport = require("../models/ContactReport");
const { OAuth2Client } = require('google-auth-library');
const logger = require("../lib/logger");
const { validate } = require("../middlewares/validate");
const { sendError, sendSuccess } = require("../middlewares/apiResponse");
const { signupSchema, loginSchema, updateMeSchema, googleSchema } = require("../validators/authSchemas");

// Cookie configuration for httpOnly auth
const isProduction = process.env.NODE_ENV === "production";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 60 * 60 * 1000, // 1 hour
  path: "/"
};

// Helper to set auth cookie
const setAuthCookie = (res, token) => {
  res.cookie("auth_token", token, COOKIE_OPTIONS);
};

// Helper to clear auth cookie
const clearAuthCookie = (res) => {
  res.clearCookie("auth_token", { ...COOKIE_OPTIONS, maxAge: 0 });
};

// Auth middleware: reads from cookie first, then Authorization header, and attaches user
async function verifyToken(req, res, next) {
  try {
    const token =
      req.cookies?.auth_token ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : null);

    if (!token) return sendError(res, 401, "Missing token");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) return sendError(res, 401, "User not found");

    req.user = user;
    req.userId = user._id;
    return next();
  } catch (err) {
    return sendError(res, 401, "Invalid or expired token");
  }
}

// Signup
router.post("/signup", validate(signupSchema), async (req, res) => {
  const { name, email, password, googleId } = req.validated.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return sendError(res, 400, "User already exists");

    // Password is optional for Google OAuth users
    if (!password && !googleId) {
      return sendError(res, 400, "Password is required for local signup");
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;
    const user = new User({ 
      name, 
      email, 
      password: hashedPassword,
      authProvider: "local"
    });
    await user.save();

    return sendSuccess(res, 201, {}, "User registered successfully");
  } catch (err) {
    sendError(res, 500, err.message || "Signup failed");
  }
});

// Login
router.post("/login", validate(loginSchema), async (req, res) => {
  const { email, password } = req.validated.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return sendError(res, 400, "User not found");

    // Block immediately if deactivated
    if (user.isActive === false) {
      return sendError(res, 403, "Account is deactivated. Contact support.");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return sendError(res, 400, "Invalid password");

    // ✅ Update lastLogin
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    setAuthCookie(res, token);
    return sendSuccess(res, 200, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        isAdmin: user.isAdmin || false,
        role: user.role || "user",
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      },
      isAdmin: user.isAdmin || false,
    });
  } catch (err) {
    sendError(res, 500, err.message || "Login failed");
  }
});

// Logout - clears httpOnly cookie
router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  return sendSuccess(res, 200, {}, "Logged out successfully");
});

// Verify session - checks if cookie is valid
router.get("/verify", verifyToken, (req, res) => {
  return sendSuccess(res, 200, { valid: true, userId: req.userId });
});

// Utility: derive Cloudinary public_id from a secure URL
function extractCloudinaryPublicId(url) {
  try {
    if (!url || typeof url !== 'string') return null;
    const u = new URL(url);
    // Expect path like: /<cloud_name?>/image/upload/v<ver>/<folder>/<name>.<ext>
    const p = u.pathname; // e.g., /image/upload/v1721234567/smartdoc/avatars/USER-ts.jpg
    const idx = p.indexOf('/upload/');
    if (idx === -1) return null;
    let rest = p.substring(idx + '/upload/'.length); // v172.../smartdoc/avatars/USER-ts.jpg
    // Drop version prefix if present
    if (rest.startsWith('v') && rest.includes('/')) {
      rest = rest.substring(rest.indexOf('/') + 1);
    }
    // Remove leading slash if any
    if (rest.startsWith('/')) rest = rest.slice(1);
    // Remove extension (last .ext)
    const lastDot = rest.lastIndexOf('.');
    if (lastDot > -1) rest = rest.substring(0, lastDot);
    return rest || null; // e.g., smartdoc/avatars/USER-ts
  } catch (_) {
    return null;
  }
}

// Delete current user
router.delete("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.userId);
    if (!user) return sendError(res, 404, "User not found");

    // Best-effort: remove avatar from Cloudinary to free storage
    try {
      const pubId = extractCloudinaryPublicId(user.avatar);
      if (pubId) {
        await cloudinary.uploader.destroy(pubId, { invalidate: true, resource_type: 'image' });
      }
    } catch (_) { /* ignore */ }

    // Cascade delete user-related data (MongoDB Atlas)
    try {
      const [docsRes, chatsRes, contactsRes] = await Promise.allSettled([
        Document.deleteMany({ user: user._id }),
        Chat.deleteMany({ user: user._id }),
        ContactReport.deleteMany({ user: user._id })
      ]);
      const counts = {
        documents: docsRes.status === 'fulfilled' ? (docsRes.value?.deletedCount || 0) : 0,
        chats: chatsRes.status === 'fulfilled' ? (chatsRes.value?.deletedCount || 0) : 0,
        contactReports: contactsRes.status === 'fulfilled' ? (contactsRes.value?.deletedCount || 0) : 0,
      };
      return sendSuccess(res, 200, { deleted: counts }, "Account deleted successfully");
    } catch (_) {
      // Even if cascade fails, the account was removed; report generic success
      return sendSuccess(res, 200, {}, "Account deleted successfully");
    }
  } catch (err) {
    return sendError(res, 500, err.message || "Failed to delete account");
  }
});


// Update current user (name, email, password)
router.put("/me", verifyToken, validate(updateMeSchema), async (req, res) => {
  try {
    const { name, email, password } = req.validated.body || {};
    const user = await User.findById(req.userId);
    if (!user) return sendError(res, 404, "User not found");

    // Validate provided name isn't same as current
    if (typeof name === "string" && name.trim()) {
      if (name.trim() === user.name) {
        return sendError(res, 400, "New name must be different from current name");
      }
      user.name = name.trim();
    }

    // Update email with uniqueness and same-value checks
    if (typeof email === "string" && email.trim()) {
      const nextEmail = email.toLowerCase().trim();
      if (nextEmail === user.email) {
        return sendError(res, 400, "New email must be different from current email");
      }
      const existing = await User.findOne({ email: nextEmail });
      if (existing && existing._id.toString() !== user._id.toString()) {
        return sendError(res, 400, "Email already in use");
      }
      user.email = nextEmail;
    }

    // Update password with 3 changes allowed per 24h, then cooldown until window resets
    if (typeof password === "string" && password.length > 0) {
      // Prevent setting the same password again
      const isSame = await bcrypt.compare(password, user.password);
      if (isSame) {
        return sendError(res, 400, "New password must be different from current password");
      }

      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      // Initialize or reset window if expired
      const windowStart = user.passwordChangeWindowStart ? user.passwordChangeWindowStart.getTime() : null;
      if (!windowStart || now - windowStart >= twentyFourHours) {
        user.passwordChangeWindowStart = new Date(now);
        user.passwordChangeCount = 0;
      }

      // Enforce 3 changes per 24-hour window
      if (user.passwordChangeCount >= 3) {
        const remainingMs = twentyFourHours - (now - user.passwordChangeWindowStart.getTime());
        const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
        return sendError(res, 429, `Password change limit reached. Try again in ${remainingHours}h`);
      }

      user.password = await bcrypt.hash(password, 10);
      user.lastPasswordChange = new Date(now);
      user.passwordChangeCount += 1;
    }

    await user.save();

    // Optionally rotate token. Keeping existing token by default.
    const sanitized = {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    };

    return sendSuccess(res, 200, { user: sanitized });
  } catch (err) {
    return sendError(res, 500, err.message || "Failed to update profile");
  }
});


module.exports = router;
module.exports.verifyToken = verifyToken;

// Middleware to ensure current user is active
module.exports.ensureActive = async function ensureActive(req, res, next) {
  try {
    const user = req.user;
    if (!user) return sendError(res, 401, 'User not found');
    if (user.isActive === false) {
      return sendError(res, 403, 'Account is deactivated');
    }
    next();
  } catch (err) {
    return sendError(res, 500, err.message || 'Internal server error');
  }
};

// Middleware to ensure current user is admin
function isAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return sendError(res, 403, "Admin access required");
  }
  next();
}

module.exports.isAdmin = isAdmin;

// Configure Multer memory storage for avatars (no local files)
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".webp"];
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error("Only PNG, JPG, JPEG, WEBP allowed"));
    cb(null, true);
  }
});

// Upload/update current user's avatar
router.post("/me/avatar", verifyToken, avatarUpload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return sendError(res, 400, "No file uploaded");
    const user = await User.findById(req.userId);
    if (!user) return sendError(res, 404, "User not found");
    const previousAvatarUrl = user.avatar; // keep for deletion after successful upload

    // Upload to Cloudinary using a stream
    const folder = process.env.CLOUDINARY_AVATAR_FOLDER || "smartdoc/avatars";
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, public_id: `${req.userId}-${Date.now()}`, resource_type: "image", overwrite: true },
      async (error, result) => {
        try {
          if (error) return sendError(res, 500, error.message || "Upload failed");
          user.avatar = result.secure_url;
          await user.save();
          // After saving new avatar, delete previous one to avoid wasting storage
          try {
            const pubId = extractCloudinaryPublicId(previousAvatarUrl);
            if (pubId) {
              await cloudinary.uploader.destroy(pubId, { invalidate: true, resource_type: 'image' });
            }
          } catch (_) { /* ignore deletion errors */ }
          return sendSuccess(res, 200, { avatar: user.avatar });
        } catch (e) {
          return sendError(res, 500, e.message || "Failed to save avatar");
        }
      }
    );
    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } catch (err) {
    return sendError(res, 500, err.message || "Failed to upload avatar");
  }
});
// ===== GOOGLE OAUTH =====
// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Google Sign-In (verify token from frontend)
router.post('/google', validate(googleSchema), async (req, res) => {
  try {
    const { credential } = req.validated.body; // Google JWT token from @react-oauth/google
    
    // Verify the Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return sendError(res, 400, 'Email not provided by Google');
    }

    // Check if user exists
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
      // Existing user - link Google account if not already linked
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = 'google';
        if (picture && !user.avatar) user.avatar = picture;
        await user.save();
      }
      
      // Update last login
      user.lastLogin = new Date();
      await user.save();
    } else {
      // Create new user with Google auth
      user = new User({
        name: name || email.split('@')[0],
        email,
        googleId,
        authProvider: 'google',
        avatar: picture || null,
        lastLogin: new Date(),
        isActive: true,
      });
      await user.save();
    }

    // Block if deactivated
    if (user.isActive === false) {
      return sendError(res, 403, 'Account is deactivated. Contact support.');
    }

    // Generate JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    setAuthCookie(res, token);
    return sendSuccess(res, 200, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        isAdmin: user.isAdmin || false,
        role: user.role || 'user',
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
      isAdmin: user.isAdmin || false,
    });
  } catch (err) {
    logger.error({ err }, "Google auth error");
    return sendError(res, 500, 'Google authentication failed', [{ message: err.message }]);
  }
});