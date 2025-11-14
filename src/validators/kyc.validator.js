import { body, validationResult } from 'express-validator'
import { ValueType, KYCIdentityStepStatus, KYCIdentityStepType } from '../models/KYCIdentityStep.js'
import { KYCStatus } from '../models/KYCUserRequest.js'

const enumValidator = (enumObj, field) =>
    body(field)
        .isInt()
        .withMessage(`${field} must be an integer`)
        .custom((v) => Object.values(enumObj).includes(parseInt(v, 10)))
        .withMessage(`invalid ${field}`)

export const submitStepValidator = [
    enumValidator(KYCIdentityStepType, 'type'),
    body('value').isArray({ min: 1 }).withMessage('value must be a non-empty array'),
    body('value.*.name').notEmpty().withMessage('value[] name is required'),
    body('value.*.value').notEmpty().withMessage('value[] value is required'),
    body('value.*.type').isInt().withMessage('value[] type must be integer'),

    (req, res, next) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map((e) => e.msg) })
        }
        next()
    },
]

export const reviewStepValidator = [
    enumValidator(KYCIdentityStepStatus, 'status'),
    body('comment').optional().isString(),

    (req, res, next) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map((e) => e.msg) })
        }
        next()
    },
]

export const reviewRequestValidator = [
    enumValidator(KYCStatus, 'status'),
    body('comment').optional().isString(),

    (req, res, next) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map((e) => e.msg) })
        }
        next()
    },
]
