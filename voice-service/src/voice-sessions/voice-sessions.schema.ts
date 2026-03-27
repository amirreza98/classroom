import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VoiceSessionDocument = VoiceSession & Document;

@Schema({ timestamps: true })
export class VoiceSession {
  @Prop({ type: Types.ObjectId, ref: 'Book', required: true })
  bookId: Types.ObjectId;

  @Prop({ required: true })
  userId: string;

  @Prop()
  vapiCallId: string; // Vapi's own ID for the call

  @Prop({ default: 'active' })
  status: string; // active | ended

  @Prop()
  startedAt: Date;

  @Prop()
  endedAt: Date;
}

export const VoiceSessionSchema = SchemaFactory.createForClass(VoiceSession);