module.exports = {
  ROLES: {
    SUPER_ADMIN: 'super_admin',
    ORG_ADMIN: 'org_admin',
    CENTRE_ADMIN: 'centre_admin',
    TEACHER: 'teacher',
    STUDENT: 'student'
  },

  ASSESSMENT_STATUS: {
    DRAFT: 'DRAFT',
    SCHEDULED: 'SCHEDULED',
    PUBLISHED: 'PUBLISHED',
    CLOSED: 'CLOSED',
    ARCHIVED: 'ARCHIVED'
  },

  QUESTION_TYPES: {
    YES_NO: 'YES_NO',
    TEXT: 'TEXT',
    NUMBER: 'NUMBER',
    SINGLE_CHOICE: 'SINGLE_CHOICE',
    MULTIPLE_CHOICE: 'MULTIPLE_CHOICE'
  },

  SUBMISSION_STATUS: {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    REASSESSED: 'REASSESSED'
  }
};
