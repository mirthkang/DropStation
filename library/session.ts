'use server'

import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'

// 续期阈值天数
const renewalThresholdDays = 7
const secretExpiryDays = parseInt(process.env.SESSION_EXPIRY_DAYS || '30', 10)

const encodedSessionKey = new TextEncoder().encode(process.env.SESSION_SECRET || 'default_secret')
const sessionCookieName = 'dropstation_session'

export type SessionPayload = {
  userId: number
  expiresAt?: number
}

async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${secretExpiryDays}d`)
    .sign(encodedSessionKey)
}

async function decrypt(session: string | undefined = '') {
  try {
    const { payload }: { payload: SessionPayload } = await jwtVerify(session, encodedSessionKey, {
      algorithms: ['HS256'],
    })
    return payload
  } catch (error) {
    console.error('Failed to verify session', error)
  }
}

export async function createSession(userId: number) {
  const expiresAt = new Date(Date.now() + (secretExpiryDays * 24 * 60 * 60 * 1000))
  const session = await encrypt({ userId, expiresAt: expiresAt.getTime() })
  const cookieStore = await cookies()

  cookieStore.set(sessionCookieName, session, {
    httpOnly: true,
    secure: process.env.SESSION_SECURE === 'true',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
}

export async function getSession() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(sessionCookieName)?.value
  if (!sessionCookie) {
    return null
  }
  const session = await decrypt(sessionCookie)

  if (!session || !session.expiresAt || !session.userId) {
    return null
  }

  const remainingTime = (session.expiresAt - Date.now()) / (24 * 60 * 60 * 1000) // 剩余天数
  if (remainingTime < renewalThresholdDays) {
    console.log('Session is close to expiring, renewing token...')
    await createSession(session.userId)
  }
  return session
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete(sessionCookieName)
}
