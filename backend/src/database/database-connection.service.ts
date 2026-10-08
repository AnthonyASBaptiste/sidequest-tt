import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

@Injectable()
export class DatabaseConnectionService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseConnectionService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onModuleInit(): Promise<void> {
    await this.connection.asPromise();

    if (this.connection.readyState !== 1 || !this.connection.db) {
      throw new Error('MongoDB connection did not reach the connected state.');
    }

    const modelNames = this.connection.modelNames();
    await Promise.all(
      modelNames.map((modelName) =>
        this.connection.model(modelName).createIndexes(),
      ),
    );

    this.logger.log(`MongoDB connected to database "${this.connection.name}".`);
    this.logger.log(`Ensured indexes for ${modelNames.length} Mongoose models.`);
  }
}
