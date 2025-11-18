'use client';

import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import { User } from '@/types';

export default function DashboardPage() {
  const { user, token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/users', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await response.json();
        
        if (data.success) {
          setUsers(data.data);
        } else {
          setError(data.error || 'Failed to fetch users');
        }
      } catch (err) {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    };

    if (token && user?.role === 'Admin') {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [token, user]);

  const stats = [
    { label: 'Total Users', value: users.length.toString(), color: 'bg-blue-500' },
    { label: 'Active Users', value: users.filter(u => u.is_active).length.toString(), color: 'bg-green-500' },
    { label: 'Admins', value: users.filter(u => u.role === 'Admin').length.toString(), color: 'bg-yellow-500' },
    { label: 'Dealers', value: users.filter(u => u.role === 'Dealer').length.toString(), color: 'bg-purple-500' },
  ];

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">Welcome back, {user?.username}!</p>
      </div>

      {user?.role === 'Admin' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white rounded-lg shadow p-6">
                <div className={`w-12 h-12 ${stat.color} rounded-lg mb-4 flex items-center justify-center text-white`}>
                  <span className="text-xl font-bold">#</span>
                </div>
                <p className="text-gray-600 text-sm">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow mb-8">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Users Overview</h2>
            </div>
            
            {loading ? (
              <div className="p-6 text-center text-gray-600">Loading users...</div>
            ) : error ? (
              <div className="p-6 text-center text-red-600">{error}</div>
            ) : users.length === 0 ? (
              <div className="p-6 text-center text-gray-600">No users found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AD ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mobile</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{u.username}</div>
                          {u.user_code && <div className="text-sm text-gray-500">{u.user_code}</div>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{u.ad_id}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(u.role)}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{u.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{u.mobile}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {u.is_active ? (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Active</span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Inactive</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {user?.role !== 'Admin' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Welcome</h2>
          <p className="text-gray-600">You are logged in as <strong>{user?.role}</strong></p>
          <p className="text-gray-600 mt-2">Use the navigation menu to access your assigned modules.</p>
        </div>
      )}
    </div>
  );
}
