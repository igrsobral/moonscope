# Authentication and Authorization System

## Overview

The authentication and authorization system has been successfully implemented for the Meme Coin Analyzer backend. This system provides secure user registration, login, JWT-based authentication, and route protection.

## Components Implemented

### 1. JWT Plugin (`src/plugins/jwt.ts`)
- Configures @fastify/jwt plugin with HS256 algorithm
- 7-day token expiration
- Custom error messages for authentication failures
- Provides `authenticate` decorator for route protection

### 2. User Service (`src/services/user.ts`)
- **Password Security**: Uses bcryptjs with 12 salt rounds
- **User Management**: Create, authenticate, and manage users
- **Wallet Integration**: Support for linking Ethereum wallet addresses
- **Preferences**: User preference management with defaults
- **Password Changes**: Secure password change functionality

### 3. Authentication Routes (`src/routes/auth.ts`)
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/profile` - Get user profile (protected)
- `PUT /api/v1/auth/preferences` - Update preferences (protected)
- `POST /api/v1/auth/link-wallet` - Link wallet address (protected)
- `POST /api/v1/auth/change-password` - Change password (protected)

### 4. Validation Schemas (`src/schemas/auth.ts`)
- **Registration**: Email, password strength, wallet address validation
- **Login**: Email and password validation
- **Preferences**: Theme, risk tolerance, notification settings
- **Wallet Linking**: Ethereum address format validation
- **Password Change**: Current and new password validation

### 5. Authentication Middleware (`src/middleware/auth.ts`)
- `authenticateMiddleware`: Strict authentication requirement
- `optionalAuthMiddleware`: Optional authentication for public/private content
- `requireRole`: Placeholder for future role-based authorization

### 6. Type Definitions
- JWT payload structure in `src/types/fastify.d.ts`
- User and preference types in `src/types/index.ts`
- Comprehensive API response types

## Security Features

### Password Security
- Minimum 8 characters
- Must contain uppercase, lowercase, number, and special character
- Bcrypt hashing with 12 salt rounds
- Secure password change with current password verification

### JWT Security
- HS256 algorithm
- 7-day expiration
- Secure secret key requirement (minimum 32 characters)
- Proper error handling for expired/invalid tokens

### Input Validation
- Zod schemas for all endpoints
- Email format validation
- Ethereum wallet address validation (0x + 40 hex characters)
- Comprehensive error messages

### Route Protection
- JWT-based authentication middleware
- Consistent error response format
- Request ID tracking for debugging

## API Response Format

All endpoints return a consistent response format:

```typescript
{
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}
```

## Error Codes

- `VALIDATION_ERROR`: Input validation failures
- `REGISTRATION_ERROR`: User registration issues
- `AUTHENTICATION_ERROR`: Login or token validation failures
- `PROFILE_ERROR`: Profile retrieval issues
- `UPDATE_PREFERENCES_ERROR`: Preference update failures
- `LINK_WALLET_ERROR`: Wallet linking issues
- `CHANGE_PASSWORD_ERROR`: Password change failures

## Testing Coverage

### Unit Tests
- User service functionality (13 tests)
- Authentication schemas validation (21 tests)
- JWT plugin configuration (8 tests)

### Integration Tests
- Authentication routes (18 tests)
- Complete authentication flow (14 tests)
- Middleware functionality (7 tests)

### Test Features
- Mock database operations
- JWT token generation and validation
- Error case handling
- Input validation testing
- Complete user lifecycle testing

## Usage Examples

### User Registration
```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "walletAddress": "0x1234567890123456789012345678901234567890"
  }'
```

### User Login
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

### Protected Route Access
```bash
curl -X GET http://localhost:3001/api/v1/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Database Schema

The system uses the existing Prisma schema with the `users` table:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  preferences JSON DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Environment Variables Required

```env
JWT_SECRET=your-secure-jwt-secret-minimum-32-characters
DATABASE_URL=postgresql://user:password@localhost:5432/database
REDIS_URL=redis://localhost:6379
```

## Next Steps

The authentication system is now ready for:
1. Integration with other modules (coins, portfolios, alerts)
2. Role-based authorization implementation
3. OAuth integration (Web3 wallet authentication)
4. Session management enhancements
5. Rate limiting on authentication endpoints

All requirements from task 5 have been successfully implemented and tested.