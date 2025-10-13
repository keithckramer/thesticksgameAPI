import { z } from 'zod';

const stripTags = (value: string): string => value.replace(/<[^>]*>/g, '');

const sanitize = (value: string): string => stripTags(value).trim();

const emailSanitizer = (value: string): string => sanitize(value).toLowerCase();

export const emailSchema = z
  .string({ required_error: 'Email is required.' })
  .min(1, 'Email is required.')
  .transform(emailSanitizer)
  .pipe(z.string().email('Enter a valid email'));

export const phoneSchema = z.string().transform(sanitize);

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

export const sanitizeString = (value: string): string => sanitize(value);

export const registerSchema = z
  .object({
    name: z
      .string({ required_error: 'Name is required.' })
      .transform(sanitizeString)
      .pipe(z.string().min(1, 'Name is required.')),
    email: emailSchema,
    password: passwordSchema,
    phone: phoneSchema.optional(),
  })
  .transform((data) => ({
    ...data,
    phone: data.phone ?? undefined,
  }));

export type RegisterInput = z.infer<typeof registerSchema>;
