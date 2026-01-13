export default function UserManagement() {
  return (
    <div className="space-y-6">
      <div className="text-center py-12">
        <div className="mx-auto h-12 w-12 text-gray-400">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="mt-2 text-sm font-medium text-gray-900">User Management Disabled</h3>
        <p className="mt-1 text-sm text-gray-500">
          User management requires additional setup and permissions.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Contact your system administrator if you need access to user management features.
        </p>
      </div>
    </div>
  )
}