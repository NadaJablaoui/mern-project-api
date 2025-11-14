import bcrypt from 'bcrypt'
import User from '../models/User.js'
import { generatePresignedUploadUrl } from '../utils/s3.utils.js'
import { S3FoldersKeys } from '../constants/s3Folders.js'
/**
 * Create a new user
 * - validates uniqueness of email/phone
 * - hashes password
 * - initializes KYC request via model instance method
 */
export const createUser = async (req, res) => {
    try {
        const { firstname, lastname, email, phone, password } = req.body

        console.log('im here im queer', firstname, lastname, email, phone, password)

        // NOTE: validators should have already run; double-check required flags
        const normalizedEmail = email?.toLowerCase?.()

        // Check existing by email or phone
        const existingUser = await User.findOne({
            $or: [{ email: normalizedEmail }, { phone }],
        }).lean()

        console.log("existingUser", existingUser);
        

        if (existingUser) {
            const errMsg = existingUser.email === normalizedEmail ? 'api.user.email_already_exists' : 'api.user.phone_already_exists'
            return res.status(400).json({ errors: [errMsg] })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        console.log("hashedPassword", hashedPassword);

        // const newUser = await User.create({
        //     firstname,
        //     lastname,
        //     email: normalizedEmail,
        //     phone,
        //     password: hashedPassword,
        // })

        // // initializeKYCRequest is defined as a method on the model (from earlier conversion)
        // await newUser.initializeKYCRequest()

        // // reload user with populated relations if you want (e.g. kyc_user_request)
        // const user = await User.findById(newUser._id).populate('kyc_user_request').lean()

        return res.status(201).json({ data: 'test' })
    } catch (error) {
        console.error('Error during user creation:', error)
        return res.status(500).json({ errors: ['api.internal_error'] })
    }
}

/**
 * Return current authenticated user
 * req.user is set by auth middleware
 */
export const getMe = async (req, res) => {
    try {
        // req.user may already be the user document; to standardize, we fetch fresh
        const userId = req.user?._id ?? req.user?.id
        if (!userId) return res.status(401).json({ errors: ['Unauthorized'] })

        const user = await User.findById(userId).populate('kyc_user_request notifications').lean()

        return res.status(200).json({ data: user })
    } catch (err) {
        console.error('Error in getMe:', err)
        return res.status(500).json({ errors: ['api.internal_error'] })
    }
}

/**
 * Get all users (simple listing with pagination)
 * You can restrict to admin via middleware or check req.user.role here
 */
export const getAllUsers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10))
        const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page || '40', 10)))
        const skip = (page - 1) * perPage

        const [data, total] = await Promise.all([User.find().skip(skip).limit(perPage).lean(), User.countDocuments()])

        return res.status(200).json({
            per_page: perPage,
            page,
            total,
            data,
        })
    } catch (err) {
        console.error('Error fetching users:', err)
        return res.status(500).json({ errors: ['api.internal_error'] })
    }
}

export const userFileRequest = async (req, res) => {
    try {
        // check folder is allowed
        if (req.body.folder !== S3FoldersKeys.USER_AVATAR) {
            return res.status(400).json({ error: 'Invalid folder' })
        }

        const { content_type } = req.body
        const userId = req.user.id // from auth middleware

        const result = await generatePresignedUploadUrl(req.body.folder, content_type, req.body.filename, userId)

        res.json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: 'Failed to generate upload URL' })
    }
}

export const userKycPersonFileRequest = async (req, res) => {
    try {
        const allowed = [
            S3FoldersKeys.KYC_PERSON_FACE_PICTURE,
            S3FoldersKeys.KYC_PERSON_DRIVER_LICENSE_FRONT_PICTURE,
            S3FoldersKeys.KYC_PERSON_DRIVER_LICENSE_BACK_PICTURE,
        ]

        if (!allowed.includes(req.body.folder)) {
            return res.status(400).json({ error: 'Invalid folder' })
        }

        const { content_type } = req.body
        const userId = req.user.id

        const result = await generatePresignedUploadUrl(req.body.folder, content_type, req.body.filename, userId)

        res.json(result)
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate upload URL' })
    }
}
