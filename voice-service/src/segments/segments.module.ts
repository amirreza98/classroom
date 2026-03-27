import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SegmentsService } from './segments.service';
import { Segment, SegmentSchema } from './segments.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Segment.name, schema: SegmentSchema }]),
  ],
  providers: [SegmentsService],
  exports: [SegmentsService],
})
export class SegmentsModule {}