# Database Seeding Scripts

Hướng dẫn sử dụng các script seed data và clear database.

## Cài đặt

Đảm bảo đã cài đặt dependencies:
```bash
npm install
```

## Cách chạy

### Sử dụng npm scripts (Khuyến nghị)

```bash
# Clear database
npm run db:clear

# Clear với dry-run (xem trước)
npm run db:clear:dry-run

# Reset database (clear + seed lại)
npm run db:reset

# Seed tất cả
npm run seed:all

# Seed từng phần
npm run seed              # System account & admin users
npm run seed:plans        # Subscription plans
npm run seed:users        # Users & accounts
npm run seed:groups       # Groups & permissions
npm run seed:test-data    # Test data (devices, controllers, etc.)
```

### Sử dụng trực tiếp với npx

Nếu `tsx` chưa được cài globally, dùng `npx`:

```bash
# Clear database
npx tsx scripts/clear-db.ts

# Clear với options
npx tsx scripts/clear-db.ts --keep-jwt-keys --dry-run

# Seed
npx tsx scripts/seed-all.ts
```

### Sử dụng với tsx global

Nếu đã cài `tsx` globally:
```bash
npm install -g tsx

# Sau đó có thể chạy trực tiếp
tsx scripts/clear-db.ts
tsx scripts/seed-all.ts
```

## Clear Database Options

```bash
# Xem help
npx tsx scripts/clear-db.ts --help

# Dry run (xem trước)
npx tsx scripts/clear-db.ts --dry-run

# Clear tất cả
npx tsx scripts/clear-db.ts

# Giữ JWT keys
npx tsx scripts/clear-db.ts --keep-jwt-keys

# Giữ system account
npx tsx scripts/clear-db.ts --keep-system-account

# Giữ factory tokens
npx tsx scripts/clear-db.ts --keep-factory-tokens

# Kết hợp options
npx tsx scripts/clear-db.ts --keep-jwt-keys --keep-system-account
```

## Seed All Options

```bash
# Xem help
npx tsx scripts/seed-all.ts --help

# Seed tất cả
npx tsx scripts/seed-all.ts

# Bỏ qua một số phần
npx tsx scripts/seed-all.ts --skip-test-data
npx tsx scripts/seed-all.ts --skip-radar-logs
npx tsx scripts/seed-all.ts --skip-cron-jobs
npx tsx scripts/seed-all.ts --skip-pin-rules
npx tsx scripts/seed-all.ts --skip-groups

# Dry run
npx tsx scripts/seed-all.ts --dry-run
```

## Quy trình Test Seed Data

### 1. Clear và Seed lại từ đầu (Development)
```bash
npm run db:reset
```

Hoặc từng bước:
```bash
npm run db:clear
npm run seed:all
```

### 2. Clear nhưng giữ JWT Keys (Nếu có devices đang hoạt động)
```bash
npx tsx scripts/clear-db.ts --keep-jwt-keys
npm run seed:all
```

### 3. Clear nhưng giữ System Account
```bash
npx tsx scripts/clear-db.ts --keep-system-account
npm run seed:all
```

## Dữ liệu được tạo

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
- 3-5 Devices với random hardware
- 1-3 Controllers (Radar) với sensors
- 1 Device Profile với settings

### Groups & Permissions
Mỗi account có 4 default groups:
- **Administrators**: Full access
- **Managers**: Quản lý users, devices, features
- **Operators**: View và operate devices/controllers
- **Viewers**: Read-only access

Users được tự động assign vào groups dựa trên account role:
- OWNER → Administrators
- ADMIN → Managers
- MEMBER → Viewers

## Lưu ý

### Factory Tokens & JWT Keys

**JWT Signing Keys:**
- Dùng để sign/verify JWT tokens
- Types: `FACTORY`, `RUNTIME`, `INVITATION`
- ⚠️ Nếu xóa: Không thể verify tokens đã được issue
- ✅ Nên giữ nếu: Đang có devices/tokens đang hoạt động

**Factory Tokens:**
- Tokens dùng cho device registration
- Được tạo từ factory signing keys
- ⚠️ Nếu xóa: Devices chưa register sẽ không thể dùng tokens này
- ✅ Nên giữ nếu: Có devices đang chờ register

### Safety

- ⚠️ Luôn backup database trước khi clear (đặc biệt production)
- ✅ Dùng `--dry-run` để xem trước
- ✅ Scripts đều idempotent (có thể chạy nhiều lần an toàn)
- ✅ Sử dụng `upsert` để tránh duplicate data

## Troubleshooting

### Lỗi "command not found: tsx"

**Giải pháp 1**: Dùng npx
```bash
npx tsx scripts/clear-db.ts
```

**Giải pháp 2**: Dùng npm scripts
```bash
npm run db:clear
```

**Giải pháp 3**: Cài tsx globally
```bash
npm install -g tsx
```

### Lỗi database connection

Đảm bảo:
- Database đang chạy
- `DATABASE_URL` trong `.env` đúng
- Có quyền truy cập database

### Lỗi foreign key constraints

Script `clear-db.ts` đã xử lý thứ tự xóa đúng. Nếu vẫn lỗi, có thể cần:
- Kiểm tra schema có thay đổi
- Xóa manual các records orphaned

