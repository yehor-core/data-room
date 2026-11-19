-- AlterTable: files are limited to a few megabytes, so an integer is enough and serializes as a plain JSON number.
ALTER TABLE "files" ALTER COLUMN "file_size" SET DATA TYPE INTEGER;
