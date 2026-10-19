import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { validateEnvironment } from './environment.js';
import { GUEST_SESSION_COOKIE } from './sessions/guest-session.constants.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const environment = validateEnvironment(process.env);
  app.setGlobalPrefix('api');
  if (environment.FRONTEND_ORIGIN) {
    app.enableCors({
      origin: environment.FRONTEND_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
    });
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SideQuest T&T API')
    .setDescription('API for the SideQuest T&T real-world RPG.')
    .setVersion('1.0')
    .addCookieAuth(
      GUEST_SESSION_COOKIE,
      { type: 'apiKey', in: 'cookie', name: GUEST_SESSION_COOKIE },
      GUEST_SESSION_COOKIE,
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'secret' },
      'bearer',
    )
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, openApiDocument);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`SideQuest T&T backend listening on port ${port}`);
}

await bootstrap();
