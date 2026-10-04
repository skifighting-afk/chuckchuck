import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const stores=sqliteTable('stores',{owner:text('owner').primaryKey(),data:text('data').notNull(),version:integer('version').notNull(),updatedAt:text('updated_at').notNull()});
