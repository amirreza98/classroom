import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { Book, BookSchema } from './books.schema';
import { Segment, SegmentSchema } from '../segments/segments.schema';
import { StorageModule } from '../storage/storage.module';
import { SegmentsModule } from '../segments/segments.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Book.name, schema: BookSchema },
      { name: Segment.name, schema: SegmentSchema },
    ]),
    StorageModule,
    SegmentsModule,
  ],
  controllers: [BooksController],
  providers: [BooksService],
  exports: [BooksService],
})
export class BooksModule {}