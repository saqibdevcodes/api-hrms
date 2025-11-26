-- Fix hasInsurance field for employees that have insurance data but hasInsurance is false
-- This script updates hasInsurance to true for any employee that has insurance card number

-- Preview affected records first (run this to see what will change)
SELECT
    id,
    "firstName",
    "lastName",
    "employeeId",
    "hasInsurance" as current_hasInsurance,
    "insuranceCardNo",
    "insuranceInsuredName",
    CASE
        WHEN "insuranceCardNo" IS NOT NULL
        AND "insuranceCardNo" != '' THEN true
        ELSE "hasInsurance"
    END as new_hasInsurance
FROM users
WHERE
    "employeeId" IS NOT NULL
    AND (
        "insuranceCardNo" IS NOT NULL
        AND "insuranceCardNo" != ''
    )
    AND "hasInsurance" = false;

-- Uncomment the following UPDATE statement to actually fix the hasInsurance field
-- UPDATE users
-- SET "hasInsurance" = true
-- WHERE "employeeId" IS NOT NULL
--   AND ("insuranceCardNo" IS NOT NULL AND "insuranceCardNo" != '')
--   AND "hasInsurance" = false;

-- After running the update, check how many records were affected:
-- SELECT COUNT(*) as fixed_records
-- FROM users
-- WHERE "employeeId" IS NOT NULL
--   AND ("insuranceCardNo" IS NOT NULL AND "insuranceCardNo" != '')
--   AND "hasInsurance" = true;