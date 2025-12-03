# SuperAdmin Guide - Force Fetch & Force Finalize

## 🎯 Overview

As a SuperAdmin, you have special privileges to:
1. **Force Fetch**: View attendance records before the 3-day delay
2. **Force Finalize**: Immediately finalize staging records without waiting 3 days

---

## 📊 1. Force Fetch Attendance (View Before 3 Days)

### API Endpoint:
```
GET /api/v1/zkteco/attendance/data?forceFetch=true
```

### Full URL:
```
https://test.iriscommunications.cloud/api/v1/zkteco/attendance/data?page=1&limit=20&forceFetch=true
```

### Headers:
```
Authorization: Bearer YOUR_SUPERADMIN_TOKEN
```

### Response:
```json
{
  "success": true,
  "message": "Attendance data retrieved successfully",
  "data": {
    "records": [
      {
        "id": "cmin2adu30003xgpju57zyzuz",
        "date": "2025-12-01T00:00:00.000Z",
        "checkIn": "2025-12-01T14:16:02.000Z",
        "checkOut": "2025-12-01T14:16:19.000Z",
        "status": "PRESENT",
        "employee": {
          "id": "cmih46j2n000rcigsu2n377cl",
          "employeeId": "1",
          "name": "Saqib Javaid",
          "email": "saqibirisco@gmail.com"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

### Without `forceFetch`:
- Normal users (HR, Admin): See records **3+ days old only**
- SuperAdmin without `forceFetch`: Same as normal users

### With `forceFetch=true`:
- **SuperAdmin only**: See **ALL records** (including today's)

---

## 🚀 2. Force Finalize All Staging Records

### API Endpoint:
```
POST /api/v1/zkteco/attendance/force-finalize-all
```

### Full URL:
```
https://test.iriscommunications.cloud/api/v1/zkteco/attendance/force-finalize-all
```

### Headers:
```
Authorization: Bearer YOUR_SUPERADMIN_TOKEN
Content-Type: application/json
```

### Request Body:
```json
{}
```
(No body needed)

### Response:
```json
{
  "success": true,
  "message": "Finalized 2 records with 0 errors",
  "data": {
    "finalized": 2,
    "errors": 0
  }
}
```

### What it does:
1. Finds all unfinalized staging records (regardless of age)
2. Moves them to `zkteco_attendance_records` table
3. Creates/updates `attendances` table
4. Marks staging records as `isFinalized = true`

---

## 🕐 3. Run Finalization Cron Manually

### API Endpoint:
```
POST /api/v1/zkteco/attendance/run-finalization-cron
```

### Full URL:
```
https://test.iriscommunications.cloud/api/v1/zkteco/attendance/run-finalization-cron
```

### Headers:
```
Authorization: Bearer YOUR_SUPERADMIN_TOKEN
Content-Type: application/json
```

### Request Body:
```json
{}
```
(No body needed)

### Response:
```json
{
  "success": true,
  "message": "Finalized 5 records (3+ days old) with 0 errors",
  "data": {
    "finalized": 5,
    "errors": 0
  }
}
```

### What it does:
1. Finds staging records that are **3+ days old**
2. Moves them to final tables
3. Creates attendance records
4. This is what the automatic cron job does

### Difference from Force Finalize:
- **Force Finalize All**: Finalizes **ALL** staging records (any age)
- **Run Cron**: Finalizes only **3+ days old** records

---

## 📋 Complete Workflow Example

### Scenario: Employee punches in/out today

1. **Immediate** (Device → Server):
   ```
   Employee punches → Goes to zkteco_attendance_staging
   ```

2. **Check Staging** (SuperAdmin):
   ```sql
   SELECT * FROM zkteco_attendance_staging WHERE isFinalized = 0;
   ```
   Result: 2 records (check_in, check_out)

3. **Force Finalize** (SuperAdmin):
   ```bash
   POST /api/v1/zkteco/attendance/force-finalize-all
   ```
   Result: Records moved to final tables + attendance created

4. **View Attendance** (SuperAdmin with forceFetch):
   ```bash
   GET /api/v1/zkteco/attendance/data?forceFetch=true
   ```
   Result: ✅ Attendance visible immediately

5. **View Attendance** (Normal HR/Admin):
   ```bash
   GET /api/v1/zkteco/attendance/data
   ```
   Result: ❌ Empty (must wait 3 days OR SuperAdmin force finalize)

---

## 🔒 Security

### Who can use these features?

| Feature | SuperAdmin | Admin | HR | Employee |
|---------|-----------|-------|-----|----------|
| Force Fetch (`forceFetch=true`) | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Force Finalize All | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Run Cron Manually | ✅ Yes | ❌ No | ❌ No | ❌ No |
| View 3+ day old attendance | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Own only |

---

## 🐛 Troubleshooting

### Issue: "No attendance records showing"

**Solution 1**: Use `forceFetch=true` (SuperAdmin only)
```
GET /api/v1/zkteco/attendance/data?forceFetch=true
```

**Solution 2**: Wait 3 days for automatic finalization

**Solution 3**: Force finalize immediately
```
POST /api/v1/zkteco/attendance/force-finalize-all
```

### Issue: "Staging records not finalizing"

**Check 1**: Are records in staging?
```sql
SELECT COUNT(*) FROM zkteco_attendance_staging WHERE isFinalized = 0;
```

**Check 2**: Force finalize manually
```
POST /api/v1/zkteco/attendance/force-finalize-all
```

**Check 3**: Check for errors
```sql
SELECT * FROM zkteco_attendance_staging WHERE processingError IS NOT NULL;
```

---

## 📊 Database Tables Overview

```
┌─────────────────────────────────────┐
│ zkteco_attendance_staging           │
│ (Temporary - 3 days)                │
│ - isFinalized: false                │
│ - Visible to: SuperAdmin only       │
└──────────────┬──────────────────────┘
               │ After 3 days OR Force Finalize
               ▼
┌─────────────────────────────────────┐
│ zkteco_attendance_records           │
│ (Final - Permanent)                 │
│ - isFinalized: true (in staging)    │
│ - Visible to: HR, Admin, SuperAdmin │
└──────────────┬──────────────────────┘
               │ Linked via attendanceId
               ▼
┌─────────────────────────────────────┐
│ attendances                         │
│ (Main Attendance Table)             │
│ - Visible to: All (role-based)      │
│ - With forceFetch: All records      │
│ - Without forceFetch: 3+ days old   │
└─────────────────────────────────────┘
```

---

## ✅ Quick Reference

### Frontend Integration

```javascript
// For SuperAdmin: Force fetch all attendance
const fetchAttendanceForSuperAdmin = async () => {
  const response = await fetch(
    'https://test.iriscommunications.cloud/api/v1/zkteco/attendance/data?forceFetch=true&page=1&limit=20',
    {
      headers: {
        'Authorization': `Bearer ${superAdminToken}`
      }
    }
  );
  const data = await response.json();
  return data;
};

// For SuperAdmin: Force finalize staging records
const forceFinalizeStaging = async () => {
  const response = await fetch(
    'https://test.iriscommunications.cloud/api/v1/zkteco/attendance/force-finalize-all',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  const data = await response.json();
  console.log(`Finalized ${data.data.finalized} records`);
  return data;
};
```

---

**Last Updated**: December 1, 2025  
**Version**: 2.0 (Staging Flow with Force Fetch)



