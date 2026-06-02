import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 5000;

const startServer = async () => {

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer();