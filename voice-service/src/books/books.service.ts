import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Book, BookDocument } from './books.schema';
import { S3Service } from '../storage/s3.service';
import { CreateBookDto } from './dto/create-book.dto';

@Injectable()
export class BooksService {
  constructor(
    @InjectModel(Book.name) private bookModel: Model<BookDocument>,
    private s3Service: S3Service,
  ) {}

  async createWithFiles(
    dto: CreateBookDto,
    userId: string,
    pdfFile: Express.Multer.File,
    coverFile?: Express.Multer.File,
  ): Promise<BookDocument> {
    // upload PDF to S3
    const pdfKey = await this.s3Service.uploadFile(pdfFile, 'pdfs');

    // upload cover if provided, otherwise null
    let coverKey: string | null = null;
    if (coverFile) {
      coverKey = await this.s3Service.uploadFile(coverFile, 'covers');
    }

    const book = new this.bookModel({
      title: dto.title,
      author: dto.author,
      userId,
      pdfUrl: pdfKey,
      coverImageUrl: coverKey,
      isProcessed: false,
    });

    return book.save();
  }

  async findAllByUser(userId: string): Promise<BookDocument[]> {
    return this.bookModel.find({ userId }).sort({ createdAt: -1 });
  }

  async findById(id: string): Promise<BookDocument | null> {
    return this.bookModel.findById(id);
  }

  async getBookWithUrls(id: string) {
    const book = await this.bookModel.findById(id);
    if (!book) return null;

    // generate presigned URLs on the fly
    const pdfUrl = await this.s3Service.getPresignedUrl(book.pdfUrl);
    const coverImageUrl = book.coverImageUrl
      ? await this.s3Service.getPresignedUrl(book.coverImageUrl)
      : null;

    return { ...book.toObject(), pdfUrl, coverImageUrl };
  }
}