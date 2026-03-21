import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

// ────────────────────────────────────────────────
// Tables
// ────────────────────────────────────────────────

export const users = sqliteTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
});

export const scrolls = sqliteTable("scroll", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description").notNull(),
  mode: text("mode").notNull(),
  date: text("date").notNull(),
  paperCount: integer("paper_count").notNull(),
  exportData: text("export_data"),
  status: text("status").notNull().default("complete"),
  progress: text("progress"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const papers = sqliteTable("paper", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  scrollId: text("scroll_id")
    .notNull()
    .references(() => scrolls.id, { onDelete: "cascade" }),
  externalId: text("external_id"),
  title: text("title").notNull(),
  authors: text("authors").notNull(), // JSON stringified array
  journal: text("journal").notNull(),
  year: integer("year").notNull(),
  doi: text("doi").notNull(),
  peerReviewed: integer("peer_reviewed", { mode: "boolean" }).notNull(),
  synthesis: text("synthesis").notNull(),
  credibilityScore: integer("credibility_score").notNull(),
  citationCount: integer("citation_count").notNull(),
  commentCount: integer("comment_count").notNull().default(0),
  apaCitation: text("apa_citation").notNull(),
  isUserUpload: integer("is_user_upload", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const comments = sqliteTable("comment", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  paperId: text("paper_id")
    .notNull()
    .references(() => papers.id, { onDelete: "cascade" }),
  userPostId: text("user_post_id").references(() => userPosts.id, {
    onDelete: "cascade",
  }),
  parentId: text("parent_id"), // self-referential for threading
  content: text("content").notNull(),
  author: text("author").notNull().default("You"),
  isGenerated: integer("is_generated", { mode: "boolean" })
    .notNull()
    .default(false),
  relationship: text("relationship"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const votes = sqliteTable("vote", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  paperId: text("paper_id")
    .notNull()
    .unique()
    .references(() => papers.id, { onDelete: "cascade" }),
  value: integer("value").notNull().default(1),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const polls = sqliteTable("poll", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  scrollId: text("scroll_id")
    .notNull()
    .references(() => scrolls.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  question: text("question").notNull(),
  options: text("options"), // JSON stringified array or null
  category: text("category").notNull().default("poll"), // "poll" | "fine-tune"
});

export const pollResponses = sqliteTable("poll_response", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  pollId: text("poll_id")
    .notNull()
    .unique()
    .references(() => polls.id, { onDelete: "cascade" }),
  answer: text("answer").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const bookmarks = sqliteTable("bookmark", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  paperId: text("paper_id")
    .notNull()
    .unique()
    .references(() => papers.id, { onDelete: "cascade" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const userPosts = sqliteTable("user_post", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  scrollId: text("scroll_id")
    .notNull()
    .references(() => scrolls.id, { onDelete: "cascade" }),
  title: text("title"),
  content: text("content").notNull(),
  commentCount: integer("comment_count").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ────────────────────────────────────────────────
// Relations (for Drizzle relational queries)
// ────────────────────────────────────────────────

export const scrollsRelations = relations(scrolls, ({ many }) => ({
  papers: many(papers),
  polls: many(polls),
  userPosts: many(userPosts),
}));

export const papersRelations = relations(papers, ({ one, many }) => ({
  scroll: one(scrolls, {
    fields: [papers.scrollId],
    references: [scrolls.id],
  }),
  comments: many(comments),
  votes: many(votes),
  bookmarks: many(bookmarks),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  paper: one(papers, {
    fields: [comments.paperId],
    references: [papers.id],
  }),
  userPost: one(userPosts, {
    fields: [comments.userPostId],
    references: [userPosts.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "commentThread",
  }),
  replies: many(comments, { relationName: "commentThread" }),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  paper: one(papers, {
    fields: [votes.paperId],
    references: [papers.id],
  }),
}));

export const pollsRelations = relations(polls, ({ one, many }) => ({
  scroll: one(scrolls, {
    fields: [polls.scrollId],
    references: [scrolls.id],
  }),
  responses: many(pollResponses),
}));

export const pollResponsesRelations = relations(pollResponses, ({ one }) => ({
  poll: one(polls, {
    fields: [pollResponses.pollId],
    references: [polls.id],
  }),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  paper: one(papers, {
    fields: [bookmarks.paperId],
    references: [papers.id],
  }),
}));

export const userPostsRelations = relations(userPosts, ({ one, many }) => ({
  scroll: one(scrolls, {
    fields: [userPosts.scrollId],
    references: [scrolls.id],
  }),
  comments: many(comments),
}));
