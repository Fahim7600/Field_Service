import app from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { startAutoCloseJob } from './jobs/auto-close.job';
import { closeRedis } from './lib/redis';

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${env.PORT}`);
  startAutoCloseJob();
});

const handleShutdown = async (signal: string) => {
  console.log(`Received ${signal}, starting graceful shutdown...`);
  server.close(async () => {
    try {
      await closeRedis();
      await prisma.$disconnect();
      console.log('Graceful shutdown complete.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });

  // Force close after 10s timeout
  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
