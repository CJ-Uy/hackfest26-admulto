-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY
);

-- CreateTable
CREATE TABLE "Scroll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "paperCount" INTEGER NOT NULL,
    "exportData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Paper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scrollId" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "authors" TEXT NOT NULL,
    "journal" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "doi" TEXT NOT NULL,
    "peerReviewed" BOOLEAN NOT NULL,
    "synthesis" TEXT NOT NULL,
    "credibilityScore" INTEGER NOT NULL,
    "citationCount" INTEGER NOT NULL,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "apaCitation" TEXT NOT NULL,
    CONSTRAINT "Paper_scrollId_fkey" FOREIGN KEY ("scrollId") REFERENCES "Scroll" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
