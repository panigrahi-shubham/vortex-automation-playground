import { User } from '@prisma/client';
export const publicProfile = (u: User) => ({ id: u.id, username: u.username, email: u.email, name: u.name, phone: u.phone, avatar: u.avatar, role: u.role, createdAt: u.createdAt });
export const validPassword = (p: unknown): p is string => typeof p === 'string' && p.length >= 8 && p.length <= 128 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);
