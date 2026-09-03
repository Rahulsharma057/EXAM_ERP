const { body, param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

const assessmentValidation = {
  create: [
    body('name').notEmpty().withMessage('Assessment name is required'),
    body('code').notEmpty().withMessage('Assessment code is required'),
    body('organisation').isMongoId().withMessage('Valid organisation ID is required'),
    body('centre').isMongoId().withMessage('Valid centre ID is required'),
    body('course').isMongoId().withMessage('Valid course ID is required'),
    body('batch').isMongoId().withMessage('Valid batch ID is required'),
    body('weekNumber').isInt({ min: 1 }).withMessage('Week number must be at least 1'),
    handleValidationErrors
  ]
};

module.exports = { handleValidationErrors, assessmentValidation };
