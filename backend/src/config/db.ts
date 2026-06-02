import { prisma } from './prisma.js';

export const connectDB = async (): Promise<void> => {
    try {
        await prisma.$connect();
        console.log('Connected to PostgreSQL');
    } catch (error) {
        console.error('Database connection failed:', error);
        process.exit(1);
    }
};