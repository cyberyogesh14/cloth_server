import nodemailer from "nodemailer";

// ========================================
// SMTP Transporter
// ========================================

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,

  secure: process.env.SMTP_SECURE === "true",

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ========================================
// Verify SMTP Connection
// ========================================

export const verifyMailer = async () => {
  try {
    await transporter.verify();
    console.log("✅ Mail server is ready");
  } catch (error) {
    console.error("❌ Mail server connection failed:", error.message);
  }
};

// ========================================
// Base Email Function
// ========================================

const sendEmail = async ({ email, subject, html, text, }) => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.MAIL_NAME || "Clothing Store"}" <${process.env.SMTP_USER}>`,
      to: email, subject, text, html,
    });

    console.log(`📧 Email sent: ${info.messageId}`);

    return { success: true, messageId: info.messageId, };

  } catch (error) {
    console.error("❌ Email sending failed:", error.message);

    throw new Error("Unable to send email");
  }
};

// ========================================
// OTP Email Template
// ========================================

const otpTemplate = ({ name, otp, title, message, }) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>

<body style=" margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, Helvetica, sans-serif;">

  <div style="padding: 40px 15px;">

    <div style=" max-width: 500px;  margin: auto;  background: #ffffff;  border-radius: 12px;  overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">

      <!-- Header -->

      <div style=" padding: 25px; text-align: center; background: #111111; color: #ffffff;">

        <h1 style="margin: 0;font-size: 24px;">
          ${process.env.MAIL_NAME || "Clothing Store"}
        </h1>

      </div>

      <!-- Content -->

      <div style=" padding: 35px 30px; text-align: center;">

        <h2 style=" margin: 0 0 15px; color: #222222;"> ${title}</h2>

        <p style=" color: #555555;font-size: 15px; line-height: 1.6;">
          Hello <strong>${name}</strong>,
        </p>

        <p style=" color: #666666; font-size: 14px; line-height: 1.6;"> ${message}</p>

        <!-- OTP -->

        <div style="  margin: 30px 0;  padding: 20px;  background: #f5f5f5;  border-radius: 10px;">

          <p style="  margin: 0 0 10px;  color: #777777;  font-size: 12px text-transform: uppercase; letter-spacing: 1px;">
            Your OTP
          </p>

          <div style="font-size: 34px; font-weight: bold; letter-spacing: 10px; color: #111111;">
            ${otp}
          </div>

        </div>

        <p style="color: #777777;font-size: 13px;">
          This OTP will expire in
          <strong>10 minutes</strong>.
        </p>

        <p style="margin-top: 25px;color: #999999; font-size: 12px; line-height: 1.5;">
          Never share this OTP with anyone.
          Our team will never ask you for your OTP.
        </p>

      </div>

      <!-- Footer -->

      <div style=" padding: 20px; text-align: center; border-top: 1px solid #eeeeee; ">

        <p style=" margin: 0; color: #aaaaaa; font-size: 11px;">
          © ${new Date().getFullYear()}
          ${process.env.MAIL_NAME || "Clothing Store"}
        </p>

      </div>

    </div>

  </div>

</body>
</html>
`;
};

// ========================================
// Verify User OTP
// ========================================

export const verify_user_otp = async (email, name, otp) => {

  return sendEmail({
    email, subject: "Verify Your Email", text:
      `Hello ${name},

Your verification OTP is: ${otp}

This OTP will expire in 10 minutes.

Do not share this OTP with anyone.
    `,

    html: otpTemplate({
      name,
      otp,
      title: "Verify Your Email",

      message:
        "Thank you for creating an account with us. Please use the OTP below to verify your email address.",
    }),
  });
};

// ======================================== 
// Forgot Password OTP
// ========================================

export const forgot_password_otp = async (email, name, otp) => {

  return sendEmail({
    email,

    subject: "Reset Your Password",

    text: `
Hello ${name},

Your password reset OTP is: ${otp}

This OTP will expire in 10 minutes.

If you did not request a password reset, please ignore this email.
    `,

    html: otpTemplate({
      name, otp, title: "Reset Your Password",
      message:
        "We received a request to reset your password. Use the OTP below to continue.",
    }),
  });
};