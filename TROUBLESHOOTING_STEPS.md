# Troubleshooting: Attendance Not Showing

## Issue: API returns empty records despite data in database

### Step 1: Clear Browser Cache
The **304 Not Modified** status means your browser is using cached data!

**Solutions:**
1. **Hard Refresh**: 
   - Windows/Linux: `Ctrl + Shift + R` or `Ctrl + F5`
   - Mac: `Cmd + Shift + R`

2. **Open in Incognito/Private Window**

3. **Add cache-busting parameter**:
   ```
   https://test.iriscommunications.cloud/api/v1/zkteco/attendance/data?page=1&limit=20&_t=123456
   ```

### Step 2: Check if Data Exists
```bash
mysql -u saqib_hr -p'irisSaqib1998' -h 147.79.100.197 -P 3306 saqib_hr -e "SELECT COUNT(*) FROM attendances WHERE notes LIKE '%Finalized from staging%';"
```

### Step 3: Check Logs
```bash
tail -f /home/saqib/public_html/test.iriscommunications.cloud/passenger.30000.log | grep -i "smart filter\|attendance"
```

You should see:
```
📅 Applying smart filter: 3+ days old OR force-finalized records
   Three days ago: 2025-11-28T...
   Existing filters: {...}
   Final where clause: {...}
```

### Step 4: Test with curl (Bypass Browser Cache)
```bash
curl -X GET "https://test.iriscommunications.cloud/api/v1/zkteco/attendance/data?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Cache-Control: no-cache"
```

### Step 5: Force Finalize Again
If no data shows, force finalize again:
```bash
curl -X POST "https://test.iriscommunications.cloud/api/v1/zkteco/attendance/force-finalize-all" \
  -H "Authorization: Bearer YOUR_SUPERADMIN_TOKEN"
```

### Step 6: Check Attendance Records
```sql
SELECT 
  id, 
  employeeId, 
  date, 
  checkIn, 
  checkOut, 
  status, 
  notes,
  createdAt 
FROM attendances 
ORDER BY createdAt DESC 
LIMIT 5;
```

Look for records with `notes` containing "Finalized from staging"

### Common Issues:

1. **Browser Cache (304 Not Modified)**
   - Solution: Hard refresh or incognito mode

2. **No Finalized Records**
   - Solution: Call force finalize endpoint

3. **Authentication Issues**
   - Solution: Check if token is valid

4. **Old Code Running**
   - Solution: Restart application
   ```bash
   cd /home/saqib/public_html/test.iriscommunications.cloud
   touch tmp/restart.txt
   ```

---

## Expected Behavior:

### After Force Finalize:
1. Staging records → `zkteco_attendance_records`
2. Staging records → `attendances` table
3. `notes` field = "Finalized from staging record {id}"
4. Records visible immediately (no 3-day wait)

### API Response (Should show data):
```json
{
  "success": true,
  "message": "Attendance data retrieved successfully",
  "data": {
    "records": [
      {
        "id": "...",
        "date": "2025-12-01",
        "checkIn": "2025-12-01T14:16:02.000Z",
        "checkOut": "2025-12-01T14:16:19.000Z",
        "status": "PRESENT",
        "notes": "Finalized from staging record ...",
        "employee": {...}
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

---

**Last Updated**: December 1, 2025



