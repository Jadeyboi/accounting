import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface User {
  id: string
  email: string
  full_name: string | null
  role: 'super_admin' | 'admin' | 'user'
  created_at: string
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'admin' | 'user'>('user')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    setError(null)

    try {
      // Try to load from users table first
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        // If users table doesn't exist, show a setup message
        if (error.message.includes('relation "public.users" does not exist')) {
          setError('User management table not set up. Please run the auth setup script.')
        } else {
          setError(error.message)
        }
      } else {
        setUsers((data ?? []) as User[])
      }
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  const handleCreateUser = async () => {
    if (!email || !password || !fullName) {
      alert('Please fill in all fields')
      return
    }

    try {
      // Use regular signup instead of admin.createUser
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: role
          }
        }
      })

      if (authError) throw authError

      // Manually insert into users table if needed
      if (authData.user) {
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: authData.user.email,
            full_name: fullName.trim(),
            role: role
          })

        if (insertError && !insertError.message.includes('duplicate key')) {
          console.warn('Could not insert user into users table:', insertError)
        }
      }

      alert('User created successfully! They will need to verify their email.')
      setShowModal(false)
      resetForm()
      await loadUsers()
    } catch (err: any) {
      alert(err.message || 'Failed to create user')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      // Delete from users table
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (error) throw error

      alert('User removed from system!')
      await loadUsers()
    } catch (err: any) {
      alert(err.message || 'Failed to delete user')
    }
  }

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      alert('User role updated successfully!')
      await loadUsers()
    } catch (err: any) {
      alert(err.message || 'Failed to update user role')
    }
  }

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setFullName('')
    setRole('user')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-600">Manage system users and their roles</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
        >
          + Add User
        </button>
      </div>

      {/* Users List */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-lg">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Users</h3>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading users...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{error}</p>
              {error.includes('auth setup script') && (
                <div className="text-sm text-gray-600">
                  <p>To set up user management, run the auth-setup.sql script in Supabase.</p>
                </div>
              )}
              <button
                onClick={loadUsers}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Retry Loading
              </button>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No users found. Add your first user!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">User</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Created</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {users
                    .sort((a, b) => {
                      const nameA = a.full_name || a.email || ''
                      const nameB = b.full_name || b.email || ''
                      return nameA.localeCompare(nameB)
                    })
                    .map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{user.full_name || 'No name'}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                          className="text-sm rounded border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-center text-sm">
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Add New User</h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter email address"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter password"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="rounded-md bg-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}