// routes/user.routes.js
import express from 'express'
import bcrypt from 'bcrypt'
import User from '../models/User.js'
import { generatePresignedUploadUrl } from '../utils/s3.utils.js'
import { S3FoldersKeys } from '../constants/s3Folders.js'
import authMiddleware from '../middlewares/auth.middleware.js'
import Notification from '../models/Notification.js'
import KYCUserRequest from '../models/KYCUserRequest.js'

const router = express.Router()

/* ---------- helpers ---------- */

/* ---------- routes ---------- */

// POST /api/users  (public registration)
router.post('/', async (req, res) => {
    try {
        const { firstname, lastname, email, phone, password } = req.body
        const normalizedEmail = email?.toLowerCase()

        const existingUser = await User.findOne({
            $or: [{ email: normalizedEmail }, { phone }],
        }).lean()

        if (existingUser) {
            const errMsg = existingUser.email === normalizedEmail ? 'api.user.email_already_exists' : 'api.user.phone_already_exists'
            return res.status(400).json({ errors: [errMsg] })
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        const newUser = await User.create({
            firstname,
            lastname,
            email: normalizedEmail,
            phone,
            password: hashedPassword,
        })

        await newUser.initializeKYCRequest() // model method
        const user = await User.findById(newUser._id).populate('kyc_user_request').lean()

        return res.status(201).json({ data: user })
    } catch (error) {
        console.error('Error during user creation:', error)
        return res.status(500).json({ errors: ['api.internal_error'] })
    }
})

// GET /api/users/me  (auth required)
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const userId = req.user?._id ?? req.user?.id
        if (!userId) return res.status(401).json({ errors: ['Unauthorized'] })

        const user = await User.findById(userId).populate('kyc_user_request notifications').lean()

        return res.status(200).json({ data: user })
    } catch (err) {
        console.error('Error in getMe:', err)
        return res.status(500).json({ errors: ['api.internal_error'] })
    }
})

// GET /api/users  (admin listing)
router.get('/',authMiddleware, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10))
        const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page || '40', 10)))
        const skip = (page - 1) * perPage

        const [data, total] = await Promise.all([User.find().skip(skip).limit(perPage).lean(), User.countDocuments()])

        return res.status(200).json({ per_page: perPage, page, total, data })
    } catch (err) {
        console.error('Error fetching users:', err)
        return res.status(500).json({ errors: ['api.internal_error'] })
    }
})

// POST /api/users/me/files  (auth required)
router.post('/me/files',authMiddleware, async (req, res) => {
    try {
        if (req.body.folder !== S3FoldersKeys.USER_AVATAR) {
            return res.status(400).json({ error: 'Invalid folder' })
        }
        const { content_type, filename } = req.body
        const userId = req.user.id
        const result = await generatePresignedUploadUrl(req.body.folder, content_type, filename, userId)
        res.json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: 'Failed to generate upload URL' })
    }
})

// POST /api/users/me/kyc/person/files  (auth required)
router.post('/me/kyc/person/files',authMiddleware, async (req, res) => {
    try {
        const allowed = [
            S3FoldersKeys.KYC_PERSON_FACE_PICTURE,
            S3FoldersKeys.KYC_PERSON_DRIVER_LICENSE_FRONT_PICTURE,
            S3FoldersKeys.KYC_PERSON_DRIVER_LICENSE_BACK_PICTURE,
        ]
        if (!allowed.includes(req.body.folder)) {
            return res.status(400).json({ error: 'Invalid folder' })
        }
        const { content_type, filename } = req.body
        const userId = req.user.id
        const result = await generatePresignedUploadUrl(req.body.folder, content_type, filename, userId)
        res.json(result)
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate upload URL' })
    }
})

export default router
