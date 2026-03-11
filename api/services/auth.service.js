/**
 * Authentication Service
 * Handles user authentication and JWT token management
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getInstance } = require('./database.service');

class AuthService {
    constructor() {
        this.db = getInstance();
        this.jwtSecret = process.env.JWT_SECRET || 'default_secret_key';
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    }

    /**
     * Authenticate user and generate JWT token
     */
    async login(username, password) {
        // Find user by username
        const user = this.db.queryOne(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (!user) {
            throw new Error('Invalid username or password');
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            throw new Error('Invalid username or password');
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role
            },
            this.jwtSecret,
            { expiresIn: this.jwtExpiresIn }
        );

        // Return user data (without password) and token
        const { password: _, ...userWithoutPassword } = user;

        return {
            user: userWithoutPassword,
            token
        };
    }

    /**
     * Verify JWT token and return user data
     */
    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);

            // Get fresh user data from database
            const user = this.db.queryOne(
                'SELECT id, username, role, full_name, email FROM users WHERE id = ?',
                [decoded.id]
            );

            if (!user) {
                throw new Error('User not found');
            }

            return user;
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }

    /**
     * Register a new user (for future use)
     */
    async register(userData) {
        const { username, password, role, full_name, email, phone } = userData;

        // Check if username already exists
        const existingUser = this.db.queryOne(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existingUser) {
            throw new Error('Username already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        const result = this.db.execute(
            `INSERT INTO users (username, password, role, full_name, email, phone)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [username, hashedPassword, role, full_name, email, phone]
        );

        return result.lastInsertRowid;
    }

    /**
     * Get user by ID
     */
    getUserById(userId) {
        return this.db.queryOne(
            'SELECT id, username, role, full_name, email, phone FROM users WHERE id = ?',
            [userId]
        );
    }

    /**
     * Change user password
     */
    async changePassword(userId, oldPassword, newPassword) {
        const user = this.db.queryOne(
            'SELECT password FROM users WHERE id = ?',
            [userId]
        );

        if (!user) {
            throw new Error('User not found');
        }

        // Verify old password
        const isValid = await bcrypt.compare(oldPassword, user.password);
        if (!isValid) {
            throw new Error('Invalid old password');
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        this.db.execute(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, userId]
        );

        return true;
    }
}

module.exports = new AuthService();
