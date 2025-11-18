# Dealer Payout Portal

A full-stack application for managing dealer incentive payouts, OEM pay-ins, cancellations, disputes, invoice handling, and approval workflows for Consumer Durable dealers.

## Tech Stack

- **Frontend**: React 18 + Next.js 15 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Queue Processing**: BullMQ + Redis
- **Database**: MySQL 8.0+
- **Authentication**: JWT + Active Directory (Mock)
- **File Storage**: AWS S3
- **E-sign**: Aadhaar OTP (Mock)

## Features

### Core Modules

1. **Authentication & RBAC** - Active Directory integration, JWT, 9 user roles
2. **User & Role Management** - CRUD operations, bulk upload, audit trail
3. **Dealer Management** - Create/Edit dealers with approval workflow
4. **Payout Cycle Management** - CSV upload with BullMQ, BRE integration
5. **Invoice Handling** - Auto-generation, Aadhaar OTP e-sign, TAT tracking
6. **Finance Integration** - Reconciliation, Oracle Fusion mock API
7. **OEM Pay-in Process** - Subvention data with approval workflow
8. **Dispute Management** - Dealer & OEM disputes with resolution tracking
9. **MIS & Reporting** - Comprehensive reports and compliance monitoring

## Prerequisites

- **Node.js** 18+ and npm
- **MySQL** 8.0+
- **Redis** (for BullMQ queue processing)

## Setup Instructions

### 1. Clone the repository
```bash
git clone <repository-url>
cd dealer-payout-portal
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup MySQL Database

**Create the database:**
```bash
mysql -u root -p -e "CREATE DATABASE dealer_payout_portal;"
```

**Import the schema:**
```bash
mysql -u root -p dealer_payout_portal < database/schema.sql
```

**Create additional tables for bulk uploads:**
```sql
mysql -u root -p dealer_payout_portal

-- User bulk upload jobs table
CREATE TABLE IF NOT EXISTS bulk_upload_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id VARCHAR(100) UNIQUE NOT NULL,
  filename VARCHAR(255) NOT NULL,
  uploaded_by INT NOT NULL,
  uploaded_by_username VARCHAR(100) NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  total_records INT DEFAULT 0,
  success_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  errors JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  INDEX idx_uploaded_by (uploaded_by),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dealer bulk upload jobs table
