const http = require('http');

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    console.log('🔔 Webhook received');
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('📦 Webhook payload:', data);

        const events = data.events;
        if (events && events.length > 0) {
          const userId = events[0].source.userId;
          console.log('👤 LINE USER ID:', userId);
        }

        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
      } catch (err) {
        console.error('❌ JSON parse error:', err);
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request');
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(3000, () => {
  console.log('✅ Webhook server running at http://localhost:3000');
});
