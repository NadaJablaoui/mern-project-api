import { body, validationResult } from 'express-validator'

export const loginValidator = [
    body('email').isEmail().withMessage('Invalid email'),
    body('password').notEmpty().withMessage('Password is required'),

    (req, res, next) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array().map((e) => e.msg),
            })
        }
        next()
    },
]
