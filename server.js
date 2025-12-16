const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'application/font-woff',
  '.woff2': 'application/font-woff2',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Remove query string and decode URI
  let filePath = decodeURIComponent(req.url.split('?')[0]);
  
  // Default to index.html for root
  if (filePath === '/') {
    filePath = '/index.html';
  }

  // Construct full file path
  const fullPath = path.join(PUBLIC_DIR, filePath);

  // Security: prevent directory traversal
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Check if file exists
  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Try with .html extension
      const htmlPath = fullPath + '.html';
      fs.stat(htmlPath, (err2, stats2) => {
        if (err2 || !stats2.isFile()) {
          res.writeHead(404);
          res.end('File not found');
          return;
        }
        serveFile(htmlPath, res);
      });
      return;
    }
    serveFile(fullPath, res);
  });
});

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Error reading file');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

server.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}/`);
  console.log(`📁 Serving files from: ${PUBLIC_DIR}`);
  console.log(`\n✨ Open your browser and go to:`);
  console.log(`   http://localhost:${PORT}/index.html`);
  console.log(`   http://localhost:${PORT}/login.html`);
  console.log(`   http://localhost:${PORT}/user-dashboard.html`);
  console.log(`   http://localhost:${PORT}/practitioner-dashboard.html`);
  console.log(`\n⏹️  Press Ctrl+C to stop the server\n`);
});


