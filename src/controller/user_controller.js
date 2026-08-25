import user_model from "../model/user_model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { all_error } from "../middleware/errorhandeling.js";

import {
  generateOTP,
  hashOTP,
} from "../utils/otp.js";

import {
  verify_user_otp,
  forgot_password_otp,
} from "../utils/mail.js";

export const user_register = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      password,
      gender,
    } = req.body;

    if (
      !first_name ||
      !last_name ||
      !email ||
      !password ||
      !gender
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const existingUser = await user_model.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const otp = generateOTP();

    const user = await user_model.create({
      first_name,
      last_name,
      email: email.toLowerCase(),
      password: hashedPassword,
      gender,

      verification: {
        user: {
          otp_hash: hashOTP(otp),
          otp_expires_at: new Date(
            Date.now() + 10 * 60 * 1000
          ),
          otp_attempts: 0,
          is_verified: false,
        },
      },
    });

    await verify_user_otp(
      user.email,
      user.first_name,
      otp
    );

    res.status(201).json({
      success: true,
      message: "Account created. OTP sent to your email.",
      user_id: user._id,
    });

  } catch (err) {
    all_error(err, res);
  }
};

export const verify_register_otp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const user = await user_model.findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const verification = user.verification.user;

    if (verification.is_verified) {
      return res.status(400).json({
        success: false,
        message: "Account already verified",
      });
    }

    // Check lock
    if (
      verification.locked_until &&
      verification.locked_until > new Date()
    ) {
      return res.status(429).json({
        success: false,
        message: "Too many wrong attempts",
        locked_until: verification.locked_until,
      });
    }

    // Check expiry
    if (
      !verification.otp_expires_at ||
      verification.otp_expires_at < new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: "OTP expired. Please request a new OTP.",
      });
    }

    const submittedHash = hashOTP(otp);

    if (submittedHash !== verification.otp_hash) {
      verification.otp_attempts += 1;

      if (verification.otp_attempts >= 3) {
        const lockMinutes = [1, 5, 10, 20, 30][
          Math.min(
            verification.lock_count,
            4
          )
        ];

        verification.locked_until = new Date(
          Date.now() + lockMinutes * 60 * 1000
        );

        verification.lock_count += 1;
        verification.otp_attempts = 0;
      }

      await user.save();

      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    verification.is_verified = true;
    verification.otp_verified_at = new Date();

    verification.otp_hash = undefined;
    verification.otp_expires_at = undefined;
    verification.otp_attempts = 0;
    verification.locked_until = undefined;

    await user.save();

    res.json({
      success: true,
      message: "Account verified successfully",
    });

  } catch (err) {
    all_error(err, res);
  }
};

export const resend_register_otp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await user_model.findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const verification = user.verification.user;

    if (verification.is_verified) {
      return res.status(400).json({
        success: false,
        message: "Account already verified",
      });
    }

    // 60 second resend cooldown
    if (
      verification.last_otp_sent_at &&
      Date.now() -
        verification.last_otp_sent_at.getTime() <
        60 * 1000
    ) {
      return res.status(429).json({
        success: false,
        message: "Please wait before requesting another OTP",
      });
    }

    const otp = generateOTP();

    verification.otp_hash = hashOTP(otp);
    verification.otp_expires_at = new Date(
      Date.now() + 10 * 60 * 1000
    );

    verification.last_otp_sent_at = new Date();
    verification.otp_resend_count += 1;
    verification.otp_attempts = 0;
    verification.locked_until = undefined;

    await user.save();

    await verify_user_otp(
      user.email,
      user.first_name,
      otp
    );

    res.json({
      success: true,
      message: "OTP sent successfully",
    });

  } catch (err) {
    all_error(err, res);
  }
};

