"use client";
import React, { useState, useEffect } from 'react';
import { Trash2, UserPlus, Shield, User, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function AdminView() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // New user form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch users');
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not load users. Make sure you are an admin and the server is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddingUser(true);
    setError(null);
    setAddSuccess(false);
    
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword, isAdmin: newIsAdmin })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      
      setAddSuccess(true);
      setNewEmail('');
      setNewPassword('');
      setNewIsAdmin(false);
      setShowAddForm(false);
      fetchUsers(); // Refresh the list
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setAddingUser(false);
    }
  };

  const handleDeleteUser = async (uid, email) => {
    if (!window.confirm(`Are you sure you want to permanently delete the user ${email}?`)) return;
    
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete user');
      }
      
      fetchUsers(); // Refresh the list
    } catch (err) {
      console.error(err);
      alert('Error deleting user: ' + err.message);
    }
  };

  const toggleAdminStatus = async (uid, currentStatus) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, isAdmin: !currentStatus })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update user');
      }
      
      // Optimistically update the UI
      setUsers(users.map(u => u.uid === uid ? { ...u, isAdmin: !currentStatus } : u));
    } catch (err) {
      console.error(err);
      alert('Error updating user role: ' + err.message);
    }
  };

  return (
    <div className="flex-1 p-8 overflow-auto pb-32">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-black text-white tracking-widest uppercase mb-1">User Management</h2>
            <p className="text-[#CBBB9D] text-sm font-medium">Control dashboard access and administrator privileges</p>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={fetchUsers}
              className="px-4 py-2 bg-[#0C272D] border border-[#74FA93]/30 text-[#74FA93] hover:bg-[#74FA93]/10 hover:text-white rounded-xl transition-all text-xs font-black uppercase tracking-widest flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-[#74FA93]/20 border border-[#74FA93]/50 text-[#74FA93] hover:bg-[#74FA93]/40 hover:text-white rounded-xl transition-all text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-[0_0_15px_rgba(116,250,147,0.15)]"
            >
              <UserPlus className="w-4 h-4" />
              {showAddForm ? 'Cancel' : 'Add User'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-2xl text-sm font-medium mb-6 flex items-center gap-3 shadow-lg">
            <Shield className="w-5 h-5 text-red-500" />
            {error}
          </div>
        )}

        {addSuccess && (
          <div className="bg-[#74FA93]/10 border border-[#74FA93]/30 text-[#74FA93] p-4 rounded-2xl text-sm font-medium mb-6 flex items-center gap-3 shadow-lg">
            <CheckCircle2 className="w-5 h-5 text-[#74FA93]" />
            User successfully created and granted access.
          </div>
        )}

        {showAddForm && (
          <div className="bg-[#113A42] p-6 rounded-3xl border border-[#74FA93]/20 shadow-2xl mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 opacity-5 pointer-events-none" style={{ backgroundImage: "url('/pattern-2.png')", backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'top right' }}></div>
            
            <h3 className="text-[#CBBB9D] font-black uppercase tracking-widest text-sm mb-4">Create New User</h3>
            
            <form onSubmit={handleAddUser} className="relative z-10 flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Email Address</label>
                <input 
                  type="email" 
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-[#0C272D] border border-gray-600/50 rounded-xl px-4 py-2.5 text-sm text-[#F1EAD8] focus:outline-none focus:border-[#74FA93]/50 transition-all"
                  placeholder="name@example.com"
                  required 
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Temporary Password</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#0C272D] border border-gray-600/50 rounded-xl px-4 py-2.5 text-sm text-[#F1EAD8] focus:outline-none focus:border-[#74FA93]/50 transition-all"
                  placeholder="Min 6 characters"
                  required 
                  minLength={6}
                />
              </div>
              <div className="flex items-center gap-3 pb-2 px-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={newIsAdmin}
                    onChange={(e) => setNewIsAdmin(e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-[#0C272D] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#74FA93]/30 peer-checked:after:bg-[#74FA93]"></div>
                  <span className="ml-2 text-xs font-bold text-gray-300 uppercase tracking-wider">Admin Rights</span>
                </label>
              </div>
              
              <button 
                type="submit" 
                disabled={addingUser}
                className="px-6 py-2.5 bg-[#74FA93]/20 hover:bg-[#74FA93]/40 border border-[#74FA93]/50 text-[#74FA93] hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
              >
                {addingUser ? 'Creating...' : 'Create'}
              </button>
            </form>
          </div>
        )}

        <div className="bg-[#113A42] border border-[#74FA93]/10 rounded-3xl overflow-hidden shadow-2xl relative">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0C272D]/50 border-b border-[#74FA93]/10">
                  <th className="py-4 px-6 text-[10px] font-black text-[#CBBB9D] uppercase tracking-widest">User Details</th>
                  <th className="py-4 px-6 text-[10px] font-black text-[#CBBB9D] uppercase tracking-widest text-center">Role</th>
                  <th className="py-4 px-6 text-[10px] font-black text-[#CBBB9D] uppercase tracking-widest text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading && users.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="py-12 text-center text-gray-500 font-medium">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="py-12 text-center text-gray-500 font-medium">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr key={user.uid} className="hover:bg-[#0C272D]/30 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.isAdmin ? 'bg-[#74FA93]/10 text-[#74FA93]' : 'bg-gray-800 text-gray-400'}`}>
                            {user.isAdmin ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm">{user.email}</div>
                            <div className="text-xs text-gray-500">ID: {user.uid.substring(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex justify-center">
                           <button 
                            onClick={() => toggleAdminStatus(user.uid, user.isAdmin)}
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${user.isAdmin ? 'bg-[#74FA93]/10 border border-[#74FA93]/30 text-[#74FA93] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30' : 'bg-gray-800 border border-gray-600 text-gray-400 hover:bg-[#74FA93]/10 hover:text-[#74FA93] hover:border-[#74FA93]/30'}`}
                            title={user.isAdmin ? "Revoke Admin" : "Make Admin"}
                           >
                            {user.isAdmin ? 'Admin' : 'Viewer'}
                           </button>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex justify-center">
                          <button 
                            onClick={() => handleDeleteUser(user.uid, user.email)}
                            className="p-2 bg-red-500/0 hover:bg-red-500/10 text-gray-500 hover:text-red-400 rounded-lg transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
