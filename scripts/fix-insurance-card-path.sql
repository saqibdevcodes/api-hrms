-- Fix insurance card image paths that have absolute server paths
-- This script replaces absolute paths with relative /uploads/ paths

-- Preview affected records first (run this to see what will change)
SELECT
    id,
    "firstName",
    "lastName",
    "insuranceCardPicture" as current_path,
    CASE
        WHEN "insuranceCardPicture" LIKE '/home/%/uploads/%' THEN '/uploads/' || substring(
            "insuranceCardPicture"
            from '.*/uploads/(.*)$'
        )
        ELSE "insuranceCardPicture"
    END as new_path
FROM "User"
WHERE
    "insuranceCardPicture" LIKE '/home/%';

-- Uncomment the following UPDATE statement to actually fix the paths
-- UPDATE "User"
-- SET "insuranceCardPicture" = '/uploads/' || substring("insuranceCardPicture" from '.*/uploads/(.*)$')
-- WHERE "insuranceCardPicture" LIKE '/home/%/uploads/%';

-- Also fix any other document fields that might have the same issue
-- SELECT
--   id,
--   "firstName",
--   "lastName",
--   "cnicPictureFront" as cnic_front,
--   "cnicPictureBack" as cnic_back,
--   "degreePicture" as degree
-- FROM "User"
-- WHERE "cnicPictureFront" LIKE '/home/%'
--    OR "cnicPictureBack" LIKE '/home/%'
--    OR "degreePicture" LIKE '/home/%';