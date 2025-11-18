import { UserRole } from '@/types';

// Permission Matrix based on requirements
export const ROLE_PERMISSIONS: Record<UserRole, any> = {
  Admin: {
    all: true, // Full access to everything
  },
  Maker: {
    dealers: ['create', 'edit', 'view', 'bulkUpload'],
    payoutCycles: ['create', 'upload', 'view', 'initiate'],
    payoutCases: ['create', 'view', 'hold', 'release', 'cancel', 'adjust'],
    oem: ['create', 'upload', 'view'],
    users: ['view'],
    reports: ['view', 'export'],
  },
  Checker: {
    dealers: ['approve', 'reject', 'view'],
    payoutCases: ['approve', 'reject', 'view'],
    oem: ['approve', 'reject', 'view'],
    disputes: ['view', 'review'],
    reports: ['view', 'export'],
  },
  Business: {
    payoutCases: ['validate', 'approve', 'reject', 'view'],
    disputes: ['review', 'resolve', 'view'],
    invoices: ['view'],
    reports: ['view', 'export'],
  },
  BusinessHead: {
    oem: ['approve', 'reject', 'view'],
    disputes: ['resolve', 'view'],
    payoutCases: ['view'],
    invoices: ['view'],
    reports: ['view', 'export'],
  },
  Finance: {
    invoices: ['create', 'edit', 'view', 'generate'],
    payments: ['process', 'upload', 'view'],
    reconciliation: ['view', 'update', 'process'],
    payoutCases: ['view'],
    reports: ['view', 'export'],
  },
  MIS: {
    reports: ['view', 'export', 'create'],
    audit: ['view', 'export'],
    invoices: ['view'],
    payoutCases: ['view'],
    dealers: ['view'],
    compliance: ['monitor', 'view'],
  },
  Dealer: {
    payoutCases: ['view'], // Only their own
    invoices: ['view', 'accept', 'upload', 'sign'], // Only their own
    disputes: ['raise', 'view'], // Only their own
  },
  OEM: {
    oem: ['view'], // Only their own data
    invoices: ['view', 'upload', 'sign'], // Only their own
    disputes: ['raise', 'view'], // Only their own
    subvention: ['view'],
  },
};

export const hasPermission = (
  userRole: UserRole,
  module: string,
  action: string
): boolean => {
  const permissions = ROLE_PERMISSIONS[userRole];

  // Admin has full access
  if (permissions.all === true) {
    return true;
  }

  // Check module-specific permissions
  if (permissions[module]) {
    return permissions[module].includes(action);
  }

  return false;
};

export const hasAnyPermission = (
  userRole: UserRole,
  checks: Array<{ module: string; action: string }>
): boolean => {
  return checks.some((check) => hasPermission(userRole, check.module, check.action));
};

export const canAccessRoute = (userRole: UserRole, route: string): boolean => {
  const routePermissions: Record<string, Array<{ module: string; action: string }>> = {
    '/admin': [{ module: 'all', action: 'admin' }],
    '/dealers': [
      { module: 'dealers', action: 'view' },
      { module: 'dealers', action: 'create' },
    ],
    '/payout-cycles': [
      { module: 'payoutCycles', action: 'view' },
      { module: 'payoutCases', action: 'view' },
    ],
    '/invoices': [
      { module: 'invoices', action: 'view' },
      { module: 'invoices', action: 'create' },
    ],
    '/finance': [{ module: 'reconciliation', action: 'view' }],
    '/oem': [{ module: 'oem', action: 'view' }],
    '/disputes': [{ module: 'disputes', action: 'view' }],
    '/reports': [{ module: 'reports', action: 'view' }],
  };

  // Admin can access all routes
  if (userRole === 'Admin') {
    return true;
  }

  const requiredPermissions = routePermissions[route];
  if (!requiredPermissions) {
    return false;
  }

  return hasAnyPermission(userRole, requiredPermissions);
};

export const getAccessibleModules = (userRole: UserRole): string[] => {
  const permissions = ROLE_PERMISSIONS[userRole];

  if (permissions.all === true) {
    return Object.keys(ROLE_PERMISSIONS).filter((key) => key !== 'all');
  }

  return Object.keys(permissions);
};
