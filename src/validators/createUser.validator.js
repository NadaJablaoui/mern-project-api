import { body } from 'express-validator';
import User from '../models/User.js';
export const createUserValidator = [
  body('firstname').trim().notEmpty().withMessage('firstname is required'),
  body('lastname').trim().notEmpty().withMessage('lastname is required'),
  body('email')
    .trim()
    .isEmail().withMessage('invalid email')
    .custom(async (value) => {
      const exists = await User.findOne({ email: value.toLowerCase() }).lean();
      if (exists) throw new Error('email already exists in database');
      return true;
    }),
  body('phone')
    .trim()
    .notEmpty().withMessage('phone is required')
    .custom(async (value) => {
      const exists = await User.findOne({ phone: value }).lean();
      if (exists) throw new Error('phone already exists in database');
      return true;
    }),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('privacy_policy_accepted').equals('true').withMessage('Privacy policy must be accepted'),
  body('terms_accepted').equals('true').withMessage('Terms of use must be accepted'),
  // marketing_emails_enabled optional
];
