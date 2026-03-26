import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Book, BookDocument } from './books.schema';

@Injectable()
export class BooksService {
  constructor(
    @InjectModel(Book.name) private bookModel: Model<BookDocument>,
  ) {}

  async create(data: Partial<Book>): Promise<BookDocument> {
    const book = new this.bookModel(data);
    return book.save();
  }

  async findAllByUser(userId: string): Promise<BookDocument[]> {
    return this.bookModel.find({ userId }).sort({ createdAt: -1 });
  }

  async findById(id: string): Promise<BookDocument | null> {
    return this.bookModel.findById(id);
  }
}