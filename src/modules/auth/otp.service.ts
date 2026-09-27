import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Otp } from './entities/otp.entity';
import { SMS_PROVIDER, type SmsProvider } from './sms/sms-provider.interface';

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFY_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(Otp) private otpRepository: Repository<Otp>,
    @Inject(SMS_PROVIDER) private smsProvider: SmsProvider,
  ) {}

  async sendOtp(phone: string): Promise<{ expiresInSeconds: number }> {
    const cooldownStart = new Date(
      Date.now() - RESEND_COOLDOWN_SECONDS * 1000,
    );
    const recentOtp = await this.otpRepository.findOne({
      where: { phone, createdAt: MoreThan(cooldownStart) },
      order: { createdAt: 'DESC' },
    });
    if (recentOtp) {
      throw new BadRequestException(
        `Please wait before requesting another code`,
      );
    }

    const code = this.generateCode();
    console.log("Generated OTP code:", code); // Log the generated OTP code for debugging
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    const otp = this.otpRepository.create({ phone, codeHash, expiresAt });
    await this.otpRepository.save(otp);

    await this.smsProvider.sendOtp(phone, code);

    return { expiresInSeconds: OTP_TTL_MINUTES * 60 };
  }

  async verifyOtp(phone: string, code: string): Promise<void> {
    const otp = await this.otpRepository.findOne({
      where: { phone, isUsed: false },
      order: { createdAt: 'DESC' },
    });

    if (!otp) {
      throw new BadRequestException(
        'No pending code for this phone number. Request a new one.',
      );
    }
    if (otp.expiresAt < new Date()) {
      throw new BadRequestException('Code has expired. Request a new one.');
    }
    if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new BadRequestException(
        'Too many incorrect attempts. Request a new code.',
      );
    }

    const matches = await bcrypt.compare(code, otp.codeHash);
    if (!matches) {
      otp.attempts += 1;
      await this.otpRepository.save(otp);
      throw new BadRequestException('Incorrect code');
    }

    otp.isUsed = true;
    await this.otpRepository.save(otp);
  }

  private generateCode(): string {
    const min = 10 ** (OTP_LENGTH - 1);
    const max = 10 ** OTP_LENGTH - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  async deleteExpiredOtps(): Promise<void> {
  await this.otpRepository
    .createQueryBuilder()
    .delete()
    .where('expiresAt < NOW()')
    .execute();
}
}
