import express, { Request, Response } from 'express';
import { query } from '@/lib/db';
import { generateToken, comparePassword, authenticateWithAD } from '@/lib/auth';
import { User, UserWithPassword, ApiResponse } from '@/types';

const router = express.Router();

// Login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: 'Username and password are required',
      } as ApiResponse);
      return;
    }

    // Find user
    const users = await query<UserWithPassword[]>(
      'SELECT * FROM users WHERE (username = ? OR ad_id = ?) AND is_active = TRUE AND login_access = TRUE',
      [username, username]
    );

    if (users.length === 0) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      } as ApiResponse);
      return;
    }

    const user = users[0];

    // Authenticate with AD if enabled
    if (process.env.AD_ENABLED === 'true') {
      const adAuth = await authenticateWithAD(username, password);
      if (!adAuth) {
        res.status(401).json({
          success: false,
          error: 'Active Directory authentication failed',
        } as ApiResponse);
        return;
      }
    } else {
      // Check password hash
      const isValid = await comparePassword(password, user.password_hash);
      if (!isValid) {
        res.status(401).json({
          success: false,
          error: 'Invalid credentials',
        } as ApiResponse);
        return;
      }
    }

    // Generate JWT token
    const token = generateToken(user as User);

    // Remove password from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: {
        user: userWithoutPassword,
        token,
      },
      message: 'Login successful',
    } as ApiResponse);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
    } as ApiResponse);
  }
});

// Verify token
router.get('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No token provided',
      } as ApiResponse);
      return;
    }

    const token = authHeader.substring(7);
    const { verifyToken } = await import('@/lib/auth');
    const decoded = verifyToken(token);

    // Fetch fresh user data
    const users = await query<User[]>(
      'SELECT id, username, ad_id, email, mobile, role, business_line, user_code, login_access, is_active, created_at, updated_at FROM users WHERE id = ? AND is_active = TRUE',
      [decoded.userId]
    );

    if (users.length === 0) {
      res.status(401).json({
        success: false,
        error: 'User not found or inactive',
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: users[0],
    } as ApiResponse);
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    } as ApiResponse);
  }
});

export default router;
