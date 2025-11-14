import { validationResult } from 'express-validator';

export const validateRequest = (req, res, next) => {
    
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const extracted = errors.array().map(err => ({ field: err.param, msg: err.msg }));
  return res.status(400).json({ errors: extracted });
};
