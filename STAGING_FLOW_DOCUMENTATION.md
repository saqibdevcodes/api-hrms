# ZKTeco Attendance 3-Day Staging Flow

## 🎯 Overview

The system now implements a **3-day staging period** for all attendance records before they become visible to HR/Admin. This ensures data accuracy and allows for corrections before finalization.

## 📊 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Employee Punches on ZKTeco Device                      │
│ (Fingerprint/Face scan)                                         │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Device Sends Data to Server (Immediate)                │
│ POST /api/v1/zkteco/iclock/cdata                               │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Save to STAGING Table (Immediate)                      │
│ Table: zkteco_attendance_staging                                │
│ Status: isFinalized = false                                     │
│ ⏳ WAITS 3 DAYS                                                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ (After 3 days OR SuperAdmin force finalize)
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Finalization Cron Job Runs                             │
│ File: src/cron/finalizeStagingRecords.ts                       │
│ Service: src/services/finalizationService.ts                   │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Move to FINAL Table                                    │
│ Table: zkteco_attendance_records                                │
│ Status: isFinalized = true                                      │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Create/Update Attendance Record                        │
│ Table: attendances                                              │
│ ✅ NOW VISIBLE TO HR/ADMIN                                      │
└─────────────────────────────────────────────────────────────────┘
```

## 🗂️ Database Tables

### 1. `zkteco_attendance_staging` (Temporary - 3 days)
- **Purpose**: Holds unverified attendance data for 3 days
- **Visible to**: SuperAdmin only (with force fetch)
- **Key Fields**:
  - `isFinalized`: false (until moved to final table)
  - `createdAt`: Used to determine 3-day threshold
  - `finalizedAt`: Set when moved to final table
  - `finalizedBy`: User ID if manually finalized

### 2. `zkteco_attendance_records` (Final)
- **Purpose**: Verified attendance records after 3 days
- **Visible to**: HR, Admin, SuperAdmin
- **Key Fields**:
  - `finalizedFrom`: Links back to staging record
  - `finalizedAt`: When it was finalized
  - `attendanceId`: Links to attendance table

### 3. `attendances` (Main Attendance Table)
- **Purpose**: Daily attendance summary
- **Visible to**: All users (based on role)
- **Created**: Only after finalization (3+ days)

## 🔧 Key Files Modified

### 1. `/src/services/zktecoService.ts`
**Changes**:
- `processZKTecoAttendanceData()` now saves to `zkteco_attendance_staging` instead of creating attendance immediately
- Removed direct attendance creation logic
- Marks staging records as processed

### 2. `/src/services/finalizationService.ts` (NEW)
**Purpose**: Handles the finalization process
**Key Methods**:
- `finalizeStagingRecords()`: Auto-finalize records 3+ days old
- `finalizeSingleRecord()`: Finalize one record
- `forceFinalizeAllStagingRecords()`: SuperAdmin force finalize all

### 3. `/src/cron/finalizeStagingRecords.ts` (NEW)
**Purpose**: Cron job to run finalization daily
**Setup**: Run daily at 2 AM:
```bash
0 2 * * * cd /home/saqib/public_html/test.iriscommunications.cloud && node dist/cron/finalizeStagingRecords.js
```

### 4. `/src/controller/zktecoController.ts`
**New Endpoints Added**:
- `POST /api/v1/zkteco/attendance/force-finalize-all` (SuperAdmin only)
- `POST /api/v1/zkteco/attendance/run-finalization-cron` (SuperAdmin only)

### 5. `/src/routes/zktecoRoutes.ts`
**New Routes**:
```typescript
router.post("/attendance/force-finalize-all", authenticate, ZKTecoController.forceFinalizeAll);
router.post("/attendance/run-finalization-cron", authenticate, ZKTecoController.runFinalizationCron);
```

## 🚀 Usage

### For Normal Operation (Automatic)
1. Employee punches in/out on device
2. Data goes to staging table immediately
3. **Wait 3 days**
4. Cron job runs daily and finalizes records
5. Attendance appears in the system

### For SuperAdmin (Manual Force Finalize)

#### Force Finalize All Records:
```bash
POST /api/v1/zkteco/attendance/force-finalize-all
Headers: Authorization: Bearer <superadmin_token>
```

**Response**:
```json
{
  "success": true,
  "message": "Finalized 10 records with 0 errors",
  "data": {
    "finalized": 10,
    "errors": 0
  }
}
```

#### Run Finalization Cron Manually:
```bash
POST /api/v1/zkteco/attendance/run-finalization-cron
Headers: Authorization: Bearer <superadmin_token>
```

**Response**:
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

## 🔐 Security

- **Staging Records**: Only SuperAdmin can view/force finalize
- **Final Records**: HR, Admin, SuperAdmin can view
- **Attendance Records**: All users can view (filtered by role)

## ⏰ Cron Job Setup

### Manual Setup (Linux Crontab):
```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * cd /home/saqib/public_html/test.iriscommunications.cloud && node dist/cron/finalizeStagingRecords.js >> /home/saqib/public_html/test.iriscommunications.cloud/logs/finalization.log 2>&1
```

### Programmatic Setup (node-cron in main app):
```typescript
import cron from 'node-cron';
import { finalizationService } from './services/finalizationService';

