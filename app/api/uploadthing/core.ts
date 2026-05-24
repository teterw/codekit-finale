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
      const userId = Number(req.headers.get('x-user-id'));
      if (!userId || isNaN(userId)) throw new UploadThingError('Unauthorized');
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const url = file.ufsUrl;
      await db.update(users).set({ avatar: url, updatedAt: new Date() }).where(eq(users.id, metadata.userId));
      try {
        await getPusherServer().trigger(`user-${metadata.userId}`, 'profile-updated', { avatar: url });
      } catch { /* Pusher not configured */ }
      return { url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
