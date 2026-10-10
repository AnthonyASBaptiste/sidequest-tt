import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseConnectionService } from './database/database-connection.service.js';
import { schemas } from './database/schemas/index.js';
import { validateEnvironment } from './environment.js';
import { QuestsModule } from './quests/quests.module.js';
import { SessionsModule } from './sessions/sessions.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        dbName: config.get<string>('MONGODB_DB_NAME'),
        autoIndex: true,
        serverSelectionTimeoutMS: 10_000,
      }),
    }),
    MongooseModule.forFeature(schemas),
    SessionsModule,
    QuestsModule,
  ],
  providers: [DatabaseConnectionService],
})
export class AppModule {}
