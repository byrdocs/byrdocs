-- Migration number: 0003 	 2025-12-03T01:04:46.694Z
CREATE TABLE "file_new" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "uploader" TEXT NOT NULL,
    "uploadTime" DATETIME,
    "status" TEXT NOT NULL CHECK ("status" IN ('Pending', 'Aborted', 'Timeout', 'Expired', 'Error', 'Uploaded', 'Published')),
    "errorMessage" TEXT
);

-- Copy data from old table
INSERT INTO "file_new" SELECT * FROM "file";

-- Drop old table
DROP TABLE "file";

-- Rename new table
ALTER TABLE "file_new" RENAME TO "file";
