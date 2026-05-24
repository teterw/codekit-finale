import { pgTable, serial, text, timestamp, integer, primaryKey, uniqueIndex } from 'drizzle-orm/pg-core';

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
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

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
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('voice_participants_channel_user').on(t.channelId, t.userId),
]);

export const directConversations = pgTable('direct_conversations', {
  id: serial('id').primaryKey(),
  name: text('name'),
  type: text('type').notNull().default('dm'),
  ownerId: integer('owner_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const directConversationMembers = pgTable('direct_conversation_members', {
  conversationId: integer('conversation_id').notNull(),
  userId: integer('user_id').notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.conversationId, t.userId] }),
]);

export const directMessages = pgTable('direct_messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull(),
  userId: integer('user_id').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const messageThreads = pgTable('message_threads', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id').notNull(),
  channelId: integer('channel_id').notNull(),
  title: text('title').notNull(),
  createdById: integer('created_by_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('message_threads_message_unique').on(t.messageId),
]);

export const threadMessages = pgTable('thread_messages', {
  id: serial('id').primaryKey(),
  threadId: integer('thread_id').notNull(),
  userId: integer('user_id').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  serverId: integer('server_id').notNull(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#7c6bff'),
  permissions: text('permissions').notNull().default('view,chat,voice'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const memberRoles = pgTable('member_roles', {
  userId: integer('user_id').notNull(),
  serverId: integer('server_id').notNull(),
  roleId: integer('role_id').notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.serverId, t.roleId] }),
]);

export const announcementChannels = pgTable('announcement_channels', {
  id: serial('id').primaryKey(),
  serverId: integer('server_id').notNull(),
  channelId: integer('channel_id').notNull(),
  headline: text('headline').notNull(),
  followersCount: integer('followers_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const customAssets = pgTable('custom_assets', {
  id: serial('id').primaryKey(),
  serverId: integer('server_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull().default('emoji'),
  url: text('url').notNull(),
  createdById: integer('created_by_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const onboardingPrompts = pgTable('onboarding_prompts', {
  id: serial('id').primaryKey(),
  serverId: integer('server_id').notNull(),
  kind: text('kind').notNull().default('rule'),
  label: text('label').notNull(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const serverActivities = pgTable('server_activities', {
  id: serial('id').primaryKey(),
  serverId: integer('server_id').notNull(),
  channelId: integer('channel_id'),
  name: text('name').notNull(),
  type: text('type').notNull().default('activity'),
  status: text('status').notNull().default('scheduled'),
  metadata: text('metadata').notNull().default('{}'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const botIntegrations = pgTable('bot_integrations', {
  id: serial('id').primaryKey(),
  serverId: integer('server_id').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  status: text('status').notNull().default('enabled'),
  config: text('config').notNull().default('{}'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const richPresence = pgTable('rich_presence', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  provider: text('provider').notNull(),
  activity: text('activity').notNull(),
  details: text('details'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const profiles = pgTable('profiles', {
  userId: integer('user_id').primaryKey(),
  banner: text('banner'),
  about: text('about'),
  theme: text('theme').notNull().default('midnight'),
  decoration: text('decoration'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const shopItems = pgTable('shop_items', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  rarity: text('rarity').notNull().default('standard'),
  priceCents: integer('price_cents').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const quests = pgTable('quests', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  reward: text('reward').notNull(),
  progressTarget: integer('progress_target').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const premiumSubscriptions = pgTable('premium_subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  plan: text('plan').notNull().default('nitro'),
  status: text('status').notNull().default('active'),
  renewsAt: timestamp('renews_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const serverBoosts = pgTable('server_boosts', {
  id: serial('id').primaryKey(),
  serverId: integer('server_id').notNull(),
  userId: integer('user_id').notNull(),
  level: integer('level').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const streamSessions = pgTable('stream_sessions', {
  id: serial('id').primaryKey(),
  channelId: integer('channel_id').notNull(),
  userId: integer('user_id').notNull(),
  source: text('source').notNull().default('screen'),
  status: text('status').notNull().default('live'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
});

export const soundboardClips = pgTable('soundboard_clips', {
  id: serial('id').primaryKey(),
  serverId: integer('server_id').notNull(),
  name: text('name').notNull(),
  url: text('url'),
  createdById: integer('created_by_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
