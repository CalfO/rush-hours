import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHello(): Promise<string> {
    const record = await this.prisma.hello.findUnique({
      where: { key: 'hello' },
    });

    if (!record) {
      throw new NotFoundException('hello key not found');
    }

    return record.value;
  }
}
