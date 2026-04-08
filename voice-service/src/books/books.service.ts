import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Book, BookDocument } from './books.schema';
import { S3Service } from '../storage/s3.service';
import { SegmentsService } from '../segments/segments.service';
import { CreateBookDto } from './dto/create-book.dto';

@Injectable()
export class BooksService {
  constructor(
    @InjectModel(Book.name) private bookModel: Model<BookDocument>,
    private s3Service: S3Service,
    private segmentsService: SegmentsService,
  ) {}

  async createWithFiles(
    dto: CreateBookDto,
    userId: string,
    pdfFile: Express.Multer.File,
    coverFile?: Express.Multer.File,
  ): Promise<BookDocument> {
    const pdfKey = await this.s3Service.uploadFile(pdfFile, 'pdfs');

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

    await book.save();

    // process PDF into segments in the background
    // we don't await this so the upload response is instant
    this.segmentsService.processBook(book._id.toString(), pdfKey)
      .then(async count => {
        console.log(`Book ${book._id} processed into ${count} segments`);
        await this.bookModel.findByIdAndUpdate(book._id, { isProcessed: true }).exec();
      })
      .catch(err => console.error(`PDF processing failed for book ${book._id}:`, err));

    return book;
  }

  // ... rest of the methods stay the same
  async findAllByUser(userId: string): Promise<any[]> {
    const books = await this.bookModel.find({ userId }).sort({ createdAt: -1 });
    
    return Promise.all(
      books.map(async (book) => {
        const coverImageUrl = book.coverImageUrl
          ? await this.s3Service.getPresignedUrl(book.coverImageUrl)
          : null;
        return { ...book.toObject(), coverImageUrl };
      })
    );
  }

  async findById(id: string): Promise<BookDocument | null> {
    return this.bookModel.findById(id);
  }

  async getBookWithUrls(id: string) {
    const book = await this.bookModel.findById(id);
    if (!book) return null;

    const pdfUrl = await this.s3Service.getPresignedUrl(book.pdfUrl);
    const coverImageUrl = book.coverImageUrl
      ? await this.s3Service.getPresignedUrl(book.coverImageUrl)
      : null;

    return { ...book.toObject(), pdfUrl, coverImageUrl };
  }
}