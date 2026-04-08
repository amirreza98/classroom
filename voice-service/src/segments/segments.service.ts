import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Segment, SegmentDocument } from './segments.schema';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

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

  private async extractTextFromPdf(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const PDFParser = require('pdf2json');
      const parser = new PDFParser();

      parser.on('pdfParser_dataReady', (data: any) => {
        const text = data.Pages.map((p: any) =>
          p.Texts.map((t: any) => {
            try { return decodeURIComponent(t.R.map((r: any) => r.T).join('')); }
            catch { return t.R.map((r: any) => r.T).join(''); }
          }).join(' ')
        ).join('\n');
        resolve(text);
      });

      parser.on('pdfParser_dataError', (err: any) => reject(err));
      parser.parseBuffer(buffer);
    });
  }

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
    const fullText = await this.extractTextFromPdf(buffer);
    const chunks = this.splitIntoChunks(fullText);

    const bookObjectId = new Types.ObjectId(bookId);
    const segments = chunks.map((content, index) => ({
      bookId: bookObjectId,
      content,
      index,
    }));

    await this.segmentModel.deleteMany({ bookId: bookObjectId });
    await this.segmentModel.insertMany(segments);

    return chunks.length;
  }

  async searchSegments(bookId: string, query: string): Promise<SegmentDocument[]> {
    return this.segmentModel
      .find({
        bookId: new Types.ObjectId(bookId),
        $text: { $search: query },
      })
      .limit(3)
      .sort({ score: { $meta: 'textScore' } });
  }
}