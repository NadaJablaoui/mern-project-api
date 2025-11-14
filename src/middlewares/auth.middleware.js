import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import dotenv from 'dotenv'
dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET || 'please-change-this'

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || ''
        const token = (authHeader.startsWith('Bearer ') && authHeader.split(' ')[1]) || req.query.token || req.headers['x-access-token']

        if (!token) return res.status(401).json({ errors: ['Unauthorized - token missing'] })

        const payload = jwt.verify(token, JWT_SECRET)

        if (!payload || !payload.user_id) return res.status(401).json({ errors: ['Unauthorized - invalid token'] })

        const user = await User.findById(payload.user_id).lean()

        if (!user) return res.status(401).json({ errors: ['Unauthorized - user not found'] })

        req.user = user
        next()
    } catch (err) {
        console.error('auth error', err)
        return res.status(401).json({ errors: ['Unauthorized - token error'] })
    }
}

export default authMiddleware
