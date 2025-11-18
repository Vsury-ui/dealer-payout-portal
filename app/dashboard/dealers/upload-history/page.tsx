'use client';

import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UploadJob {
  id: number;
  job_id: string;
  filename: string;
  uploaded_by_username: string;
  status: string;
  total_records: number;
  success_count: number;
  error_count: number;
  created_at: string;
  completed_at: string;
}

interface UploadJobDetail extends UploadJob {
  errors: any[];
}

export default function DealerUploadHistoryPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [uploadHistory, setUploadHistory] = useState<UploadJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<UploadJobDetail | null>(null);
  const [showJobDetailModal, setShowJobDetailModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUploadHistory();
    const interval = setInterval(fetchUploadHistory, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [token]);

  const fetchUploadHistory = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/dealers/upload-history', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      
      if (data.success) {
        setUploadHistory(data.data);
      }
    } catch (err) {
      console.error('Error fetching upload history:', err);
    } finally {
      setLoading(false);
    }
  };

  const viewJobDetails = async (jobId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/dealers/upload-history/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      
      if (data.success) {
        setSelectedJob(data.data);
        setShowJobDetailModal(true);
      } else {
        alert('Failed to fetch job details');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      'completed': 'bg-green-100 text-green-800',
      'processing': 'bg-blue-100 text-blue-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'failed': 'bg-red-100 text-red-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dealer Bulk Upload History</h1>
          <p className="mt-2 text-gray-600">Track and review all bulk dealer upload jobs</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/dealers')}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Back to Dealers
        </button>
      </div>

      {/* Upload History Table */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-6 text-center text-gray-600">Loading upload history...</div>
        ) : uploadHistory.length === 0 ? (
          <div className="p-6 text-center text-gray-600">No upload history found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filename</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Success</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Failed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {uploadHistory.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{job.filename}</div>
                      <div className="text-xs text-gray-500">ID: {job.job_id.substring(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{job.uploaded_by_username}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(job.status)}`}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{job.total_records || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">{job.success_count || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">{job.error_count || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.completed_at ? new Date(job.completed_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => viewJobDetails(job.job_id)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View Summary
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Job Detail Modal */}
      {showJobDetailModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold">Upload Summary Details</h2>
                <p className="text-gray-600 mt-1">{selectedJob.filename}</p>
              </div>
              <button
                onClick={() => setShowJobDetailModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Records</p>
                <p className="text-2xl font-bold text-gray-900">{selectedJob.total_records}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-600">Successfully Processed</p>
                <p className="text-2xl font-bold text-green-900">{selectedJob.success_count}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-red-600">Failed</p>
                <p className="text-2xl font-bold text-red-900">{selectedJob.error_count}</p>
              </div>
            </div>

            <div className="mb-4 bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Uploaded by</p>
                  <p className="font-medium">{selectedJob.uploaded_by_username}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(selectedJob.status)}`}>
                    {selectedJob.status.charAt(0).toUpperCase() + selectedJob.status.slice(1)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Uploaded at</p>
                  <p className="font-medium">{new Date(selectedJob.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Completed at</p>
                  <p className="font-medium">
                    {selectedJob.completed_at ? new Date(selectedJob.completed_at).toLocaleString() : 'In progress...'}
                  </p>
                </div>
              </div>
            </div>

            {selectedJob.errors && selectedJob.errors.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Failed Records ({selectedJob.errors.length})</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-red-50">
                      <tr className="border-b border-red-200">
                        <th className="text-left py-2 text-sm font-medium text-red-900">Row</th>
                        <th className="text-left py-2 text-sm font-medium text-red-900">Error</th>
                        <th className="text-left py-2 text-sm font-medium text-red-900">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedJob.errors.map((error: any, idx: number) => (
                        <tr key={idx} className="border-b border-red-100">
                          <td className="py-2 text-sm text-gray-900">{error.row || idx + 1}</td>
                          <td className="py-2 text-sm text-red-700">{error.error}</td>
                          <td className="py-2 text-sm text-gray-600">
                            {error.data && typeof error.data === 'object' ? (
                              <details className="cursor-pointer">
                                <summary className="text-blue-600 hover:text-blue-800">View data</summary>
                                <pre className="text-xs mt-1 bg-white p-2 rounded overflow-x-auto">{JSON.stringify(error.data, null, 2)}</pre>
                              </details>
                            ) : (
                              error.data || '-'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500 mt-2">* Showing up to 100 error records</p>
              </div>
            )}

            {(!selectedJob.errors || selectedJob.errors.length === 0) && selectedJob.status === 'completed' && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                <p className="text-green-700 font-medium">✓ All records processed successfully!</p>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowJobDetailModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
