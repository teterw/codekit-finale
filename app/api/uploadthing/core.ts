import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getPusherServer } from '@/lib/pusher';

const f = createUploadthing();

export const ourFileRouter = {
  avatarUploader: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const rawId = req.headers.get('x-user-id');
      const userId = Number(rawId);
      console.log('[UT middleware] x-user-id header:', rawId, '→ userId:', userId);
      if (!userId || isNaN(userId)) {
        console.error('[UT middleware] REJECTED — invalid userId');
        throw new UploadThingError('Unauthorized');
      }
      console.log('[UT middleware] PASSED for userId', userId);
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log('[UT onUploadComplete] file keys:', Object.keys(file));
      console.log('[UT onUploadComplete] file.url:', (file as unknown as Record<string, unknown>).url);
      console.log('[UT onUploadComplete] file.ufsUrl:', file.ufsUrl);
      console.log('[UT onUploadComplete] file.name:', file.name, '| file.size:', file.size);
      console.log('[UT onUploadComplete] metadata.userId:', metadata.userId);

      const url = file.ufsUrl;
      if (!url) {
        console.error('[UT onUploadComplete] ERROR — ufsUrl is empty/undefined!');
      }

      try {
        await db.update(users).set({ avatar: url, updatedAt: new Date() }).where(eq(users.id, metadata.userId));
        console.log('[UT onUploadComplete] DB updated OK');
      } catch (dbErr) {
        console.error('[UT onUploadComplete] DB update FAILED:', dbErr);
      }

      try {
        await getPusherServer().trigger(`user-${metadata.userId}`, 'profile-updated', { avatar: url });
        console.log('[UT onUploadComplete] Pusher triggered OK');
      } catch (pusherErr) {
        console.warn('[UT onUploadComplete] Pusher trigger failed (non-fatal):', pusherErr);
      }

      console.log('[UT onUploadComplete] returning url:', url);
      return { url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
