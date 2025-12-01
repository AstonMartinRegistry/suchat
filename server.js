import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 5175;

// Keep track of a single waiting client and active pairs
let waitingClient = null;
const pairs = new Map(); // ws -> partnerWs

function pairClients(a, b) {
  pairs.set(a, b);
  pairs.set(b, a);

  const payload = JSON.stringify({ type: 'paired' });
  a.send(payload);
  b.send(payload);
}

wss.on('connection', (ws) => {
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Try to pair this client
  if (waitingClient && waitingClient.readyState === waitingClient.OPEN) {
    pairClients(waitingClient, ws);
    waitingClient = null;
  } else {
    waitingClient = ws;
    ws.send(JSON.stringify({ type: 'waiting' }));
  }

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.type === 'message') {
      const partner = pairs.get(ws);
      if (partner && partner.readyState === partner.OPEN) {
        partner.send(JSON.stringify({ type: 'message', text: msg.text }));
      }
    }

    if (msg.type === 'typing') {
      const partner = pairs.get(ws);
      if (partner && partner.readyState === partner.OPEN) {
        partner.send(JSON.stringify({ type: 'typing', text: msg.text || '' }));
      }
    }

    if (msg.type === 'next') {
      const partner = pairs.get(ws);
      if (partner) {
        pairs.delete(ws);
        pairs.delete(partner);
        if (partner.readyState === partner.OPEN) {
          partner.send(JSON.stringify({ type: 'partner_left' }));
        }
      }

      if (waitingClient && waitingClient === ws) {
        waitingClient = null;
      }

      if (waitingClient && waitingClient.readyState === waitingClient.OPEN) {
        pairClients(waitingClient, ws);
        waitingClient = null;
      } else {
        waitingClient = ws;
        ws.send(JSON.stringify({ type: 'waiting' }));
      }
    }
  });

  ws.on('close', () => {
    if (waitingClient === ws) {
      waitingClient = null;
    }

    const partner = pairs.get(ws);
    if (partner) {
      pairs.delete(ws);
      pairs.delete(partner);
      if (partner.readyState === partner.OPEN) {
        partner.send(JSON.stringify({ type: 'partner_left' }));
      }
    }
  });
});

// Heartbeat to clean up dead connections
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

server.listen(PORT, () => {
  console.log(`WebSocket server listening on http://localhost:${PORT}`);
});


