import { body } from 'express-validator';
import { ValueType, KYCStepStatus } from '../models/KYCIdentityStep.js';
import { KYCStatus } from '../models/KYCUserRequest.js';
import KYCIdentityStep from '../models/KYCIdentityStep.js';
import mongoose from 'mongoose';

/**
 * submitStepValidator:
 * - type must be valid enum
 * - value must be array of {name,value,type} with at least 1 item
 *   - additional format checks (file/date) are left to your S3/file validation functions
 */
export const submitStepValidator = [
  body('type')
    .isInt().withMessage('type must be an integer')
    .custom((v) => Object.values(ValueType).includes(v) || Object.values(ValueType).includes(parseInt(v, 10)))
    .withMessage('invalid type'),

  body('value').isArray({ min: 1 }).withMessage('value must be a non-empty array'),
  body('value.*.name').notEmpty().withMessage('value[] name is required'),
  body('value.*.value').notEmpty().withMessage('value[] value is required'),
  body('value.*.type').isInt().withMessage('value[] type must be integer'),

  // ensure step id + request id are valid objects? (controller will check existence & ownership)
];

/**
 * reviewStepValidator: used by admin/reviewer
 */
export const reviewStepValidator = [
  body('status').isInt().withMessage('status required'),
  body('status').custom((v) => Object.values(KYCStepStatus).includes(v) || Object.values(KYCStepStatus).includes(parseInt(v, 10))).withMessage('invalid status'),
  body('comment').optional().isString(),
];

/**
 * reviewRequestValidator: admin/reviewer for whole request
 */
export const reviewRequestValidator = [
  body('status').isInt().withMessage('status required')
    .custom((v) => Object.values(KYCStatus).includes(v) || Object.values(KYCStatus).includes(parseInt(v, 10))).withMessage('invalid status'),
  body('comment').optional().isString(),
];
