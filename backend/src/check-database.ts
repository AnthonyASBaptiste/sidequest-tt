import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { AppModule } from './app.module.js';

async function checkDatabase(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const connection = app.get<Connection>(getConnectionToken());
    await connection.asPromise();

    if (!connection.db) {
      throw new Error('MongoDB connection is missing its database handle.');
    }

    await connection.db.admin().ping();
    console.log(`MongoDB ping succeeded for database "${connection.name}".`);
  } finally {
    await app.close();
  }
}

checkDatabase().catch((error: unknown) => {
  console.error(
    'MongoDB connection check failed:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
