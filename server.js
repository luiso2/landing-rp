const express = require('express');
const path = require('path');
const { Resend } = require('resend');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const resend = new Resend(process.env.RESEND_API_KEY);

// Railway sits behind a proxy — required for accurate client IPs (rate limiting, logging)
app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "img-src 'self' data: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline' https://unpkg.com",
      "connect-src 'self'",
      "upgrade-insecure-requests",
    ].join('; ')
  );
  next();
});

// Rate limit the contact form — protects Resend quota & inbox from spam
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests. Please try again later.' },
});

// Health check (Railway requirement)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'rp-and-associates', uptime: process.uptime() });
});

// Contact form — validates, logs, sends emails via Resend
app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, project, message, company, phone } = req.body || {};

  if (!name || !email || !project || !message) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Invalid email' });
  }

  const safe = (v, max = 1000) => String(v ?? '').slice(0, max).replace(/[\r\n]+/g, ' ');
  const submission = {
    timestamp: new Date().toISOString(),
    name: safe(name, 120),
    company: safe(company, 120),
    email: safe(email, 200),
    phone: safe(phone, 40),
    project: safe(project, 120),
    message: safe(message, 4000),
  };

  console.log('[CONTACT]', JSON.stringify(submission));

  // Send emails in parallel — failures don't block the 200 response
  Promise.allSettled([
    // Welcome email to the person who submitted
    resend.emails.send({
      from: 'RP and Associates <info@rpandassociates.com>',
      to: [submission.email],
      subject: 'Thanks for reaching out — RP and Associates',
      html: `
        <div style="font-family:'Manrope',Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
          <div style="background:#1f4d2e;padding:32px 40px;border-radius:12px 12px 0 0;">
            <p style="color:white;font-size:22px;font-weight:800;margin:0;letter-spacing:-0.02em;">RP and Associates</p>
            <p style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;letter-spacing:0.18em;margin:6px 0 0;text-transform:uppercase;">Custom Drinkware · Packaging · Promotional Products</p>
          </div>
          <div style="background:#fafaf4;padding:40px;border:1px solid #e6e6dd;border-top:0;border-radius:0 0 12px 12px;">
            <h2 style="font-size:26px;font-weight:800;color:#133b22;letter-spacing:-0.025em;margin:0 0 16px;">Hi ${submission.name},</h2>
            <p style="font-size:16px;line-height:1.7;color:#3a3a35;margin:0 0 16px;">Thanks for reaching out! We've received your request and will get back to you within <strong>48 hours</strong> with a quote and timeline.</p>
            <div style="background:white;border:1px solid #e6e6dd;border-radius:10px;padding:24px;margin:24px 0;">
              <p style="font-size:11px;font-weight:700;letter-spacing:0.2em;color:#1f4d2e;text-transform:uppercase;margin:0 0 12px;">Your Request Summary</p>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:6px 0;color:#6b6b62;width:120px;">Project</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${submission.project}</td></tr>
                ${submission.company ? `<tr><td style="padding:6px 0;color:#6b6b62;">Company</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${submission.company}</td></tr>` : ''}
                <tr><td style="padding:6px 0;color:#6b6b62;vertical-align:top;">Message</td><td style="padding:6px 0;color:#1a1a1a;">${submission.message}</td></tr>
              </table>
            </div>
            <p style="font-size:14px;line-height:1.7;color:#3a3a35;margin:0 0 24px;">While you wait, feel free to call us directly:</p>
            <a href="tel:+13103729709" style="display:inline-block;background:#1f4d2e;color:white;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;">(310) 372-9709</a>
            <p style="font-size:13px;color:#6b6b62;margin:28px 0 0;">— The RP and Associates Team<br>Hermosa Beach, CA</p>
          </div>
        </div>
      `,
    }),
    // Internal notification to RP team
    resend.emails.send({
      from: 'RP Website <info@rpandassociates.com>',
      to: ['info@rpandassociates.com'],
      subject: `New inquiry: ${submission.project} — ${submission.name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a;">
          <h2 style="font-size:20px;font-weight:800;color:#133b22;margin:0 0 20px;">New Contact Form Submission</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="background:#f3f3ec;"><td style="padding:10px 12px;font-weight:700;width:100px;">Name</td><td style="padding:10px 12px;">${submission.name}</td></tr>
            <tr><td style="padding:10px 12px;font-weight:700;">Email</td><td style="padding:10px 12px;"><a href="mailto:${submission.email}">${submission.email}</a></td></tr>
            ${submission.company ? `<tr style="background:#f3f3ec;"><td style="padding:10px 12px;font-weight:700;">Company</td><td style="padding:10px 12px;">${submission.company}</td></tr>` : ''}
            ${submission.phone ? `<tr><td style="padding:10px 12px;font-weight:700;">Phone</td><td style="padding:10px 12px;"><a href="tel:${submission.phone}">${submission.phone}</a></td></tr>` : ''}
            <tr style="background:#f3f3ec;"><td style="padding:10px 12px;font-weight:700;">Project</td><td style="padding:10px 12px;">${submission.project}</td></tr>
            <tr><td style="padding:10px 12px;font-weight:700;vertical-align:top;">Message</td><td style="padding:10px 12px;">${submission.message}</td></tr>
            <tr style="background:#f3f3ec;"><td style="padding:10px 12px;font-weight:700;">Time</td><td style="padding:10px 12px;">${submission.timestamp}</td></tr>
          </table>
        </div>
      `,
    }),
  ]).then(results => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`[EMAIL_${i}]`, r.reason?.message ?? r.reason);
    });
  });

  res.json({ ok: true });
});

// Static assets — long cache for media, short for HTML
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (/\.(png|jpg|jpeg|webp|svg|css|woff2?)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (/\.html$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
  },
}));

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.use((_req, res) => res.redirect(301, '/'));

app.listen(PORT, () => {
  console.log(`RP and Associates running on port ${PORT}`);
});
