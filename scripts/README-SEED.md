# Database Seeding Scripts

Guide for using seed data and clear database scripts.

## Installation

Ensure dependencies are installed:
```bash
npm install
```

## Usage

### Using npm scripts (Recommended)

```bash
# Clear database
npm run db:clear

# Clear with dry-run (preview)
npm run db:clear:dry-run

# Reset database (clear + reseed)
npm run db:reset

# Seed all
npm run seed:all

# Seed individual parts
npm run seed              # System account & admin users
npm run seed:plans        # Subscription plans
npm run seed:users        # Users & accounts
npm run seed:groups       # Groups & permissions
npm run seed:test-data    # Test data (devices, controllers, etc.)
```

### Using directly with npx

If `tsx` is not installed globally, use `npx`:

```bash
# Clear database
npx tsx scripts/clear-db.ts

# Clear với options
npx tsx scripts/clear-db.ts --keep-jwt-keys --dry-run

# Seed
npx tsx scripts/seed-all.ts
```

### Using with global tsx

If `tsx` is installed globally:
```bash
npm install -g tsx

# Then you can run directly
tsx scripts/clear-db.ts
tsx scripts/seed-all.ts
```

## Clear Database Options

```bash
# View help
npx tsx scripts/clear-db.ts --help

# Dry run (preview)
npx tsx scripts/clear-db.ts --dry-run

# Clear all
npx tsx scripts/clear-db.ts

# Keep JWT keys
npx tsx scripts/clear-db.ts --keep-jwt-keys

# Keep system account
npx tsx scripts/clear-db.ts --keep-system-account

# Keep factory tokens
npx tsx scripts/clear-db.ts --keep-factory-tokens

# Combine options
npx tsx scripts/clear-db.ts --keep-jwt-keys --keep-system-account
```

## Seed All Options

```bash
# View help
npx tsx scripts/seed-all.ts --help

# Seed all
npx tsx scripts/seed-all.ts

# Skip some parts
npx tsx scripts/seed-all.ts --skip-test-data
npx tsx scripts/seed-all.ts --skip-radar-logs
npx tsx scripts/seed-all.ts --skip-cron-jobs
npx tsx scripts/seed-all.ts --skip-pin-rules
npx tsx scripts/seed-all.ts --skip-groups

# Dry run
npx tsx scripts/seed-all.ts --dry-run
```

## Test Seed Data Workflow

### 1. Clear and Reseed from Scratch (Development)
```bash
npm run db:reset
```

Or step by step:
```bash
npm run db:clear
npm run seed:all
```

### 2. Clear but Keep JWT Keys (If there are active devices)
```bash
npx tsx scripts/clear-db.ts --keep-jwt-keys
npm run seed:all
```

### 3. Clear but Keep System Account
```bash
npx tsx scripts/clear-db.ts --keep-system-account
npm run seed:all
```

## Generated Data

### Admin Users
- `admin@admin.com` / `admin0823` (ADMIN)
- `superadmin@admin.com` / `SuperAdmin123!` (SUPER_ADMIN)

### Accounts & Users
- **Blue.com**: 3 users (Owner, Admin, Member)
- **Generic Org**: 1 user (Owner)
- **ACME Corporation**: 4 users (Owner, Admin, 2 Members)
- **Test Company**: 1 user (Owner)

### Test Data (per account)
- 2 Companies
- 4 Device Tags
- 3-5 Devices with random hardware
- 1-3 Controllers (Radar) with sensors
- 1 Device Profile with settings

### Groups & Permissions
Each account has 4 default groups:
- **Administrators**: Full access
- **Managers**: Manage users, devices, features
- **Operators**: View and operate devices/controllers
- **Viewers**: Read-only access

Users are automatically assigned to groups based on account role:
- OWNER → Administrators
- ADMIN → Managers
- MEMBER → Viewers

## Notes

### Factory Tokens & JWT Keys

**JWT Signing Keys:**
- Used to sign/verify JWT tokens
- Types: `FACTORY`, `RUNTIME`, `INVITATION`
- ⚠️ If deleted: Cannot verify tokens that have been issued
- ✅ Should keep if: There are active devices/tokens

**Factory Tokens:**
- Tokens used for device registration
- Created from factory signing keys
- ⚠️ If deleted: Devices not yet registered will not be able to use these tokens
- ✅ Should keep if: There are devices waiting to register

### Safety

- ⚠️ Always backup database before clearing (especially in production)
- ✅ Use `--dry-run` to preview
- ✅ Scripts are idempotent (can be run multiple times safely)
- ✅ Uses `upsert` to avoid duplicate data

## Troubleshooting

### Error "command not found: tsx"

**Solution 1**: Use npx
```bash
npx tsx scripts/clear-db.ts
```

**Solution 2**: Use npm scripts
```bash
npm run db:clear
```

**Solution 3**: Install tsx globally
```bash
npm install -g tsx
```

### Database connection error

Ensure:
- Database is running
- `DATABASE_URL` in `.env` is correct
- You have database access permissions

### Foreign key constraints error

The `clear-db.ts` script handles deletion order correctly. If you still get errors, you may need to:
- Check if schema has changed
- Manually delete orphaned records

