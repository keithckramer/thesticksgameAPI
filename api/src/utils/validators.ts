import { z } from 'zod';

const stripTags = (value: string): string => value.replace(/<[^>]*>/g, '');

const sanitize = (value: string): string => stripTags(value).trim();

const emailSanitizer = (value: string): string => sanitize(value).toLowerCase();

export const emailSchema = z
  .string({ required_error: 'Email is required.' })
  .min(1, 'Email is required.')
  .transform(emailSanitizer)
  .pipe(z.string().email('Invalid email address.'));

export const phoneSchema = z
  .string()
  .transform(sanitize)
  .refine((value) => /^\+[1-9]\d{1,14}$/.test(value), {
    message: 'Phone number must be in E.164 format.',
  });

const passwordStrength = (value: string): boolean => {
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  return hasUpper && hasLower && hasNumber && hasSymbol;
};

export const passwordSchema = z
  .string({ required_error: 'Password is required.' })
  .min(12, 'Password must be at least 12 characters long.')
  .refine(passwordStrength, {
    message: 'Password must include uppercase, lowercase, number, and special character.',
  });

export const createUserInputSchema = () =>
  z
    .object({
      email: emailSchema,
      phone: phoneSchema.optional(),
      password: passwordSchema,
    })
    .transform((data) => ({
      ...data,
      phone: data.phone ?? undefined,
    }));

export type UserInput = z.infer<ReturnType<typeof createUserInputSchema>>;

export const sanitizeString = (value: string): string => sanitize(value);

export const parseUserInput = (input: unknown): UserInput => createUserInputSchema().parse(input);
