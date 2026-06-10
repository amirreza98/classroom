import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BooksModule } from './books/books.module';
import { StorageModule } from './storage/storage.module';
import { SegmentsModule } from './segments/segments.module';
import { VoiceSessionsModule } from './voice-sessions/voice-sessions.module';


@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
      },
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
      inject: [ConfigService],
    }),
    BooksModule,
    StorageModule,
    SegmentsModule,
    VoiceSessionsModule,
  ],
})
export class AppModule {}