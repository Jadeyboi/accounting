export default function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 p-4">
      <div className="w-full max-w-md">
        <div className="glass animate-fadeIn rounded-2xl p-8 shadow-2xl text-center">
          <div className="mb-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
              <svg className="h-10 w-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-8">
            You don't have permission to view this page.
          </p>
          <button
            onClick={() => window.history.back()}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 font-medium text-white shadow-lg transition-all hover:from-blue-700 hover:to-blue-800"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}
