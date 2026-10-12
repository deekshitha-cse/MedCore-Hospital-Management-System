import { Module } from '@nestjs/common';
import { RedisModule } from './infrastructure/redis/redis.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [RedisModule, PrismaModule, AuthModule],
})
export class AppModule {}
