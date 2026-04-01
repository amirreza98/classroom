import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Segment, SegmentDocument } from './segments.schema';
import { S3Service } from '../storage/s3.service';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

@Injectable()
export class SegmentsService {
  private client: S3Client;
  private bucket: string;

  constructor(
    @InjectModel(Segment.name) private segmentModel: Model<SegmentDocument>,
    private configService: ConfigService,
  ) {
    this.client = new S3Client({
      region: this.configService.get<string>('AWS_REGION')!,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY')!,
      },
    });
    this.bucket = this.configService.get<string>('AWS_BUCKET_NAME')!;
  }

  // download PDF buffer directly from S3
  private async downloadPdfFromS3(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);
    const chunks: Uint8Array[] = [];

    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  // split text into chunks of ~500 words
  private splitIntoChunks(text: string, wordsPerChunk = 500): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];

    for (let i = 0; i < words.length; i += wordsPerChunk) {
      chunks.push(words.slice(i, i + wordsPerChunk).join(' '));
    }

    return chunks;
  }

    async processBook(bookId: string, pdfKey: string): Promise<number> {
    const buffer = await this.downloadPdfFromS3(pdfKey);

    // load PDF
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
    const pdf = await loadingTask.promise;

    // extract text from all pages
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        fullText += pageText + ' ';
    }

    const chunks = this.splitIntoChunks(fullText);
    
    const bookObjectId = new Types.ObjectId(bookId);
    const segments = chunks.map((content, index) => ({
       bookId: bookObjectId,
        content,
        index,
    }));

    const session = await this.segmentModel.db.startSession();
    try {
      await session.withTransaction(async () => {
        await this.segmentModel.deleteMany({ bookId: bookObjectId }, { session });
        await this.segmentModel.insertMany(segments, { session });
      });
    } finally {
      await session.endSession();
    }


    return chunks.length;
    }

  async searchSegments(bookId: string, query: string): Promise<SegmentDocument[]> {
    return this.segmentModel
      .find({
        bookId: new Types.ObjectId(bookId),
        $text: { $search: query },
      })
      .limit(3) // return top 3 most relevant chunks
      .sort({ score: { $meta: 'textScore' } });
  }
}