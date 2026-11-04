const nodemailer = require('nodemailer');
const integrationService = require('./integration.service');

// SMTP settings come from Admin > Integrations (falling back to SMTP_* in .env)
const createTransporter = (smtp) => {
    if (!smtp.enabled || !smtp.host || !smtp.user || !smtp.password) {
        return null;
    }

    const port = Number(smtp.port) || 587;
    return nodemailer.createTransport({
        host: smtp.host,
        port,
        secure: port === 465,
        auth: {
            user: smtp.user,
            pass: smtp.password,
        },
        connectionTimeout: 10000,
    });
};

const fromAddress = (smtp) => `"${(smtp.fromName || 'Khushi Transport').replace(/"/g, '')}" <${smtp.fromEmail || smtp.user}>`;

module.exports.createTransporter = createTransporter;
module.exports.fromAddress = fromAddress;

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ c ]));

// Generic notification email; `lines` are plain text, `rows` an optional [label, value] table
module.exports.sendEmail = async ({ to, subject, heading, lines = [], rows = [] }) => {
    const smtp = await integrationService.get('smtp');
    const transporter = createTransporter(smtp);
    if (!transporter) throw new Error('Email (SMTP) is not configured');

    const brand = escapeHtml(smtp.fromName || 'Khushi Transport');
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 12px;">
            <p style="color: #777777; font-size: 12px; margin: 0 0 8px;">${brand}</p>
            <h2 style="color: #000000; margin: 0 0 16px;">${escapeHtml(heading || subject)}</h2>
            ${lines.map(l => `<p style="color: #444444; line-height: 1.5;">${escapeHtml(l)}</p>`).join('')}
            ${rows.length ? `<table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px;">${rows.map(([ k, v ]) => `
                <tr><td style="padding: 8px 0; color: #777777; border-top: 1px solid #eeeeee;">${escapeHtml(k)}</td>
                <td style="padding: 8px 0; color: #111111; text-align: right; border-top: 1px solid #eeeeee;">${escapeHtml(v)}</td></tr>`).join('')}</table>` : ''}
        </div>
    `;

    await transporter.sendMail({
        from: fromAddress(smtp),
        to,
        subject: `${smtp.fromName || 'Khushi Transport'} – ${subject}`,
        text: [ heading || subject, ...lines, ...rows.map(([ k, v ]) => `${k}: ${v}`) ].join('\n'),
        html,
    });
};

module.exports.sendPasswordResetEmail = async ({ to, otp, userName }) => {
    const smtp = await integrationService.get('smtp');
    const transporter = createTransporter(smtp);
    const brand = smtp.fromName || 'Khushi Transport';

    const subject = `${brand} - Password Reset OTP`;
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; rounded: 12px;">
            <h2 style="color: #000000; margin-bottom: 10px;">${brand}</h2>
            <p style="color: #555555;">Hello ${userName || 'User'},</p>
            <p style="color: #555555;">You requested to reset your password. Use the following 6-digit OTP code to complete your password reset:</p>
            <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #000000;">${otp}</span>
            </div>
            <p style="color: #777777; font-size: 12px;">This OTP is valid for 15 minutes. If you did not request a password reset, please ignore this email.</p>
        </div>
    `;

    if (!transporter) {
        console.log(`\n========================================`);
        console.log(`[SMTP SIMULATION] Password Reset OTP for ${to}: ${otp}`);
        console.log(`Turn on Email (SMTP) in Admin > Integrations to send real emails.`);
        console.log(`========================================\n`);
        return { success: true, simulated: true };
    }

    try {
        await transporter.sendMail({
            from: fromAddress(smtp),
            to,
            subject,
            html: htmlContent,
        });
        return { success: true, simulated: false };
    } catch (err) {
        console.error('Error sending password reset email via Nodemailer:', err);
        throw new Error('Failed to send password reset email. Please try again later.');
    }
};