// Run every day at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('🕐 Running finalization cron job...');
  await finalizationService.finalizeStagingRecords();
});
```

## 📝 Testing

### Test the Flow:

1. **Punch on Device**:
   - Go to ZKTeco device
   - Punch in/out
   - Check staging table:
     ```sql
     SELECT * FROM zkteco_attendance_staging WHERE isFinalized = 0 ORDER BY createdAt DESC LIMIT 10;
     ```

2. **Force Finalize (SuperAdmin)**:
   ```bash
   curl -X POST https://test.iriscommunications.cloud/api/v1/zkteco/attendance/force-finalize-all \
     -H "Authorization: Bearer YOUR_SUPERADMIN_TOKEN"
   ```

3. **Check Final Tables**:
   ```sql
   -- Check final ZKTeco records
   SELECT * FROM zkteco_attendance_records ORDER BY createdAt DESC LIMIT 10;
   
   -- Check attendance records
   SELECT * FROM attendances ORDER BY date DESC LIMIT 10;
   ```

## 🐛 Troubleshooting

### Issue: Records not finalizing after 3 days
**Solution**: 
- Check if cron job is running
- Manually run: `POST /api/v1/zkteco/attendance/run-finalization-cron`
- Check logs: `/home/saqib/public_html/test.iriscommunications.cloud/logs/finalization.log`

### Issue: Staging table growing too large
**Solution**:
- Run force finalize: `POST /api/v1/zkteco/attendance/force-finalize-all`
- Check for records with `processingError` and fix employee mappings

### Issue: Attendance not showing for employees
**Solution**:
- Check if records are still in staging (not finalized yet)
- Check if employee `employeeId` matches device ID
- Force finalize to test immediately

## 📊 Monitoring

### Check Staging Records Count:
```sql
SELECT 
  COUNT(*) as total_staging,
  SUM(CASE WHEN isFinalized = 0 THEN 1 ELSE 0 END) as pending,
  SUM(CASE WHEN isFinalized = 1 THEN 1 ELSE 0 END) as finalized
FROM zkteco_attendance_staging;
```

### Check Records Older Than 3 Days:
```sql
SELECT COUNT(*) as ready_to_finalize
FROM zkteco_attendance_staging
WHERE isFinalized = 0 
AND createdAt <= DATE_SUB(NOW(), INTERVAL 3 DAY);
```

## ✅ Summary

- ✅ Attendance data goes to staging immediately
- ✅ Waits 3 days before becoming visible
- ✅ SuperAdmin can force finalize anytime
- ✅ Cron job auto-finalizes old records
- ✅ All existing functionality preserved
- ✅ Security maintained (role-based access)

## 🔄 Migration from Old System

If you have existing records in `zkteco_attendance_records` that need to be processed:

```bash
# Run the reprocess script (if needed)
node reprocess_attendance.js
```

---

**Last Updated**: December 1, 2025
**Version**: 2.0 (Staging Flow)



