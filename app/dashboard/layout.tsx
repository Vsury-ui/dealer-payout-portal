'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', roles: ['all'] },
    { name: 'Users', href: '/dashboard/users', roles: ['Admin'] },
    { name: 'Role Management', href: '/dashboard/roles', roles: ['Admin'] },
    { name: 'Dealers', href: '/dashboard/dealers', roles: ['Admin', 'Maker', 'Checker'] },
    { name: 'Payout Cycles', href: '/dashboard/payouts', roles: ['Admin', 'Maker', 'Checker', 'Business'] },
    { name: 'Invoices', href: '/dashboard/invoices', roles: ['Admin', 'Finance', 'Dealer'] },
    { name: 'Finance', href: '/dashboard/finance', roles: ['Admin', 'Finance'] },
    { name: 'OEM', href: '/dashboard/oem', roles: ['Admin', 'Maker', 'Checker', 'BusinessHead', 'OEM'] },
    { name: 'Disputes', href: '/dashboard/disputes', roles: ['Admin', 'Checker', 'Business', 'Dealer', 'OEM'] },
    { name: 'Reports', href: '/dashboard/reports', roles: ['Admin', 'MIS'] },
  ];

  const canAccess = (roles: string[]) => {
    return roles.includes('all') || roles.includes(user.role);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold">Dealer Portal</h1>
          <p className="text-sm text-gray-400 mt-1">{user.role}</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) =>
            canAccess(item.roles) ? (
              <Link
                key={item.name}
                href={item.href}
                className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors"
              >
                {item.name}
              </Link>
            ) : null
          )}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <div className="mb-3">
            <p className="text-sm text-gray-400">Logged in as</p>
            <p className="font-medium">{user.username}</p>
            <p className="text-xs text-gray-400">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="w-full px-4 py-2 text-sm bg-red-600 rounded hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
}
