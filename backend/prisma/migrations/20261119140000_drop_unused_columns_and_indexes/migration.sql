-- AlterTable: sign-in is OAuth only, so no password is ever stored.
ALTER TABLE "users" DROP COLUMN "password";

-- AlterTable: nothing reads or writes a data room description.
ALTER TABLE "data_rooms" DROP COLUMN "description";

-- DropIndex: folders are never sorted by creation date.
DROP INDEX "folders_created_at_idx";
