import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT||'587',10),
  secure:false,
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
});
export const sendEmail = async ({to,subject,html})=>{
  if(!process.env.SMTP_HOST){ console.warn('SMTP not configured; skipping email to',to); return; }
  return transporter.sendMail({ from: process.env.FROM_EMAIL||'no-reply@jobboard.dev', to, subject, html });
};
