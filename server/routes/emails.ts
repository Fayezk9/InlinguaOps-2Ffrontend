import { RequestHandler } from "express";
import { z } from "zod";
import nodemailer from "nodemailer";

const emailConfigSchema = z.object({
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.string().transform(Number),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
});

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string(),
  participantData: z.any().optional(),
  orderData: z.any().optional(),
});

async function createTransporter() {
  const config = emailConfigSchema.safeParse({
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT || "587",
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
  });

  if (!config.success) {
    throw new Error("Email configuration not found. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS environment variables.");
  }

  const transporter = nodemailer.createTransporter({
    host: config.data.SMTP_HOST,
    port: config.data.SMTP_PORT,
    secure: config.data.SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: config.data.SMTP_USER,
      pass: config.data.SMTP_PASS,
    },
  });

  // Verify the connection
  await transporter.verify();
  return transporter;
}

export const sendRegistrationConfirmationHandler: RequestHandler = async (req, res) => {
  try {
    const parsed = sendEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid request data",
        issues: parsed.error.flatten(),
      });
    }

    const { to, subject, body } = parsed.data;

    const transporter = await createTransporter();

    const mailOptions = {
      from: process.env.SMTP_USER,
      to,
      subject,
      text: body,
      html: body.replace(/\n/g, '<br>'), // Simple HTML conversion
    };

    const info = await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      messageId: info.messageId,
      message: "Registration confirmation email sent successfully",
    });
  } catch (error: any) {
    console.error("Email sending error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to send email",
    });
  }
};

export const sendParticipationConfirmationHandler: RequestHandler = async (req, res) => {
  try {
    const parsed = sendEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid request data",
        issues: parsed.error.flatten(),
      });
    }

    const { to, subject, body } = parsed.data;

    const transporter = await createTransporter();

    const mailOptions = {
      from: process.env.SMTP_USER,
      to,
      subject,
      text: body,
      html: body.replace(/\n/g, '<br>'), // Simple HTML conversion
    };

    const info = await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      messageId: info.messageId,
      message: "Participation confirmation email sent successfully",
    });
  } catch (error: any) {
    console.error("Email sending error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to send email",
    });
  }
};

export const testEmailConnectionHandler: RequestHandler = async (req, res) => {
  try {
    const transporter = await createTransporter();
    res.json({
      success: true,
      message: "Email configuration is valid and connection successful",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Email configuration test failed",
    });
  }
};
