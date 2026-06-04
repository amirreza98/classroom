import AgentAPI from "apminsight";
AgentAPI.config();

import express from 'express';
import cors from "cors";
import { toNodeHandler } from "better-auth/node";

import subjectsRouter from './routes/subjects.js';
import usersRouter from './routes/users.js';
import classesRouter from './routes/classes.js';
import departmentsRouter from './routes/departments.js';
import enrollmentsRouter from './routes/enrollments.js';
import dashboardRouter from './routes/dashboard.js';
import collaborationRouter from './routes/collaboration.js';
import paymentsRouter from './routes/payments.js';
import chatRouter from './routes/chat.js';
import studentDashboardRouter from './routes/student-dashboard.js';
import { stripeWebhookHandler } from './routes/stripe-webhook.js';
import securityMiddleware from './middleware/security.js';
import { auth } from './lib/auth.js';
import "./kafka.js"

const app = express();
const PORT = 8000;

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

// Spring Cloud Gateway appends its own hop to X-Forwarded-Proto, producing
// "https,http" or "http,http". better-call uses the raw header value as the
// URL scheme, which makes new Request() throw on the comma. Take only the
// first (outermost / client-facing) value before better-auth reads it.
app.use((req, _res, next) => {
    const proto = req.headers['x-forwarded-proto'];
    if (typeof proto === 'string' && proto.includes(',')) {
        req.headers['x-forwarded-proto'] = proto.split(',')[0].trim();
    }
    next();
});

app.all('/api/auth/*splat', toNodeHandler(auth));

// Stripe webhook must use raw body — register before express.json()
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json());

app.use(securityMiddleware);

app.use('/api/subjects', subjectsRouter);
app.use('/api/users', usersRouter);
app.use('/api/classes', classesRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/enrollments', enrollmentsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/collaboration', collaborationRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/student-dashboard', studentDashboardRouter);

app.get('/', (req, res) => {
    res.send('Hello, welcome to the Classroom');
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});