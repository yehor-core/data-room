-- Report existing duplicates before creating the unique indexes below, and stop if there are any.
-- Nothing in this migration is applied then. Rename or delete the duplicates, then
--   npx prisma migrate resolve --rolled-back 20261119120000_unique_names
-- and deploy again.
DO $$
DECLARE
  duplicates text;
BEGIN
  SELECT string_agg(line, E'\n' ORDER BY line) INTO duplicates FROM (
    SELECT format('data room name "%s" is used %s times by user %s', name, count(*), user_id) AS line
    FROM data_rooms GROUP BY user_id, name HAVING count(*) > 1
    UNION ALL
    SELECT format('folder name "%s" is used %s times in data room %s %s', name, count(*), data_room_id,
                  coalesce('in folder ' || parent_folder_id, 'at the root'))
    FROM folders GROUP BY data_room_id, parent_folder_id, name HAVING count(*) > 1
    UNION ALL
    SELECT format('file name "%s" is used %s times in data room %s %s', name, count(*), data_room_id,
                  coalesce('in folder ' || folder_id, 'at the root'))
    FROM files GROUP BY data_room_id, folder_id, name HAVING count(*) > 1
  ) AS report;

  IF duplicates IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate names prevent the unique name indexes. Rename or delete them, then deploy again.'
      USING DETAIL = duplicates;
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "data_rooms_user_id_name_key" ON "data_rooms"("user_id", "name");

-- DropIndex: covered by data_rooms_user_id_name_key
DROP INDEX "data_rooms_user_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "folders_data_room_id_parent_folder_id_name_key" ON "folders"("data_room_id", "parent_folder_id", "name");

-- DropIndex: covered by folders_data_room_id_parent_folder_id_name_key
DROP INDEX "folders_data_room_id_idx";
DROP INDEX "folders_data_room_id_parent_folder_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "files_data_room_id_folder_id_name_key" ON "files"("data_room_id", "folder_id", "name");

-- DropIndex: covered by files_data_room_id_folder_id_name_key
DROP INDEX "files_data_room_id_idx";
DROP INDEX "files_data_room_id_folder_id_idx";

-- CreateIndex: NULLs are distinct in a unique index, so the root level (no parent folder) needs partial indexes.
-- schema.prisma can't express them; Prisma ignores partial indexes when diffing, so they don't show up as drift.
CREATE UNIQUE INDEX "folders_root_name_key" ON "folders"("data_room_id", "name") WHERE "parent_folder_id" IS NULL;
CREATE UNIQUE INDEX "files_root_name_key" ON "files"("data_room_id", "name") WHERE "folder_id" IS NULL;
