import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const file = sqliteTable('file', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  fileName: text('fileName').notNull(),
  fileSize: integer('fileSize'), // in bytes
  uploader: text('uploader').notNull(),
  uploadTime: integer('uploadTime', { mode: 'timestamp' }),
  status: text('status').notNull(), // 'Pending', 'Timeout', 'Expired', 'Error', 'Uploaded', 'Published'
  errorMessage: text('errorMessage'), // When status is 'Error'
});

export const githubBind = sqliteTable('github_bind', {
  id: text('id').primaryKey(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  repo: text('repo'),
});

export const githubInstallation = sqliteTable('github_installation', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  installationId: integer('installationId').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});