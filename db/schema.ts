import { pgTable, serial, text, timestamp, integer, primaryKey, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  password: text('password').notNull(),
  avatar: text('avatar'),
  status: text('status').notNull().default('offline'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (users) => ({
  uniqueEmail: uniqueIndex('users_email_unique').on(users.email),
}));

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
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const members = pgTable('members', {
  userId: integer('user_id').notNull(),
  serverId: integer('server_id').notNull(),
  role: text('role').notNull().default('member'),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
}, (members) => ({
  pk: primaryKey(members.userId, members.serverId),
}));

export const invites = pgTable('invites', {
  id: serial('id').primaryKey(),
  serverId: integer('server_id').notNull(),
  code: text('code').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
}, (invites) => ({
  uniqueCode: uniqueIndex('invites_code_unique').on(invites.code),
}));
