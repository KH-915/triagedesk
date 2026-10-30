import app from './app';
import { config } from './config';
import { prisma } from './lib/prisma';

async function start(): Promise<void> {
  try {
    // Verify database is reachable before accepting traffic
    await prisma.$connect();
    console.log('✅ Database connected');

    const server = app.listen(config.PORT, () => {
      console.log(`🚀 API running on port ${config.PORT} [${config.NODE_ENV}]`);
    });

    // Graceful shutdown: stop accepting new connections, finish in-flight requests
    const shutdown = async (signal: string): Promise<void> => {
      console.log(`\n${signal} received — shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log('✅ Server shut down cleanly.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

start();
