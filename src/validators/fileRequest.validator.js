import { body, validationResult } from 'express-validator'

export const fileRequestValidator = [
  body('folder').notEmpty().withMessage('folder is required'),
  body('content_type').notEmpty().withMessage('content_type is required'),
  body('filename').notEmpty().withMessage('filename is required'),

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