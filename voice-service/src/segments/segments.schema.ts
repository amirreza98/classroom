import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SegmentDocument = Segment & Document;

@Schema({ timestamps: true })
export class Segment {
  @Prop({ type: Types.ObjectId, ref: 'Book', required: true })
  bookId: Types.ObjectId; // links back to the parent book

  @Prop({ required: true })
  content: string; // the actual text chunk

  @Prop({ required: true })
  index: number; // order of this chunk in the book (0, 1, 2...)
}

export const SegmentSchema = SchemaFactory.createForClass(Segment);

// text index so MongoDB can do full-text search on content
// this is what Vapi will use to find relevant segments
SegmentSchema.index({ content: 'text' });