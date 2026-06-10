import AgentAPI from "apminsight";
AgentAPI.config();

import express from 'express';
import cors from "cors";
import { toNodeHandler } from "better-auth/node";

import usersRouter from './routes/users.js';
import securityMiddleware from './middleware/security.js';
import { auth } from './lib/auth.js';
import "./kafka.js";
import { Registry, collectDefaultMetrics } from 'prom-client';


const app = express();
const PORT = 8000;

const register = new Registry();
collectDefaultMetrics({ register });

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});

const FRONTEND_URL = process.env.FRONTEND_URL;
if (!FRONTEND_URL) {
    throw new Error('FRONTEND_URL environment variable is required');
}

const allowedOrigins = FRONTEND_URL.split(',').map(o => o.trim());

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use((req, _res, next) => {
    const proto = req.headers['x-forwarded-proto'];
    if (typeof proto === 'string' && proto.includes(',')) {
        req.headers['x-forwarded-proto'] = proto.split(',')[0].trim();
    }
    next();
});

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());

app.use(securityMiddleware);

app.use('/api/users', usersRouter);

app.get('/', (_req, res) => {
    res.send('Auth Service');
});

app.listen(PORT, () => {
    console.log(`Auth service running at http://localhost:${PORT}`);
});