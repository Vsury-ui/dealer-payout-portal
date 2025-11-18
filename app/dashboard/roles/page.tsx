'use client';

import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';

interface Permission {
  id: number;
  module: string;
  action: string;
  description: string;
}

interface RolePermission {
  role: string;
  permissions: number[];
}

const ROLES = [
  'Admin',
  'Maker',
  'Checker',
  'Business',
  'BusinessHead',
  'Finance',
  'MIS',
  'Dealer',
  'OEM',
];

const PERMISSIONS: Permission[] = [
  // User Management
  { id: 1, module: 'Users', action: 'Create', description: 'Create new users' },
  { id: 2, module: 'Users', action: 'Read', description: 'View users' },
  { id: 3, module: 'Users', action: 'Update', description: 'Edit users' },
  { id: 4, module: 'Users', action: 'Delete', description: 'Deactivate users' },
  
  // Dealer Management
  { id: 5, module: 'Dealers', action: 'Create', description: 'Create dealers' },
  { id: 6, module: 'Dealers', action: 'Read', description: 'View dealers' },
  { id: 7, module: 'Dealers', action: 'Update', description: 'Edit dealers' },
  { id: 8, module: 'Dealers', action: 'Approve', description: 'Approve/reject dealers' },
  
  // Payout Management
  { id: 9, module: 'Payouts', action: 'Create', description: 'Upload payout cycles' },
  { id: 10, module: 'Payouts', action: 'Read', description: 'View payouts' },
  { id: 11, module: 'Payouts', action: 'Update', description: 'Edit payouts' },
  { id: 12, module: 'Payouts', action: 'Approve', description: 'Approve/reject payouts' },
  
  // Invoice Management
  { id: 13, module: 'Invoices', action: 'Create', description: 'Generate invoices' },
  { id: 14, module: 'Invoices', action: 'Read', description: 'View invoices' },
  { id: 15, module: 'Invoices', action: 'Sign', description: 'E-sign invoices' },
  { id: 16, module: 'Invoices', action: 'Verify', description: 'Verify invoices' },
  
  // Finance
  { id: 17, module: 'Finance', action: 'Reconcile', description: 'Reconcile payments' },
  { id: 18, module: 'Finance', action: 'Process', description: 'Process payments' },
  { id: 19, module: 'Finance', action: 'Read', description: 'View finance data' },
  
  // OEM
  { id: 20, module: 'OEM', action: 'Create', description: 'Create OEM data' },
  { id: 21, module: 'OEM', action: 'Read', description: 'View OEM data' },
  { id: 22, module: 'OEM', action: 'Approve', description: 'Approve OEM pay-ins' },
  
  // Disputes
  { id: 23, module: 'Disputes', action: 'Create', description: 'Raise disputes' },
  { id: 24, module: 'Disputes', action: 'Read', description: 'View disputes' },
  { id: 25, module: 'Disputes', action: 'Resolve', description: 'Resolve disputes' },
  
  // Reports
  { id: 26, module: 'Reports', action: 'Read', description: 'View reports' },
  { id: 27, module: 'Reports', action: 'Export', description: 'Export reports' },
  { id: 28, module: 'Reports', action: 'Create', description: 'Create custom reports' },
];

const DEFAULT_ROLE_PERMISSIONS: Record<string, number[]> = {
  Admin: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28],
  Maker: [5, 6, 7, 9, 10, 11, 20, 21],
  Checker: [6, 8, 10, 12, 14, 16, 21, 22, 24],
  Business: [6, 10, 11, 14, 23, 24, 25, 26],
  BusinessHead: [6, 10, 14, 21, 22, 24, 25, 26, 27],
  Finance: [10, 13, 14, 16, 17, 18, 19, 26, 27],
  MIS: [2, 6, 10, 14, 19, 21, 24, 26, 27, 28],
  Dealer: [14, 15, 23, 24, 26],
  OEM: [20, 21, 23, 24, 26],
};

