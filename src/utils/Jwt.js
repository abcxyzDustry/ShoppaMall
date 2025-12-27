const jwt = require('jsonwebtoken');
const logger = require('./logger');

class JWTService {
    // Generate token for user
    static generateUserToken(userId) {
        return jwt.sign(
            { userId, role: 'user' },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '30d' }
        );
    }

    // Generate token for admin
    static generateAdminToken(adminId, role) {
        return jwt.sign(
            { adminId, role },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );
    }

    // Generate refresh token
    static generateRefreshToken(userId) {
        return jwt.sign(
            { userId, type: 'refresh' },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRE || '90d' }
        );
    }

    // Verify token
    static verifyToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            logger.error('Token verification failed:', error.message);
            throw error;
        }
    }

    // Verify refresh token
    static verifyRefreshToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        } catch (error) {
            logger.error('Refresh token verification failed:', error.message);
            throw error;
        }
    }

    // Decode token without verification
    static decodeToken(token) {
        try {
            return jwt.decode(token);
        } catch (error) {
            logger.error('Token decoding failed:', error.message);
            return null;
        }
    }

    // Check if token is expired
    static isTokenExpired(token) {
        try {
            const decoded = jwt.decode(token);
            if (!decoded || !decoded.exp) return true;
            
            const currentTime = Math.floor(Date.now() / 1000);
            return decoded.exp < currentTime;
        } catch (error) {
            logger.error('Token expiration check failed:', error.message);
            return true;
        }
    }

    // Get token expiration time
    static getTokenExpiration(token) {
        try {
            const decoded = jwt.decode(token);
            return decoded ? decoded.exp : null;
        } catch (error) {
            logger.error('Get token expiration failed:', error.message);
            return null;
        }
    }
}

module.exports = JWTService;
