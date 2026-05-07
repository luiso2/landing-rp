const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers (Helmet-style basics, kept light for static landing)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Health check (Railway requirement per project standard)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'rp-and-associates', uptime: process.uptime() });
});

// Static assets — long cache for images & css, short for HTML
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (/\.(png|jpg|jpeg|webp|svg|css|woff2?)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (/\.html$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
  },
}));

// Default route -> index.html
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// 404 fallback
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
  console.log(`RP and Associates running on port ${PORT}`);
});
