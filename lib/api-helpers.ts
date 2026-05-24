import { NextResponse } from 'next/server';
import { randomBytes, scryptSync } from 'crypto';

export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function getUserId(request: Request): number | null {
  const idHeader = request.headers.get('x-user-id');
  if (!idHeader) return null;
  const id = Number(idHeader);
  return Number.isNaN(id) ? null : id;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(storedPassword: string, password: string) {
  const [salt, hash] = storedPassword.split(':');
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 64).toString('hex');
  return derived === hash;
}

export function generateInviteCode(length = 8) {
  return randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length).toUpperCase();
}
