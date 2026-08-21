import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { validate } from '../../utils/validate.js';
import { requireAuth, requireRole, adminId } from '../../utils/guard.js';
import { ADMIN_ROLES, RATE_LIMIT } from '../../utils/constants.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';

const service = new AuthService(new AuthRepository());
export const authRouter = Router();

const loginLimiter = rateLimit({ ...RATE_LIMIT.LOGIN, standardHeaders: true, legacyHeaders: false });

const passwordSchema = z.string().min(10, 'Пароль минимум 10 символов').max(128);

const loginSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(1).max(128),
});

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80),
  password: passwordSchema,
  role: z.enum(ADMIN_ROLES),
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const admin = await service.login(validate(loginSchema, req.body));
  req.session.regenerate((err) => {
    if (err) throw err;
    req.session.admin = admin;
    res.json({ ok: true, data: admin });
  });
});

authRouter.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true, data: null }));
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ ok: true, data: req.session.admin });
});

authRouter.post('/bootstrap', loginLimiter, async (req, res) => {
  const admin = await service.bootstrap(validate(createSchema.omit({ role: true }), req.body));
  res.status(201).json({ ok: true, data: admin });
});

authRouter.post('/password', requireAuth, async (req, res) => {
  const data = validate(
    z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }),
    req.body,
  );
  await service.changePassword({ id: adminId(req), ...data });
  res.json({ ok: true, data: null });
});

authRouter.get('/admins', requireAuth, requireRole('admin'), async (req, res) => {
  res.json({ ok: true, data: await service.list() });
});

authRouter.post('/admins', requireAuth, requireRole('owner'), async (req, res) => {
  const admin = await service.create(validate(createSchema, req.body), adminId(req));
  res.status(201).json({ ok: true, data: admin });
});

authRouter.post('/admins/:id/password', requireAuth, requireRole('owner'), async (req, res) => {
  const { newPassword } = validate(z.object({ newPassword: passwordSchema }), req.body);
  await service.resetPassword({ id: Number(req.params.id), newPassword }, adminId(req));
  res.json({ ok: true, data: null });
});

authRouter.post('/admins/:id/active', requireAuth, requireRole('owner'), async (req, res) => {
  const { isActive } = validate(z.object({ isActive: z.boolean() }), req.body);
  const admin = await service.setActive(Number(req.params.id), isActive, adminId(req));
  res.json({ ok: true, data: admin });
});
