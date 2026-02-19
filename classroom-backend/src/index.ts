import express from 'express';
import subjectsRouter from './routes/subjects';
import cors from "cors";

const app = express();
const PORT = 8000;

const FRONTEND_URL = process.env.FRONTEND_URL;
if (!FRONTEND_URL) {
    throw new Error('FRONTEND_URL environment variable is required');
}

app.use(cors({
    origin: FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'], 
     credentials: true
 }))

app.use(express.json());

app.use('/api/subjects', subjectsRouter)

app.get('/',(req, res) => {
    res.send('Hello, welcome to the Classroom');
});
 
app.listen(PORT, () => { console.log(`Server is running at http://localhost:${PORT}`);
});