import { Controller, Get, Post, Body, Param, Req } from '@nestjs/common';
import { BooksService } from './books.service';

@Controller('books') // all routes here are prefixed /api/books
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  async getMyBooks(@Req() req: any) {
    const userId = req.headers['x-user-id']; // we'll replace this with real auth later
    return this.booksService.findAllByUser(userId);
  }

  @Get(':id')
  async getBook(@Param('id') id: string) {
    return this.booksService.findById(id);
  }
}