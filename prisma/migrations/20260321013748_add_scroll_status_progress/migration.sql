-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Scroll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "paperCount" INTEGER NOT NULL,
    "exportData" TEXT,
    "status" TEXT NOT NULL DEFAULT 'complete',
    "progress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Scroll" ("createdAt", "date", "description", "exportData", "id", "mode", "paperCount", "title") SELECT "createdAt", "date", "description", "exportData", "id", "mode", "paperCount", "title" FROM "Scroll";
DROP TABLE "Scroll";
ALTER TABLE "new_Scroll" RENAME TO "Scroll";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
