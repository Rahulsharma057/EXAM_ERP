
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// ============================================================
// TOKEN
// ============================================================

const getToken = () =>
  typeof window !== "undefined"
    ? localStorage.getItem("token")
    : null;

// ============================================================
// COMMON REQUEST
// ============================================================

const request = async (endpoint, options = {}) => {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",

    ...(token && {
      Authorization: `Bearer ${token}`,
    }),

    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  let data;

  try {
    data = await res.json();
  } catch {
    data = {
      success: false,
      message: "Invalid server response",
    };
  }

  if (!res.ok) {
    throw new Error(
      data?.message || `Request failed (${res.status})`,
    );
  }

  return data;
};

// ============================================================
// API
// ============================================================

export const api = {
  // ==========================================================
  // BASIC
  // ==========================================================

  get: (endpoint) =>
    request(endpoint, {
      method: "GET",
    }),

  post: (endpoint, body) =>
    request(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  put: (endpoint, body) =>
    request(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  patch: (endpoint, body) =>
    request(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  delete: (endpoint) =>
    request(endpoint, {
      method: "DELETE",
    }),

  // ==========================================================
  // AUTH
  // ==========================================================

  login: (credentials) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),

  register: (data) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMe: () => request("/auth/me"),

  // ==========================================================
  // HIERARCHY - READ ONLY
  // ==========================================================

  getOrganisations: () =>
    request("/auth/organisations"),

  getCentres: (orgId) =>
    request(`/auth/organisations/${orgId}/centres`),

  getCourses: (centreId) =>
    request(`/auth/centres/${centreId}/courses`),

  getBatches: (courseId) =>
    request(`/auth/courses/${courseId}/batches`),

  getBatchStudents: (batchId) =>
    request(`/auth/batches/${batchId}/students`),

  // ==========================================================
  // STUDENTS
  // ==========================================================

  getStudents: (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) =>
          value !== undefined &&
          value !== null &&
          value !== "",
      ),
    );

    const query = new URLSearchParams(cleanParams).toString();

    return request(
      `/org/students${query ? `?${query}` : ""}`,
    );
  },

  getStudent: (id) =>
    request(`/org/students/${id}`),

  createStudent: (data) =>
    request("/org/students", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateStudent: (id, data) =>
    request(`/org/students/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteStudent: (id) =>
    request(`/org/students/${id}`, {
      method: "DELETE",
    }),

  // ==========================================================
  // ORGANISATION CRUD
  // ==========================================================

  getOrganisationsList: (params = {}) => {
    const query = new URLSearchParams(params).toString();

    return request(
      `/org/organisations${query ? `?${query}` : ""}`,
    );
  },

  getOrganisation: (id) =>
    request(`/org/organisations/${id}`),

  createOrganisation: (data) =>
    request("/org/organisations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateOrganisation: (id, data) =>
    request(`/org/organisations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteOrganisation: (id) =>
    request(`/org/organisations/${id}`, {
      method: "DELETE",
    }),

  // ==========================================================
  // CENTRE CRUD
  // ==========================================================

  getCentresList: (params = {}) => {
    const query = new URLSearchParams(params).toString();

    return request(
      `/org/centres${query ? `?${query}` : ""}`,
    );
  },

  getCentre: (id) =>
    request(`/org/centres/${id}`),

  createCentre: (data) =>
    request("/org/centres", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCentre: (id, data) =>
    request(`/org/centres/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteCentre: (id) =>
    request(`/org/centres/${id}`, {
      method: "DELETE",
    }),

  // ==========================================================
  // COURSE CRUD
  // ==========================================================

  getCoursesList: (params = {}) => {
    const query = new URLSearchParams(params).toString();

    return request(
      `/org/courses${query ? `?${query}` : ""}`,
    );
  },

  getCourse: (id) =>
    request(`/org/courses/${id}`),

  createCourse: (data) =>
    request("/org/courses", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCourse: (id, data) =>
    request(`/org/courses/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteCourse: (id) =>
    request(`/org/courses/${id}`, {
      method: "DELETE",
    }),

  // ==========================================================
  // BATCH CRUD
  // ==========================================================

  getBatchesList: (params = {}) => {
    const query = new URLSearchParams(params).toString();

    return request(
      `/org/batches${query ? `?${query}` : ""}`,
    );
  },

  getBatch: (id) =>
    request(`/org/batches/${id}`),

  createBatch: (data) =>
    request("/org/batches", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateBatch: (id, data) =>
    request(`/org/batches/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteBatch: (id) =>
    request(`/org/batches/${id}`, {
      method: "DELETE",
    }),

  // ==========================================================
  // USER MANAGEMENT
  // ==========================================================

  getUsers: (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) =>
          value !== undefined &&
          value !== null &&
          value !== "",
      ),
    );

    const query = new URLSearchParams(cleanParams).toString();

    return request(
      `/users${query ? `?${query}` : ""}`,
    );
  },

  getUser: (id) =>
    request(`/users/${id}`),

  createUser: (data) =>
    request("/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateUser: (id, data) =>
    request(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  toggleUserStatus: (id) =>
    request(`/users/${id}/status`, {
      method: "PATCH",
    }),

  resetUserPassword: (id, password) =>
    request(`/users/${id}/password`, {
      method: "PATCH",
      body: JSON.stringify({
        password,
      }),
    }),

  deleteUser: (id) =>
    request(`/users/${id}`, {
      method: "DELETE",
    }),

  getUserStats: () =>
    request("/users/stats"),

  // ==========================================================
  // ASSESSMENTS
  // ==========================================================

  getAssessments: (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) =>
          value !== undefined &&
          value !== null &&
          value !== "",
      ),
    );

    const query = new URLSearchParams(cleanParams).toString();

    return request(
      `/assessments${query ? `?${query}` : ""}`,
    );
  },

  getAssessment: (id) =>
    request(`/assessments/${id}`),

  createAssessment: (data) =>
    request("/assessments", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateAssessment: (id, data) =>
    request(`/assessments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteAssessment: (id) =>
    request(`/assessments/${id}`, {
      method: "DELETE",
    }),

  duplicateAssessment: (assessmentId, data) =>
    request(
      `/assessments/${assessmentId}/duplicate`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  publishAssessment: (id) =>
    request(`/assessments/${id}/publish`, {
      method: "POST",
    }),

  scheduleAssessment: (id, data) =>
    request(`/assessments/${id}/schedule`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  closeAssessment: (id) =>
    request(`/assessments/${id}/close`, {
      method: "POST",
    }),

  archiveAssessment: (id) =>
    request(`/assessments/${id}/archive`, {
      method: "POST",
    }),

  getPreview: (id) =>
    request(`/assessments/${id}/preview`),

  // ==========================================================
  // ASSESSMENT PARTS
  // ==========================================================

  // Get all parts of assessment
  getAssessmentParts: (assessmentId) =>
    request(
      `/assessment-parts/assessments/${assessmentId}/parts`,
    ),

  // Get single part
  getAssessmentPart: (partId) =>
    request(`/assessment-parts/${partId}`),

  // Create part
  createAssessmentPart: (assessmentId, data) =>
    request(
      `/assessment-parts/assessments/${assessmentId}/parts`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  // Update part
  updateAssessmentPart: (partId, data) =>
    request(`/assessment-parts/${partId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Delete part
  deleteAssessmentPart: (partId) =>
    request(`/assessment-parts/${partId}`, {
      method: "DELETE",
    }),

  // Reorder parts
  reorderAssessmentParts: (assessmentId, parts) =>
    request(
      `/assessment-parts/assessments/${assessmentId}/parts/reorder`,
      {
        method: "PATCH",
        body: JSON.stringify({
          parts,
        }),
      },
    ),

  // ==========================================================
  // SECTIONS
  // ==========================================================

  createSection: (assessmentId, data) =>
    request(
      `/sections/assessments/${assessmentId}/sections`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  updateSection: (id, data) =>
    request(`/sections/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteSection: (id) =>
    request(`/sections/${id}`, {
      method: "DELETE",
    }),

  reorderSections: (assessmentId, sections) =>
    request(
      `/sections/assessments/${assessmentId}/sections/reorder`,
      {
        method: "PATCH",
        body: JSON.stringify({
          sections,
        }),
      },
    ),

  // ==========================================================
  // QUESTIONS
  // ==========================================================

  createQuestion: (sectionId, data) =>
    request(
      `/questions/sections/${sectionId}/questions`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  updateQuestion: (id, data) =>
    request(`/questions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteQuestion: (id) =>
    request(`/questions/${id}`, {
      method: "DELETE",
    }),

  reorderQuestions: (sectionId, questions) =>
    request(
      `/questions/sections/${sectionId}/questions/reorder`,
      {
        method: "PATCH",
        body: JSON.stringify({
          questions,
        }),
      },
    ),

  // ==========================================================
  // SUBMISSIONS
  // ==========================================================

  createSubmission: (assessmentId, data) =>
    request(
      `/submissions/assessments/${assessmentId}/submissions`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  getSubmissions: (assessmentId) =>
    request(
      `/submissions/assessments/${assessmentId}/submissions`,
    ),

  getSubmission: (id) =>
    request(`/submissions/${id}`),

  getCompletionStatus: (assessmentId) =>
    request(
      `/submissions/assessments/${assessmentId}/completion`,
    ),

  // ==========================================================
  // RESULTS
  // ==========================================================

  getAssessmentResults: (
    assessmentId,
    params = {},
  ) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) =>
          value !== undefined &&
          value !== null &&
          value !== "",
      ),
    );

    const query = new URLSearchParams(cleanParams).toString();

    return request(
      `/results/assessments/${assessmentId}/results${
        query ? `?${query}` : ""
      }`,
    );
  },

  getStudentResults: (studentId) =>
    request(
      `/results/students/${studentId}/assessment-results`,
    ),

  getBatchResults: (
    batchId,
    params = {},
  ) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) =>
          value !== undefined &&
          value !== null &&
          value !== "",
      ),
    );

    const query = new URLSearchParams(cleanParams).toString();

    return request(
      `/results/batches/${batchId}/assessment-results${
        query ? `?${query}` : ""
      }`,
    );
  },

  getStudentSectionResults: (
    assessmentId,
    studentId,
  ) =>
    request(
      `/results/assessments/${assessmentId}/students/${studentId}/sections`,
    ),

  // ==========================================================
  // MARKS ENTRY
  // ==========================================================

  getAssessmentStudentsForMarks: (
    assessmentId,
    search = "",
  ) =>
    request(
      `/results/assessments/${assessmentId}/marks/students${
        search
          ? `?search=${encodeURIComponent(search)}`
          : ""
      }`,
    ),

  getStudentMarksEntry: (
    assessmentId,
    studentId,
  ) =>
    request(
      `/results/assessments/${assessmentId}/marks/students/${studentId}`,
    ),

  // ==========================================================
  // SAVE STUDENT MARKS
  // ==========================================================

  saveStudentMarks: (
    assessmentId,
    studentId,
    marks,
    partSelections = [],
  ) =>
    request(
      `/results/assessments/${assessmentId}/marks/students/${studentId}`,
      {
        method: "POST",

        body: JSON.stringify({
          marks,
          partSelections,
        }),
      },
    ),

  // ==========================================================
  // EXCEL - EXPORT TEMPLATE
  // ==========================================================

  exportTemplate: async (assessmentId) => {
    if (!assessmentId) {
      throw new Error("Assessment is required");
    }

    const res = await fetch(
      `${API_BASE}/excel/assessments/${assessmentId}/export-template`,
      {
        method: "GET",

        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      },
    );

    if (!res.ok) {
      let message = "Failed to download template";

      try {
        const data = await res.json();

        message =
          data?.message || message;
      } catch {}

      throw new Error(message);
    }

    const blob = await res.blob();

    const contentDisposition =
      res.headers.get("Content-Disposition");

    let filename =
      "assessment-template.xlsx";

    if (contentDisposition) {
      const match =
        contentDisposition.match(
          /filename="?([^"]+)"?/i,
        );

      if (match?.[1]) {
        filename = match[1];
      }
    }

    const url =
      window.URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);

    a.click();

    a.remove();

    window.URL.revokeObjectURL(url);

    return true;
  },

  // ==========================================================
  // EXCEL - EXPORT RESULTS
  // ==========================================================

  exportResults: async (
  assessmentId,
  options = {}
) => {
  const token = getToken();

  const query = new URLSearchParams();

  query.set(
    "options",
    JSON.stringify(options)
  );

  const response = await fetch(
    `${API_BASE}/excel/assessments/${assessmentId}/export-results?${query.toString()}`,
    {
      method: "GET",

      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    let message =
      "Failed to export results";

    try {
      const data =
        await response.json();

      message =
        data?.message || message;
    } catch {
      // ignore
    }

    throw new Error(message);
  }

  const blob =
    await response.blob();

  const disposition =
    response.headers.get(
      "Content-Disposition"
    );

  let fileName =
    `Assessment_Results_${assessmentId}.xlsx`;

  if (disposition) {
    const match =
      disposition.match(
        /filename="?([^"]+)"?/i
      );

    if (match?.[1]) {
      fileName = match[1];
    }
  }

  const url =
    window.URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);

  link.click();

  link.remove();

  window.URL.revokeObjectURL(url);

  return true;
},

  // ==========================================================
  // EXCEL - IMPORT MARKS
  // ==========================================================

  importMarks: async (
    assessmentId,
    file,
  ) => {
    if (!assessmentId) {
      throw new Error(
        "Assessment is required",
      );
    }

    if (!file) {
      throw new Error(
        "Please select an Excel file",
      );
    }

    const allowedTypes = [
      ".xlsx",
      ".xls",
      ".csv",
    ];

    const fileName =
      file.name.toLowerCase();

    const isAllowed =
      allowedTypes.some((ext) =>
        fileName.endsWith(ext),
      );

    if (!isAllowed) {
      throw new Error(
        "Please select a valid Excel file (.xlsx, .xls or .csv)",
      );
    }

    const formData =
      new FormData();

    formData.append(
      "file",
      file,
    );

    const res = await fetch(
      `${API_BASE}/excel/assessments/${assessmentId}/import-marks`,
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${getToken()}`,
        },

        body: formData,
      },
    );

    let data;

    try {
      data = await res.json();
    } catch {
      throw new Error(
        "Server returned an invalid response",
      );
    }

    if (
      !res.ok ||
      data?.success === false
    ) {
      throw new Error(
        data?.message ||
          `Marks import failed (${res.status})`,
      );
    }

    return data;
  },

  // ==========================================================
  // EXCEL - IMPORT STUDENTS
  // ==========================================================

  importStudents: async (
    batchId,
    file,
  ) => {
    if (!batchId) {
      throw new Error(
        "Please select a Batch before importing students.",
      );
    }

    if (!file) {
      throw new Error(
        "Please select an Excel/CSV file.",
      );
    }

    const formData =
      new FormData();

    formData.append(
      "file",
      file,
    );

    formData.append(
      "batchId",
      batchId,
    );

    const res = await fetch(
      `${API_BASE}/excel/import-students`,
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${getToken()}`,
        },

        body: formData,
      },
    );

    let data;

    try {
      data = await res.json();
    } catch {
      throw new Error(
        "Server returned an invalid response.",
      );
    }

    if (
      !res.ok ||
      data?.success === false
    ) {
      throw new Error(
        data?.message ||
          `Student import failed (${res.status})`,
      );
    }

    return data;
  },

  // ==========================================================
  // DOWNLOAD STUDENT TEMPLATE
  // ==========================================================

  downloadStudentTemplate: async (
    batchId,
  ) => {
    if (!batchId) {
      throw new Error(
        "Please select a Batch first.",
      );
    }

    const res = await fetch(
      `${API_BASE}/excel/student-template?batchId=${encodeURIComponent(
        batchId,
      )}`,
      {
        method: "GET",

        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      },
    );

    if (!res.ok) {
      let message =
        "Failed to download student template";

      try {
        const data =
          await res.json();

        message =
          data?.message || message;
      } catch {}

      throw new Error(message);
    }

    const blob =
      await res.blob();

    const contentDisposition =
      res.headers.get(
        "Content-Disposition",
      );

    let filename =
      "student-import-template.xlsx";

    if (contentDisposition) {
      const match =
        contentDisposition.match(
          /filename="?([^"]+)"?/i,
        );

      if (match?.[1]) {
        filename = match[1];
      }
    }

    const url =
      window.URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);

    a.click();

    a.remove();

    window.URL.revokeObjectURL(url);

    return true;
  },
};

