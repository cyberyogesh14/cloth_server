import express from "express";

import {
  user_register,
  verify_register_otp,
  resend_register_otp,     
  user_login,
  update_profile,
  add_address,
  forgot_password,
  verify_forgot_password_otp,
  reset_password,
} from "../controller/user_controller.js";

import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "API working",
  });
});

// Authentication
router.post("/register", user_register);
router.post("/verify-otp", verify_register_otp);
router.post("/resend-otp", resend_register_otp);
router.post("/login", user_login);

// Password
router.post("/forgot-password", forgot_password);
router.post(
  "/verify-forgot-otp",
  verify_forgot_password_otp
);
router.post("/reset-password", reset_password);

// Protected routes
router.patch(
  "/profile",
  auth,
  update_profile
);

router.post(
  "/address",
  auth,
  add_address
);

export { router };  
