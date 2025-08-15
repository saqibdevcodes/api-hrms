# Leave Request API Documentation

## Overview

Complete CRUD API for managing employee leave requests with role-based access control.

## Base URL

`/api/v1/leave-requests`

## Authentication

All endpoints require authentication via Bearer token.

## Endpoints

### 1. Get All Leave Requests

**GET** `/leave-requests`

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Records per page (default: 10, max: 100)
- `search` (optional): Search in reason, employee first name, last name
- `status` (optional): Filter by status (PENDING, APPROVED, REJECTED, CANCELLED)
- `leaveType` (optional): Filter by leave type
- `employeeId` (optional): Filter by employee ID (HR/Admin only)
- `startDate` (optional): Filter requests created after this date
- `endDate` (optional): Filter requests created before this date
- `sortBy` (optional): Sort field (createdAt, startDate, endDate, status, leaveType)
- `sortOrder` (optional): Sort order (asc, desc)

**Access Control:**

- Employees: See only their own requests
- HR/Admin: See all requests

### 2. Get Leave Request by ID

**GET** `/leave-requests/:id`

**Access Control:**

- Employees: Can only view their own requests
- HR/Admin: Can view any request

### 3. Create Leave Request

**POST** `/leave-requests`

**Request Body:**

```json
{
  "leaveType": "ANNUAL",
  "startDate": "2024-01-15",
  "endDate": "2024-01-17",
  "reason": "Family vacation planned for a long time",
  "comments": "Optional additional comments"
}
```

**Leave Types:**

- ANNUAL
- SICK
- MATERNITY
- PATERNITY
- PERSONAL
- EMERGENCY
- BEREAVEMENT
- STUDY
- UNPAID

**Validation:**

- Start date cannot be in the past
- End date must be after or equal to start date
- Reason: 10-500 characters
- Comments: max 1000 characters (optional)

### 4. Update Leave Request

**PUT** `/leave-requests/:id`

**Request Body:** (All fields optional)

```json
{
  "leaveType": "SICK",
  "startDate": "2024-01-16",
  "endDate": "2024-01-18",
  "reason": "Updated reason",
  "comments": "Updated comments"
}
```

**Access Control:**

- Employees: Can only update their own PENDING requests
- HR/Admin: Can update any PENDING request

### 5. Delete Leave Request

**DELETE** `/leave-requests/:id`

**Access Control:**

- Employees: Can only delete their own PENDING requests
- HR/Admin: Can delete any PENDING request

### 6. Approve Leave Request

**POST** `/leave-requests/:id/approve`

**Request Body:**

```json
{
  "comments": "Approved - enjoy your leave!"
}
```

**Access Control:** HR and Admin only

### 7. Reject Leave Request

**POST** `/leave-requests/:id/reject`

**Request Body:**

```json
{
  "comments": "Rejected - insufficient leave balance"
}
```

**Access Control:** HR and Admin only

### 8. Get Leave Request Statistics

**GET** `/leave-requests/stats`

**Query Parameters:**

- `employeeId` (optional): Stats for specific employee (HR/Admin only)
- `startDate` (optional): Stats from this date
- `endDate` (optional): Stats until this date

**Response:**

```json
{
  "success": true,
  "data": {
    "pending": 5,
    "approved": 12,
    "rejected": 2,
    "cancelled": 1,
    "total": 20,
    "onLeave": 3
  }
}
```

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    // Validation errors (if applicable)
  ]
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Business Rules

1. **Permissions:**

   - Employees can only manage their own leave requests
   - Only PENDING requests can be updated/deleted
   - Only HR and Admin can approve/reject requests

2. **Validation:**

   - Start date cannot be in the past
   - End date must be after or equal to start date
   - Days are automatically calculated (inclusive of both dates)

3. **Status Workflow:**

   - Created → PENDING
   - PENDING → APPROVED (by HR/Admin)
   - PENDING → REJECTED (by HR/Admin)
   - PENDING → CANCELLED (by employee/HR/Admin via delete)

4. **Auto-calculations:**
   - Number of days is automatically calculated based on date range
   - Includes both start and end dates in the count

## Example Usage

### Create a Leave Request

```bash
curl -X POST /api/v1/leave-requests \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leaveType": "ANNUAL",
    "startDate": "2024-02-01",
    "endDate": "2024-02-03",
    "reason": "Family vacation to celebrate anniversary"
  }'
```

### Get My Leave Requests

```bash
curl -X GET "/api/v1/leave-requests?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Approve a Leave Request (HR/Admin)

```bash
curl -X POST /api/v1/leave-requests/REQUEST_ID/approve \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "comments": "Approved - have a great vacation!"
  }'
```
