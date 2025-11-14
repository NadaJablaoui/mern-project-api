
import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { loginValidator } from '../validators/login.validator.js'

const router = express.Router()

/**
 * POST /api/auth/login
 * email, password -> { data: { token } }
 */
router.post('/', loginValidator, async (req, res) => {
    try {
        const { email, password } = req.body

        // 1. Find user
        const user = await User.findOne({ email: email.toLowerCase() })
        if (!user) {
            return res.status(400).json({ errors: ['api.form.errors.invalid_login'] })
        }

        // 2. Check password
        const validPassword = await bcrypt.compare(password, user.password)
        if (!validPassword) {
            return res.status(400).json({ errors: ['api.form.errors.invalid_login'] })
        }

        // 3. Sign token
        const token = jwt.sign({ user_id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })

        return res.status(200).json({ data: { token } })
    } catch (err) {
        console.error('Login error:', err)
        return res.status(500).json({ errors: ['api.internal_error'] })
    }
})

export default router
