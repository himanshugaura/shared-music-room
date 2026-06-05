import { transporter } from "../config/mail.js";
import { verificationEmailTemplate } from "./mailTemplate.js";

interface SendMailOptions {
  to: string;
  url: string;
}

export const verificationEmailSender = async ({
  to , url
}: SendMailOptions) => {
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject : "Mail Verification",
    html : verificationEmailTemplate(url)
  });
}   