export const user_login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await user_model.findOne({
      email: email.toLowerCase(),
      is_deleted: false,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Account is disabled",
      });
    }

    if (!user.verification.user.is_verified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your account first",
      });
    }

    const security = user.login_security;

    // Check login lock
    if (
      security.locked_until &&
      security.locked_until > new Date()
    ) {
      return res.status(429).json({
        success: false,
        message: "Account temporarily locked",
        locked_until: security.locked_until,
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      security.failed_attempts += 1;
      security.last_failed_login = new Date();

      if (security.failed_attempts >= 3) {
        const lockMinutes = [1, 5, 10, 20, 30][
          Math.min(security.lock_count, 4)
        ];

        security.locked_until = new Date(
          Date.now() + lockMinutes * 60 * 1000
        );

        security.lock_count += 1;
        security.failed_attempts = 0;
      }

      await user.save();

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Successful login
    security.failed_attempts = 0;
    security.locked_until = undefined;
    security.last_login = new Date();

    await user.save();

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (err) {
    all_error(err, res);
  }
};
export const update_profile = async (req, res) => {
  try {
    const { first_name, last_name, gender, profile_img } =
      req.body;

    const user = await user_model.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (first_name !== undefined)
      user.first_name = first_name;

    if (last_name !== undefined)
      user.last_name = last_name;

    if (gender !== undefined)
      user.gender = gender;

    if (profile_img !== undefined)
      user.profile_img = profile_img;

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        gender: user.gender,
        profile_img: user.profile_img,
      },
    });

  } catch (err) {
    all_error(err, res);
  }
};

export const add_address = async (req, res) => {
  try {
    const { address_id } = req.body;

    if (!address_id) {
      return res.status(400).json({
        success: false,
        message: "Address ID is required",
      });
    }

    const user = await user_model.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.address_list.push(address_id);
    user.is_address_list = true;

    await user.save();

    res.json({
      success: true,
      message: "Address added successfully",
    });

  } catch (err) {
    all_error(err, res);
  }
};

export const forgot_password = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await user_model.findOne({
      email: email.toLowerCase(),
      is_deleted: false,
    });

    // Don't reveal whether email exists
    if (!user) {
      return res.json({
        success: true,
        message:
          "If this email exists, a password reset OTP has been sent.",
      });
    }

    const otp = generateOTP();

    user.verification.user.otp_hash = hashOTP(otp);

    user.verification.user.otp_expires_at = new Date(
      Date.now() + 10 * 60 * 1000
    );

    user.verification.user.otp_attempts = 0;

    await user.save();

    await forgot_password_otp(
      user.email,
      user.first_name,
      otp
    );

    res.json({
      success: true,
      message:
        "If this email exists, a password reset OTP has been sent.",
    });

  } catch (err) {
    all_error(err, res);
  }
};

export const verify_forgot_password_otp = async (
  req,
  res
) => {
  try {
    const { email, otp } = req.body;

    const user = await user_model.findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    const verification = user.verification.user;

    if (
      !verification.otp_expires_at ||
      verification.otp_expires_at < new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    if (
      hashOTP(otp) !== verification.otp_hash
    ) {
      verification.otp_attempts += 1;

      await user.save();

      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    const resetToken = jwt.sign(
      {
        id: user._id,
        purpose: "password_reset",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "10m",
      }
    );

    verification.otp_hash = undefined;
    verification.otp_expires_at = undefined;
    verification.otp_attempts = 0;

    await user.save();

    res.json({
      success: true,
      message: "OTP verified",
      reset_token: resetToken,
    });

  } catch (err) {
    all_error(err, res);
  }
};

export const reset_password = async (req, res) => {
  try {
    const { reset_token, new_password } = req.body;

    if (!reset_token || !new_password) {
      return res.status(400).json({
        success: false,
        message: "Reset token and new password are required",
      });
    }

    const decoded = jwt.verify(
      reset_token,
      process.env.JWT_SECRET
    );

    if (decoded.purpose !== "password_reset") {
      return res.status(401).json({
        success: false,
        message: "Invalid reset token",
      });
    }

    if (new_password.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least 8 characters",
      });
    }

    const user = await user_model.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.password = await bcrypt.hash(
      new_password,
      12
    );

    // Reset login security
    user.login_security.failed_attempts = 0;
    user.login_security.locked_until = undefined;

    await user.save();

    res.json({
      success: true,
      message: "Password reset successfully",
    });

  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Reset token expired",
      });
    }

    all_error(err, res);
  }
};