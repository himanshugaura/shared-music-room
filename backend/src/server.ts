import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { errorHandler } from './utils/errorHandler.js';
dotenv.config();

const app = express();

app.use(express.json());


app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer();