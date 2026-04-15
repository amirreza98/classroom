import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  // Increase body size limits to handle PDF uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'https://classroom-nine-omega.vercel.app',
    ],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  await app.listen(process.env.PORT ?? 3001);
  console.log(`Voice service running on port 3001`);
}
bootstrap();