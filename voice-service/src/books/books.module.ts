import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { Book, BookSchema } from './books.schema';
import { StorageModule } from '../storage/storage.module';


@Module({
  imports: [
    MongooseModule.forFeature([{ name: Book.name, schema: BookSchema }]),
    StorageModule,
  ],
  controllers: [BooksController],
  providers: [BooksService],
  exports: [BooksService], // other modules can use BooksService if needed
})
export class BooksModule {}