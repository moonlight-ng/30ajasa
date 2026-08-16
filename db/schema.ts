import { sql } from 'drizzle-orm';
import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const bookings = sqliteTable('bookings', {
    id: text('id').primaryKey(),
    classSlug: text('class_slug').notNull(),
    sessionDate: text('session_date').notNull(),
    sessionPeriod: text('session_period', { enum: ['morning', 'evening'] }).notNull(),
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email').notNull(),
    status: text('status', { enum: ['reserved', 'paid', 'cancelled'] }).notNull().default('reserved'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
    index('idx_bookings_session_status').on(table.sessionDate, table.sessionPeriod, table.status),
]);
