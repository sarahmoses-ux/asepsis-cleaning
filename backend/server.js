import http from 'node:http';
import { MongoClient } from 'mongodb';
import { createApiRouter } from './http.js';
import { startNotificationWorker } from './notification-worker.js';

const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || '';

let dbClient = null;

async function connectMongo() {
  if (!mongoUri) {
    console.warn('MongoDB URI is missing. Set MONGODB_URI or MONGO_URI in .env.');
    return null;
  }

  try {
    dbClient = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });
    await dbClient.connect();
    console.log('MONGODB_OK');
    return dbClient.db(process.env.MONGODB_DB || process.env.MONGODB_DATABASE || 'asepsis');
  } catch (error) {
    console.error('MongoDB connect failed:', error.message);
    return null;
  }
}

const routeApi = createApiRouter();
const server = http.createServer(async (req, res) => {
  if (await routeApi(req, res)) return;
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/health') {
    const mongoState = dbClient ? await dbClient.db().command({ ping: 1 }).then(() => 'connected').catch(() => 'disconnected') : 'not-configured';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, status: 'backend-running', mongo: mongoState }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, message: 'Asepsis backend is running', mongo: dbClient ? 'connected' : 'not-configured' }));
});

connectMongo().catch(() => undefined);
const notificationWorker=startNotificationWorker();
server.on('close',()=>notificationWorker.stop());

server.listen(port, '0.0.0.0', () => {
  console.log(`Backend listening on http://0.0.0.0:${port}`);
});
