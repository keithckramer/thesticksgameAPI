import { randomBytes, createHash } from 'crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import PasswordResetToken from '../models/PasswordResetToken';
import RefreshToken from '../models/RefreshToken';
import User from '../models/User';
import { sendPasswordResetEmail } from '../services/mailer';
import { incrementMetric } from '../utils/metrics';
import { emailSchema, passwordSchema } from '../utils/validators';

const router = Router();

const ONE_HOUR_MS = 60 * 60 * 1000;

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

const resetPasswordSchema = z.object({
  token: z.string({ required_error: 'Token is required.' }).min(1, 'Token is required.'),
  password: passwordSchema,
});

const respondForgotOk = (res: Response): void => {
  res.status(200).json({ message: 'If an account exists, a password reset email has been sent.' });
};

const generateToken = () => randomBytes(48).toString('hex');

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

router.post('/forgot', async (req: Request, res: Response) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    console.warn('Password reset request failed validation.');
    incrementMetric('password.reset.request.invalid');
    respondForgotOk(res);
    return;
  }

  const { email } = parsed.data;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.info('Password reset requested for unknown user.');
      incrementMetric('password.reset.request.unknown');
      respondForgotOk(res);
      return;
    }

    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + ONE_HOUR_MS);

    await PasswordResetToken.updateMany({ userId: user._id, usedAt: null }, { $set: { usedAt: new Date() } });
    await PasswordResetToken.create({ userId: user._id, token: tokenHash, expiresAt });

    await sendPasswordResetEmail({ to: user.email, token: rawToken, expiresAt });

    console.info('Password reset token generated.', { userId: user._id.toString() });
    incrementMetric('password.reset.request.success');
    respondForgotOk(res);
  } catch (error) {
    console.error('Failed to process password reset request.', error);
    incrementMetric('password.reset.request.error');
    respondForgotOk(res);
  }
});

router.post('/reset', async (req: Request, res: Response) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const tokenHash = hashToken(token);

    const resetToken = await PasswordResetToken.findOne({ token: tokenHash });
    if (!resetToken) {
      console.warn('Password reset attempted with missing token.');
      incrementMetric('password.reset.invalid');
      res.status(400).json({ error: 'Invalid or expired token.' });
      return;
    }

    if (resetToken.isUsed() || resetToken.isExpired()) {
      console.warn('Password reset attempted with expired or used token.', {
        tokenId: resetToken._id.toString(),
      });
      incrementMetric('password.reset.invalid');
      res.status(400).json({ error: 'Invalid or expired token.' });
      return;
    }

    const user = await User.findById(resetToken.userId);
    if (!user) {
      console.error('Password reset token references missing user.', {
        tokenId: resetToken._id.toString(),
      });
      incrementMetric('password.reset.invalid');
      res.status(400).json({ error: 'Invalid or expired token.' });
      return;
    }

    resetToken.usedAt = new Date();
    await resetToken.save();

    user.password = password;
    await user.save();

    const now = new Date();
    await RefreshToken.updateMany({ userId: user._id }, { $set: { revokedAt: now } });

    console.info('Password successfully reset.', { userId: user._id.toString() });
    incrementMetric('password.reset.success');
    res.status(200).json({ message: 'Password has been reset.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0]?.message ?? 'Invalid input.' });
      return;
    }

    console.error('Failed to reset password.', error);
    incrementMetric('password.reset.error');
    res.status(500).json({ error: 'Unable to reset password.' });
  }
});

export default router;

