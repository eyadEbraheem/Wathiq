import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';
import { BrevoOtpSender } from 'src/auth/otp/brevo-otp-sender';
import { ConsoleOtpSender } from 'src/auth/otp/console-otp-sender';
import { GmailOtpSender } from 'src/auth/otp/gmail-otp-sender';
import { OtpSender } from 'src/auth/otp/otp-sender';
import { OtpService } from 'src/auth/otp/otp.service';
import { TokensService } from 'src/auth/tokens.service';

/** Global so JwtAuthGuard / RoleGuard can be used by every feature module. */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    TokensService,
    JwtAuthGuard,
    RoleGuard,
    // EMAIL_PROVIDER=gmail or brevo sends real emails; anything else (the default) logs the
    // code, for development and tests.
    {
      provide: OtpSender,
      inject: [ConfigService],
      useFactory: (config: ConfigService): OtpSender => {
        switch (config.get<string>('EMAIL_PROVIDER')) {
          case 'gmail':
            return new GmailOtpSender(config);
          case 'brevo':
            return new BrevoOtpSender(config);
          default:
            return new ConsoleOtpSender();
        }
      },
    },
  ],
  exports: [JwtModule, JwtAuthGuard, RoleGuard, TokensService],
})
export class AuthModule {}
