// ============================================================
// PREVIEW MODE — temporary, for looking at the UI before
// Supabase/auth are wired up. Set PREVIEW_MODE to false (and
// delete this file's usages) once you're ready to go live —
// search the codebase for "PREVIEW_MODE" to find every spot
// that reads it.
// ============================================================
export const PREVIEW_MODE = false;

export const MOCK_EMPLOYEE = {
  email: "preview.manager@fnp.com",
  full_name: "Priya Sharma (Preview)",
  role: "store_manager",
  function: "Retail Operations",
  cost_center: "CC-GGN-04",
  store_name: "FNP Store - Cyber Hub, Gurugram",
  store_code: "GGN012",
  reports_to_email: "hod.preview@fnp.com",
  is_active: true,
};

export const MOCK_REQUISITIONS = [
  {
    requisition_id: "REQ-2608-0004",
    raised_by_email: MOCK_EMPLOYEE.email,
    store_name: MOCK_EMPLOYEE.store_name,
    store_code: MOCK_EMPLOYEE.store_code,
    cost_center: MOCK_EMPLOYEE.cost_center,
    function: MOCK_EMPLOYEE.function,
    worker_type: "Florist",
    tentative_rate: 850,
    number_of_workers: 3,
    from_date: "2026-09-01",
    to_date: "2026-09-10",
    status: "pending_hod_approval",
    hod_email: MOCK_EMPLOYEE.reports_to_email,
    hod_remarks: null,
    created_at: "2026-08-24T10:15:00Z",
  },
  {
    requisition_id: "REQ-2608-0003",
    raised_by_email: MOCK_EMPLOYEE.email,
    store_name: MOCK_EMPLOYEE.store_name,
    store_code: MOCK_EMPLOYEE.store_code,
    cost_center: MOCK_EMPLOYEE.cost_center,
    function: MOCK_EMPLOYEE.function,
    worker_type: "Rider",
    tentative_rate: 700,
    number_of_workers: 5,
    from_date: "2026-08-20",
    to_date: "2026-08-31",
    status: "approved",
    hod_email: MOCK_EMPLOYEE.reports_to_email,
    hod_remarks: null,
    created_at: "2026-08-18T09:00:00Z",
  },
  {
    requisition_id: "REQ-2608-0002",
    raised_by_email: MOCK_EMPLOYEE.email,
    store_name: MOCK_EMPLOYEE.store_name,
    store_code: MOCK_EMPLOYEE.store_code,
    cost_center: MOCK_EMPLOYEE.cost_center,
    function: MOCK_EMPLOYEE.function,
    worker_type: "Chef",
    tentative_rate: 1200,
    number_of_workers: 1,
    from_date: "2026-08-14",
    to_date: "2026-08-16",
    status: "rejected",
    hod_email: MOCK_EMPLOYEE.reports_to_email,
    hod_remarks: "Budget already covered by existing catering vendor for this window.",
    created_at: "2026-08-10T14:30:00Z",
  },
  {
    requisition_id: "REQ-2608-0001",
    raised_by_email: MOCK_EMPLOYEE.email,
    store_name: MOCK_EMPLOYEE.store_name,
    store_code: MOCK_EMPLOYEE.store_code,
    cost_center: MOCK_EMPLOYEE.cost_center,
    function: MOCK_EMPLOYEE.function,
    worker_type: "Helper",
    tentative_rate: 550,
    number_of_workers: 4,
    from_date: "2026-08-01",
    to_date: "2026-08-07",
    status: "approved",
    hod_email: MOCK_EMPLOYEE.reports_to_email,
    hod_remarks: null,
    created_at: "2026-07-28T11:45:00Z",
  },
];

export const MOCK_EVENTS = {
  "REQ-2608-0004": [
    { id: "e1", event_type: "raised", actor_email: MOCK_EMPLOYEE.email, remarks: null, created_at: "2026-08-24T10:15:00Z" },
    { id: "e2", event_type: "hr_notified", actor_email: MOCK_EMPLOYEE.email, remarks: "HR cc'd on the requisition-raised email to the HOD", created_at: "2026-08-24T10:15:05Z" },
  ],
  "REQ-2608-0003": [
    { id: "e1", event_type: "raised", actor_email: MOCK_EMPLOYEE.email, remarks: null, created_at: "2026-08-18T09:00:00Z" },
    { id: "e2", event_type: "hr_notified", actor_email: MOCK_EMPLOYEE.email, remarks: null, created_at: "2026-08-18T09:00:05Z" },
    { id: "e3", event_type: "hod_approved", actor_email: MOCK_EMPLOYEE.reports_to_email, remarks: null, created_at: "2026-08-18T15:22:00Z" },
  ],
  "REQ-2608-0002": [
    { id: "e1", event_type: "raised", actor_email: MOCK_EMPLOYEE.email, remarks: null, created_at: "2026-08-10T14:30:00Z" },
    { id: "e2", event_type: "hr_notified", actor_email: MOCK_EMPLOYEE.email, remarks: null, created_at: "2026-08-10T14:30:05Z" },
    { id: "e3", event_type: "hod_rejected", actor_email: MOCK_EMPLOYEE.reports_to_email, remarks: "Budget already covered by existing catering vendor for this window.", created_at: "2026-08-11T08:10:00Z" },
  ],
  "REQ-2608-0001": [
    { id: "e1", event_type: "raised", actor_email: MOCK_EMPLOYEE.email, remarks: null, created_at: "2026-07-28T11:45:00Z" },
    { id: "e2", event_type: "hr_notified", actor_email: MOCK_EMPLOYEE.email, remarks: null, created_at: "2026-07-28T11:45:05Z" },
    { id: "e3", event_type: "hod_approved", actor_email: MOCK_EMPLOYEE.reports_to_email, remarks: null, created_at: "2026-07-29T10:00:00Z" },
  ],
};

// Sample daily attendance for the two approved mock requisitions, keyed by
// requisition_id -> { "YYYY-MM-DD": workers_present }.
export const MOCK_ATTENDANCE = {
  "REQ-2608-0003": {
    "2026-08-20": 5,
    "2026-08-21": 5,
    "2026-08-22": 4,
    "2026-08-23": 5,
  },
  "REQ-2608-0001": {
    "2026-08-01": 4,
    "2026-08-02": 4,
    "2026-08-03": 3,
    "2026-08-04": 4,
    "2026-08-05": 4,
    "2026-08-06": 4,
    "2026-08-07": 4,
  },
};
