import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || "Glycofit <noreply@glyco.fit>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set, skipping email to:", to);
    return null;
  }

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
  });

  if (error) {
    console.error("Email send error:", error);
    throw new Error(error.message);
  }

  return data;
}

export function alertEmailHtml(patientName: string, alertType: string, message: string) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #16a34a; margin-bottom: 4px;">Glycofit</h2>
      <p style="color: #6b7280; font-size: 13px; margin-top: 0;">Tu salud, bajo control</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
      <p style="color: #1f2937;">Hola <strong>${patientName}</strong>,</p>
      <p style="color: #1f2937;">${message}</p>
      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
        — Equipo Glycofit
      </p>
    </div>
  `;
}

export function passwordResetEmailHtml(name: string, resetUrl: string) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #16a34a; margin-bottom: 4px;">Glycofit</h2>
      <p style="color: #6b7280; font-size: 13px; margin-top: 0;">Tu salud, bajo control</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
      <p style="color: #1f2937;">Hola <strong>${name}</strong>,</p>
      <p style="color: #1f2937;">Recibimos una solicitud para restablecer tu contraseña.</p>
      <a href="${resetUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
        Restablecer contraseña
      </a>
      <p style="color: #6b7280; font-size: 13px;">Si no solicitaste esto, podés ignorar este email.</p>
      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
        — Equipo Glycofit
      </p>
    </div>
  `;
}

export function welcomeEmailHtml(name: string) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #16a34a; margin-bottom: 4px;">Glycofit</h2>
      <p style="color: #6b7280; font-size: 13px; margin-top: 0;">Tu salud, bajo control</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
      <p style="color: #1f2937;">Hola <strong>${name}</strong>,</p>
      <p style="color: #1f2937;">¡Bienvenido/a a Glycofit! Tu cuenta fue creada exitosamente.</p>
      <p style="color: #1f2937;">Desde ahora podés registrar tus mediciones de glucemia y presión arterial, y llevar un control de tu salud.</p>
      <a href="https://glyco.fit/login" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
        Ingresar a Glycofit
      </a>
      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
        — Equipo Glycofit
      </p>
    </div>
  `;
}
