import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Req,
  Body,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Headers,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'pdf', maxCount: 1 },
      { name: 'cover', maxCount: 1 },
    ]),
  )
  async uploadBook(
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateBookDto,
    @UploadedFiles()
    files: {
      pdf: Express.Multer.File[];
      cover?: Express.Multer.File[];
    },
  ) {
    if (!files.pdf || files.pdf.length === 0) {
      throw new BadRequestException('PDF file is required');
    }
    return this.booksService.createWithFiles(
      dto,
      userId,
      files.pdf[0],
      files.cover?.[0],
    );
  }

  @Get()
  async getMyBooks(@Req() req: any) {
    const userId = req.headers['x-user-id'];
    return this.booksService.findAllByUser(userId);
  }

  @Get(':id')
  async getBook(@Param('id') id: string) {
    return this.booksService.getBookWithUrls(id);
  }

  @Delete(':id')
  async deleteBook(@Param('id') id: string, @Req() req: any) {
    const userId = req.headers['x-user-id'];
    return this.booksService.deleteBook(id, userId);
  }
}