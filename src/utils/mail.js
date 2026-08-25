import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendMail = async ({ email, name, subject, html }) => {
  return transporter.sendMail({
    from: `"${process.env.MAIL_NAME || "My App"}" <${process.env.SMTP_USER}>`,
    to: email,
    subject,
    html,
  });
};

export const verify_user_otp = async (email, name, otp) => {
  return sendMail({
    email,
    name,
    subject: "Verify your account",
    html: `
      <div style="font-family: Arial, sans-serif;">
        <h2>Hello ${name}</h2>
        <p>Your verification OTP is:</p>

        <h1 style="letter-spacing: 8px;">
          ${otp}
        </h1>

        <p>This OTP will expire in <b>10 minutes</b>.</p>

        <p>If you didn't create this account, ignore this email.</p>
      </div>
    `,
  });
};

export const forgot_password_otp = async (email, name, otp) => {
  return sendMail({
    email,
    name,
    subject: "Password reset OTP",
    html: `
      <div style="font-family: Arial, sans-serif;">
        <h2>Hello ${name}</h2>

        <p>Your password reset OTP is:</p>

        <h1 style="letter-spacing: 8px;">
          ${otp}
        </h1>

        <p>This OTP will expire in <b>10 minutes</b>.</p>

        <p>If you didn't request a password reset, secure your account immediately.</p>
      </div>
    `,
  });
};