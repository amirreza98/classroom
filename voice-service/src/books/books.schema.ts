import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BookDocument = Book & Document;

@Schema({ timestamps: true }) // automatically adds createdAt and updatedAt
export class Book {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  author: string;

  @Prop({ required: true })
  userId: string; // from Better Auth, ties the book to a user

  @Prop()
  coverImageUrl: string; // S3 URL, added after upload

  @Prop({ required: true })
  pdfUrl: string; // S3 URL of the PDF

  @Prop({ default: false })
  isProcessed: boolean; // true once PDF has been parsed into segments
}

export const BookSchema = SchemaFactory.createForClass(Book);