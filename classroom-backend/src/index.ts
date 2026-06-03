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
    origin: allowedOrigins,  // ✅ cors handles arrays correctly
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());

app.use(securityMiddleware);

app.use('/api/subjects', subjectsRouter);
app.use('/api/users', usersRouter);
app.use('/api/classes', classesRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/enrollments', enrollmentsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/collaboration', collaborationRouter);

app.get('/', (req, res) => {
    res.send('Hello, welcome to the Classroom');
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});