export default function RolesPage() {
  const { token } = useAuth();
  const [selectedRole, setSelectedRole] = useState<string>('Admin');
  const [rolePermissions, setRolePermissions] = useState<Record<string, number[]>>(DEFAULT_ROLE_PERMISSIONS);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  const groupedPermissions = PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const hasPermission = (permissionId: number) => {
    return rolePermissions[selectedRole]?.includes(permissionId) || false;
  };

  const togglePermission = (permissionId: number) => {
    setRolePermissions((prev) => {
      const current = prev[selectedRole] || [];
      const updated = current.includes(permissionId)
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId];
      
      return {
        ...prev,
        [selectedRole]: updated,
      };
    });
    setHasChanges(true);
  };

  const toggleAllModulePermissions = (module: string) => {
    const modulePermIds = groupedPermissions[module].map((p) => p.id);
    const currentPerms = rolePermissions[selectedRole] || [];
    const allChecked = modulePermIds.every((id) => currentPerms.includes(id));

    setRolePermissions((prev) => {
      const updated = allChecked
        ? currentPerms.filter((id) => !modulePermIds.includes(id))
        : [...new Set([...currentPerms, ...modulePermIds])];

      return {
        ...prev,
        [selectedRole]: updated,
      };
    });
    setHasChanges(true);
  };

  const savePermissions = async () => {
    try {
      setSaving(true);
      const response = await fetch('http://localhost:3001/api/roles/permissions', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: selectedRole,
          permissions: rolePermissions[selectedRole],
        }),
      });

      const data = await response.json();

      if (data.success) {
        setHasChanges(false);
        alert('Permissions saved successfully!');
      } else {
        alert(data.error || 'Failed to save permissions');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setSaving(false);
    }
  };

  const resetPermissions = () => {
    setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
    setHasChanges(false);
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      'Admin': 'bg-red-100 text-red-800',
      'Maker': 'bg-blue-100 text-blue-800',
      'Checker': 'bg-green-100 text-green-800',
      'Business': 'bg-yellow-100 text-yellow-800',
      'BusinessHead': 'bg-orange-100 text-orange-800',
      'Finance': 'bg-purple-100 text-purple-800',
      'MIS': 'bg-indigo-100 text-indigo-800',
      'Dealer': 'bg-gray-100 text-gray-800',
      'OEM': 'bg-pink-100 text-pink-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Role Management</h1>
          <p className="mt-2 text-gray-600">Manage role permissions and access control</p>
        </div>
        <div className="flex gap-3">
          {hasChanges && (
            <>
              <button
                onClick={resetPermissions}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={savePermissions}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Roles List */}
        <div className="col-span-3 bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Roles</h2>
          <div className="space-y-2">
            {ROLES.map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  selectedRole === role
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{role}</span>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(role)}`}>
                    {rolePermissions[role]?.length || 0}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Permissions Grid */}
        <div className="col-span-9 bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Permissions for <span className={`px-2 py-1 text-sm rounded ${getRoleBadgeColor(selectedRole)}`}>{selectedRole}</span>
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {rolePermissions[selectedRole]?.length || 0} of {PERMISSIONS.length} permissions assigned
            </p>
          </div>

          <div className="p-6 space-y-6">
            {Object.entries(groupedPermissions).map(([module, perms]) => {
              const modulePermIds = perms.map((p) => p.id);
              const currentPerms = rolePermissions[selectedRole] || [];
              const allChecked = modulePermIds.every((id) => currentPerms.includes(id));
              const someChecked = modulePermIds.some((id) => currentPerms.includes(id)) && !allChecked;

              return (
                <div key={module} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">{module}</h3>
                    <button
                      onClick={() => toggleAllModulePermissions(module)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {allChecked ? 'Unselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {perms.map((perm) => (
                      <label
                        key={perm.id}
                        className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={hasPermission(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                          className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{perm.action}</div>
                          <div className="text-xs text-gray-500">{perm.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
