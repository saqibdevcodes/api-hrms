# Iris Communications HRMS Backend API

A robust, scalable backend API for the Iris Communications Human Resource Management System. Built with Node.js, Express, TypeScript, Prisma, and MySQL.

## 🏢 Overview

This backend provides secure authentication, role-based access control, and comprehensive HRMS functionality for Iris Communications employees and administrators.

## 🛠️ Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MySQL with Prisma ORM
- **Authentication**: JWT with secure cookie storage
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Express Validator
- **Password Hashing**: bcrypt

## 🚀 Features

### 🔐 Authentication & Security

- JWT-based authentication with refresh tokens
- Secure cookie-based session management
- Password hashing with bcrypt
- Rate limiting for API protection
- Role-based access control (Admin, HR, Manager, Employee)
- Security audit logging

### 📊 HRMS Modules

- **Employee Management**: Complete employee profiles and records
- **Attendance Management**: Check-in/out, tracking, reporting
- **Leave Management**: Request, approval, balance tracking
- **Payroll Management**: Salary processing, deductions, reports
- **Performance Management**: Reviews, goals, ratings

### 🛡️ Security Features

- Input validation and sanitization
- SQL injection protection via Prisma
- XSS protection with Helmet
- CORS configuration
- Request rate limiting
- Secure environment configuration

## 🔧 Prerequisites

- Node.js 18.x or later
- MySQL 8.x or later
- npm or yarn package manager

## 📦 Installation

### 1. Clone and Setup

```bash
cd backend
npm install
```

### 2. Environment Configuration

Create a `.env` file in the backend root:

```env
# Database Configuration
DATABASE_URL="mysql://username:password@localhost:3306/iris_hrms"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"

# Server Configuration
PORT=3000
NODE_ENV="development"
API_PREFIX="/api/v1"

# Company Configuration
COMPANY_NAME="Iris Communications"
COMPANY_DOMAIN="iriscommunications.com"

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Cookie Configuration
COOKIE_SECRET="your-cookie-secret-key-here"
COOKIE_DOMAIN="localhost"
COOKIE_SECURE=false
COOKIE_SAME_SITE="strict"
```

### 3. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# (Optional) Seed database with demo data
npx prisma db seed
```

### 4. Start Development Server

```bash
npm run start
```

## 🔑 Demo Credentials

### Administrator Access

- **Email**: `admin@iriscommunications.com`
- **Password**: `admin123`
- **Role**: HR Director (Admin)

### Employee Access

- **Email**: `user@iriscommunications.com`
- **Password**: `user123`
- **Role**: Communications Specialist (Employee)

## 📡 API Endpoints

### Authentication

```
POST   /api/v1/auth/login     - User login
POST   /api/v1/auth/logout    - User logout
POST   /api/v1/auth/refresh   - Refresh access token
GET    /api/v1/auth/profile   - Get user profile
GET    /api/v1/auth/verify    - Verify authentication
GET    /api/v1/auth/health    - API health check
```

### Dashboard & Reports

```
GET    /api/v1/dashboard      - Dashboard data (authenticated)
GET    /api/v1/admin/users    - All users (admin only)
GET    /api/v1/hr/reports     - HR reports (HR/Admin only)
GET    /api/v1/company/info   - Company information (public)
```

### Example API Requests

#### Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@iriscommunications.com",
    "password": "admin123"
  }'
```

#### Get Dashboard (Authenticated)

```bash
curl -X GET http://localhost:3000/api/v1/dashboard \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🗄️ Database Schema

### Core Models

- **User**: Authentication and basic user info
- **Employee**: Detailed employee information
- **Department**: Company departments
- **Attendance**: Daily attendance records
- **LeaveRequest**: Leave applications and approvals
- **PayrollRecord**: Salary and payroll data
- **PerformanceReview**: Performance evaluations

### Relationships

- User ↔ Employee (One-to-One)
- Employee ↔ Attendance (One-to-Many)
- Employee ↔ LeaveRequest (One-to-Many)
- Employee ↔ PayrollRecord (One-to-Many)
- Employee ↔ PerformanceReview (One-to-Many)

## 🏗️ Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   │   ├── database.ts   # Database connection
│   │   └── env.ts        # Environment variables
│   ├── controller/       # Route controllers
│   │   └── authController.ts
│   ├── middleware/       # Express middleware
│   │   └── auth.ts       # Authentication middleware
│   ├── routes/           # API routes
│   │   ├── authRoutes.ts
│   │   └── index.ts
│   ├── services/         # Business logic
│   │   └── authService.ts
│   ├── types/            # TypeScript types
│   │   ├── auth.ts
│   │   └── index.ts
│   ├── utils/            # Utility functions
│   │   ├── jwt.ts
│   │   └── password.ts
│   ├── validators/       # Input validation
│   │   └── authValidator.ts
│   └── index.ts          # Main server file
├── prisma/
│   └── schema.prisma     # Database schema
├── package.json
└── tsconfig.json
```

## 🧪 Available Scripts

```bash
npm run start          # Start development server
npm run build          # Build for production
npm run dev            # Development with auto-reload
npm run lint           # Run ESLint
npm run test           # Run tests (when implemented)
```

## 🔐 Security Considerations

### Environment Security

- All sensitive data in environment variables
- Separate development/production configurations
- Secure JWT secret generation

### API Security

- Rate limiting on all endpoints
- Stricter limits on authentication endpoints
- CORS configuration for allowed origins
- Helmet for security headers

### Database Security

- Parameterized queries via Prisma
- Input validation and sanitization
- Role-based access control
- Audit logging for security events

## 🚀 Deployment

### Production Environment

1. Set `NODE_ENV=production`
2. Use strong JWT secrets
3. Configure secure database connection
4. Enable HTTPS/SSL
5. Set up proper CORS origins
6. Configure secure cookies

### Environment Variables for Production

```env
NODE_ENV="production"
DATABASE_URL="mysql://user:password@host:port/database"
JWT_SECRET="very-strong-secret-key"
COOKIE_SECURE=true
COOKIE_DOMAIN="yourdomain.com"
```

## 🔍 Monitoring & Debugging

### Logging

- Request logging with timestamps and IP addresses
- Security event logging for audit purposes
- Error logging with stack traces in development

### Health Checks

- `/health` endpoint for basic health monitoring
- Database connectivity checks
- Environment validation on startup

## 🤝 Contributing

1. Follow TypeScript strict mode
2. Use consistent naming conventions
3. Add proper error handling
4. Include input validation
5. Write comprehensive JSDoc comments
6. Follow RESTful API principles

## 📄 License

This project is proprietary software developed for Iris Communications. Unauthorized copying, modification, or distribution is prohibited.

---

**© 2024 Iris Communications. All rights reserved.**

For technical support: `support@iriscommunications.com`
