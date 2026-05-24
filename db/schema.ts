import { boolean, pgTable, serial, text, timestamp, integer, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  password: text('password').notNull(),
  avatar: text('avatar'),
  username: text('username'),
  bio: text('bio'),
  status: text('status').notNull().default('offline'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at'),
}, (t) => [
  uniqueIndex('users_email_unique').on(t.email),
]);

export const servers = pgTable('servers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon'),
  ownerId: integer('owner_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const channels = pgTable('channels', {
  id: serial('id').primaryKey(),
  serverId: integer('server_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull().default('text'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  channelId: integer('channel_id').notNull(),
  userId: integer('user_id').notNull(),
  content: text('content').notNull(),
  replyToId: integer('reply_to_id'),
  isPinned: boolean('is_pinned').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const messageReactions = pgTable('message_reactions', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id').notNull(),
  userId: integer('user_id').notNull(),
  emoji: text('emoji').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('message_reactions_unique').on(t.messageId, t.userId, t.emoji),
]);

export const members = pgTable('members', {
  userId: integer('user_id').notNull(),
  serverId: integer('server_id').notNull(),
  role: text('role').notNull().default('member'),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.serverId] }),
]);

export const invites = pgTable('invites', {
  id: serial('id').primaryKey(),
  serverId: integer('server_id').notNull(),
  code: text('code').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
}, (t) => [
  uniqueIndex('invites_code_unique').on(t.code),
]);

export const voiceParticipants = pgTable('voice_participants', {
  id: serial('id').primaryKey(),
  channelId: integer('channel_id').notNull(),
  userId: integer('user_id').notNull(),
  peerId: text('peer_id').notNull(),
  isMuted: boolean('is_muted').notNull().default(false),
  isDeafened: boolean('is_deafened').notNull().default(false),
  isSpeaking: boolean('is_speaking').notNull().default(false),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('voice_participants_channel_user').on(t.channelId, t.userId),
]);