CREATE TABLE IF NOT EXISTS dealer_bulk_upload_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id VARCHAR(100) UNIQUE NOT NULL,
  filename VARCHAR(255) NOT NULL,
  uploaded_by INT NOT NULL,
  uploaded_by_username VARCHAR(100) NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  total_records INT DEFAULT 0,
  success_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  errors JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  INDEX idx_uploaded_by (uploaded_by),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Role permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role VARCHAR(50) NOT NULL,
  permission_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_role (role),
  UNIQUE KEY unique_role_permission (role, permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 4. Configure Environment Variables

**Copy the example environment file:**
```bash
cp .env.example .env
```

**Edit `.env` with your configuration:**
```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=              # Leave empty if no password
DB_NAME=dealer_payout_portal

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=           # Leave empty if no password

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=3001
NODE_ENV=development
```

### 5. Setup Redis

**Option 1: Install locally (macOS)**
```bash
brew install redis
brew services start redis
```

**Option 2: Use Docker**
```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

**Verify Redis is running:**
```bash
redis-cli ping
# Should return: PONG
```

### 6. Initialize Admin User

The admin user password needs to be properly hashed. Run this script:

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('admin123', 10).then(hash => console.log(hash));"
```

Then update the admin user in the database:
```sql
mysql -u root -p dealer_payout_portal

UPDATE users SET password_hash = '<paste_hash_here>' WHERE username = 'admin';
```

## Running the Application

### Option 1: Run All Services Together (Recommended)

```bash
npm run dev:all
```

This single command starts:
- **Frontend** (Next.js) on http://localhost:3000
- **Backend** (Express API) on http://localhost:3001
- **Workers** (BullMQ processors) in the background

### Option 2: Run Services Separately

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - Backend API:**
```bash
npm run server
```

**Terminal 3 - Background Workers:**
```bash
npm run workers
```

### Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

### Default Login Credentials

- **Username**: `admin`
- **Password**: `admin123`
- **Role**: Admin (full system access)

## Project Structure

```
dealer-payout-portal/
├── app/                    # Next.js pages
│   ├── dashboard/         # Protected dashboard pages
│   └── login/            # Login page
├── server/                # Express backend
│   └── routes/           # API endpoints
├── workers/               # BullMQ workers
├── lib/                   # Shared utilities
├── middleware/            # Express middleware
├── context/               # React context
├── types/                 # TypeScript types
└── database/              # SQL schema
```

## API Endpoints

- `POST /api/auth/login` - Authentication
- `GET /api/dealers` - List dealers
- `POST /api/dealers` - Create dealer
- `POST /api/dealers/:id/approve` - Approve/reject dealer
- And more...

## Role-Based Access

- **Admin** - Full system access
- **Maker** - Create dealers, payout cycles
- **Checker** - Approve/reject workflows
- **Business** - Validate payouts, resolve disputes
- **Business Head** - OEM approvals
- **Finance** - Invoice and payment management
- **MIS** - Reporting and compliance
- **Dealer** - View payouts, accept invoices
- **OEM** - Manage subvention data

## Key Features

### User Management
- ✅ Create, edit, deactivate users
- ✅ **Bulk upload users** via CSV with async processing
- ✅ Download CSV template
- ✅ Upload history with real-time status tracking
- ✅ Detailed error reporting for failed records
- ✅ Role-based permissions

### Dealer Management
- ✅ Create, edit dealers with approval workflow
- ✅ **Bulk upload dealers** via CSV with async processing
- ✅ Download CSV template
- ✅ Upload history with real-time status tracking
- ✅ **Server-side pagination** (10/25/50/100 records per page)
- ✅ **Refresh button** to reload dealer list
- ✅ GST, PAN, email, mobile validation

### Role Management
- ✅ 9 predefined roles (Admin, Maker, Checker, Business, BusinessHead, Finance, MIS, Dealer, OEM)
- ✅ **Permission mapping** with granular access control
- ✅ Module-based permissions (Users, Dealers, Payouts, Invoices, Finance, OEM, Disputes, Reports)
- ✅ Visual permission matrix

### Bulk Upload System
- ✅ **Asynchronous processing** with BullMQ
- ✅ No blocking - immediate response
- ✅ Real-time status updates (pending/processing/completed/failed)
- ✅ Detailed error tracking with row numbers
- ✅ Upload history page with filtering
- ✅ Up to 100 error records stored per job

## Key Technologies

- **BullMQ** - Asynchronous CSV processing with Redis
- **JWT** - Secure token-based authentication
- **RBAC** - Granular role-based access control
- **Audit Trail** - Complete action logging
- **Tailwind CSS** - Modern, responsive UI design
- **TypeScript** - Type-safe development
- **Server-side Pagination** - Efficient data handling

## Available Scripts

```bash
# Development
npm run dev          # Start Next.js frontend (port 3000)
npm run server       # Start Express backend (port 3001)
npm run workers      # Start BullMQ workers
npm run dev:all      # Start all services together (recommended)

# Production
npm run build        # Build Next.js for production
npm run start        # Start production Next.js server
npm run server:prod  # Start production Express server
npm run workers:prod # Start production workers

# Code Quality
npm run lint         # Run ESLint
npx tsc --noEmit     # Type checking without compilation
```

## Troubleshooting

### Redis Connection Issues
```bash
# Check if Redis is running
redis-cli ping

# Start Redis (macOS)
brew services start redis

# Check Redis logs
tail -f /usr/local/var/log/redis.log
```

### MySQL Connection Issues
```bash
# Check MySQL is running
mysql -u root -p -e "SELECT 1;"

# Check database exists
mysql -u root -p -e "SHOW DATABASES LIKE 'dealer_payout_portal';"

# Verify tables
mysql -u root -p dealer_payout_portal -e "SHOW TABLES;"
```

### Login Issues
If login fails with "Invalid credentials":

```bash
# Reset admin password
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('admin123', 10).then(hash => console.log(hash));"

# Update in database
mysql -u root -p dealer_payout_portal -e "UPDATE users SET password_hash='<paste_hash>' WHERE username='admin';"
```

### Port Already in Use
```bash
# Check what's using port 3000
lsof -ti:3000

# Kill the process
kill -9 $(lsof -ti:3000)

# Check port 3001 (backend)
lsof -ti:3001
kill -9 $(lsof -ti:3001)
```

### BullMQ Jobs Not Processing
```bash
# Verify Redis is running
redis-cli ping

# Check worker logs
tail -f workers.log

# Restart workers
pkill -f "tsx watch workers"
npm run workers
```

## Bulk Upload CSV Templates

### User Upload Template
```csv
username,ad_id,email,mobile,password,role,business_line,user_code,login_access
test_user,AD123,user@test.com,9876543210,password123,Maker,Electronics,USR001,TRUE
```

### Dealer Upload Template
```csv
dealer_code,dealer_name,gst_number,pan_number,state,email,mobile,address,city,pincode,bank_name,account_number,ifsc_code,branch
DLR001,Test Dealer,22AAAAA0000A1Z5,AAAAA0000A,Maharashtra,dealer@test.com,9876543210,123 Main St,Mumbai,400001,SBI,1234567890,SBIN0001234,Mumbai Branch
```

## Future Enhancements

- Complete all module implementations
- Real Active Directory integration
- Email notifications
- Real Aadhaar OTP integration
- Advanced reporting with charts
- WebSocket notifications

## License

MIT License
