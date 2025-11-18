# Dealer Payout Portal - Setup Guide

## Detailed Setup Instructions

### Step 1: System Requirements

Ensure you have the following installed:

- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **MySQL** 8.0 or higher
- **Redis** 6.x or higher

Check versions:
```bash
node --version
npm --version
mysql --version
redis-cli --version
```

### Step 2: Clone and Install

```bash
# Navigate to project directory
cd dealer-payout-portal

# Install all dependencies
npm install
```

### Step 3: Database Setup

#### Create MySQL Database

```bash
# Login to MySQL
mysql -u root -p

# Create database
CREATE DATABASE dealer_payout_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Exit MySQL
exit;
```

#### Import Schema

```bash
# Import the schema
mysql -u root -p dealer_payout_portal < database/schema.sql
```

#### Verify Database

```bash
mysql -u root -p dealer_payout_portal -e "SHOW TABLES;"
```

You should see tables like:
- users
- dealers
- payout_cycles
- payout_cases
- invoices
- payments
- oem_payin
- disputes
- audit_trail
- service_requests
- bre_rules
- notifications
- upload_jobs

### Step 4: Redis Setup

#### macOS (using Homebrew)

```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

#### Ubuntu/Debian Linux

```bash
# Install Redis
sudo apt-get update
sudo apt-get install redis-server

# Start Redis
sudo systemctl start redis

# Enable Redis on boot
sudo systemctl enable redis

# Verify
redis-cli ping
```

#### Docker

```bash
# Run Redis in Docker
docker run -d \
  --name dealer-portal-redis \
  -p 6379:6379 \
  redis:latest

# Verify
docker ps | grep redis
redis-cli ping
```

### Step 5: Environment Configuration

#### Create Environment File

```bash
cp .env.example .env
```

#### Edit .env File

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD
DB_NAME=dealer_payout_portal

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Configuration
JWT_SECRET=change_this_to_a_random_string_in_production
JWT_EXPIRES_IN=24h

# AWS S3 Configuration (Optional for development)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=dealer-payout-invoices

# Server Configuration
PORT=3001
NODE_ENV=development

# Active Directory Mock Configuration
AD_ENABLED=false

# Mock API URLs
ORACLE_FUSION_API_URL=http://localhost:3002/api/oracle
BRE_ENGINE_API_URL=http://localhost:3003/api/bre
AADHAAR_API_URL=http://localhost:3004/api/aadhaar
```

### Step 6: Verify Installation

#### Check Database Connection

```bash
# Test MySQL connection
mysql -u root -p -e "USE dealer_payout_portal; SELECT COUNT(*) FROM users;"
```

Should show 1 row (the default admin user).

#### Check Redis Connection

```bash
redis-cli ping
```

Should return `PONG`.

### Step 7: Run the Application

Open **three terminal windows**:

#### Terminal 1: Frontend (Next.js)

```bash
cd dealer-payout-portal
npm run dev
```

Output should show:
```
▲ Next.js 16.0.3
- Local:        http://localhost:3000
✓ Starting...
✓ Ready in 2.5s
```

#### Terminal 2: Backend (Express)

```bash
cd dealer-payout-portal
npm run server
```

Output should show:
```
Server running on port 3001
Environment: development
Redis connected successfully
```

#### Terminal 3: Workers (BullMQ)

```bash
cd dealer-payout-portal
npm run workers
```

Output should show worker initialization.

### Step 8: Access the Application

1. Open browser: **http://localhost:3000**
2. You'll be redirected to login page
3. Use default credentials:
   - Username: `admin`
   - Password: `admin123`

### Step 9: Verify Functionality

#### Test Dealer Creation

1. Navigate to **Dealers** from sidebar
2. Click **Create Dealer**
3. Fill in the form:
   - Dealer Code: `DLR001`
   - Dealer Name: `Test Dealer`
   - GST Number: `27AAAAA0000A1Z5`
   - PAN Number: `AAAAA0000A`
   - State: `Maharashtra`
   - Email: `test@dealer.com`
   - Mobile: `9876543210`
4. Click **Create Dealer**
5. Check status - should be "Pending"

#### Check Backend API

```bash
# Test login endpoint
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Should return a JSON response with token and user data.

## Troubleshooting

### Database Connection Errors

**Error**: `ER_ACCESS_DENIED_ERROR`
- Check MySQL credentials in `.env`
- Verify user has access: `GRANT ALL PRIVILEGES ON dealer_payout_portal.* TO 'your_user'@'localhost';`

**Error**: `ER_BAD_DB_ERROR`
- Database doesn't exist
- Run: `mysql -u root -p -e "CREATE DATABASE dealer_payout_portal;"`

### Redis Connection Errors

**Error**: `ECONNREFUSED` on port 6379
- Redis not running
- Start Redis: `brew services start redis` (macOS) or `sudo systemctl start redis` (Linux)

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3000`

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

### TypeScript Errors

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Missing Dependencies

```bash
npm install
```

## Production Deployment Checklist

- [ ] Change JWT_SECRET to a strong random string
- [ ] Update database credentials
- [ ] Configure AWS S3 credentials
- [ ] Enable HTTPS
- [ ] Set NODE_ENV=production
- [ ] Configure firewall rules
- [ ] Setup database backups
- [ ] Configure Redis persistence
- [ ] Setup monitoring and logging
- [ ] Configure CORS properly
- [ ] Implement rate limiting
- [ ] Setup CI/CD pipeline
- [ ] Configure environment-specific configs

## Next Steps

1. **Explore the Dashboard**: Navigate through different modules
2. **Test Workflows**: Create dealers, approve them as Checker role
3. **Review Code**: Check the implementation in `server/` and `app/`
4. **Customize**: Modify as per your requirements
5. **Add Tests**: Implement unit and integration tests
6. **Deploy**: Follow production deployment checklist

## Support

For issues:
1. Check this guide first
2. Review README.md
3. Check database/schema.sql for schema details
4. Review error logs in terminal

## Additional Resources

- Next.js Documentation: https://nextjs.org/docs
- Express Documentation: https://expressjs.com/
- BullMQ Documentation: https://docs.bullmq.io/
- MySQL Documentation: https://dev.mysql.com/doc/
- Redis Documentation: https://redis.io/documentation
