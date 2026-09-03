const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
 req.user = await User.findById(decoded.id).select('-password');

if (!req.user) {
  return res.status(401).json({
    success: false,
    message: 'User not found',
  });
}

if (!req.user.isActive) {
  return res.status(401).json({
    success: false,
    message: 'Your account is inactive. Please contact administrator.',
  });
}

next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this action' });
    }
    next();
  };
};
const hierarchyFilter = async (req, res, next) => {
  const user = req.user;

  req.hierarchyFilter = {};

  if (user.role === ROLES.SUPER_ADMIN) {
    // Full access
  }

  else if (user.role === ROLES.ORG_ADMIN) {
    req.hierarchyFilter.organisation =
      user.organisation;
  }

  else if (user.role === ROLES.CENTRE_ADMIN) {
    req.hierarchyFilter.organisation =
      user.organisation;

    req.hierarchyFilter.centre =
      user.centre;
  }

  else if (user.role === ROLES.TEACHER) {
    req.hierarchyFilter.organisation =
      user.organisation;

    req.hierarchyFilter.centre =
      user.centre;

    req.hierarchyFilter.course =
      user.course;

    req.hierarchyFilter.batch = {
      $in: user.batches || [],
    };
  }

  else if (user.role === ROLES.STUDENT) {
    req.hierarchyFilter.student =
      user.studentId;

    req.hierarchyFilter.batch = {
      $in: user.batches || [],
    };
  }

  next();
};

module.exports = { protect, authorize, hierarchyFilter };
