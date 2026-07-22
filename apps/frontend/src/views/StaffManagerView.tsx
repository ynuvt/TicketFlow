import React, { useState, useEffect } from 'react';
import { UserCheck, UserPlus, Shield, Key, Trash2, CheckCircle2, AlertCircle, Utensils, RefreshCw, Edit2 } from 'lucide-react';
import { StationId } from '@ticketflow/types';
import { useAuth } from '../context/AuthContext';

interface StaffUser {
  id: string;
  username: string;
  fullName: string;
  role: 'MANAGER' | 'STAFF' | 'RECEPTIONIST';
  assignedStations: string[];
  stationPrepTimes?: Record<string, number>;
  createdAt: string;
}

export const StaffManagerView: React.FC = () => {
  const { authFetch } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New user form state
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [role, setRole] = useState<'MANAGER' | 'STAFF' | 'RECEPTIONIST'>('STAFF');
  const [assignedStations, setAssignedStations] = useState<StationId[]>(['prep', 'grill']);
  const [stationPrepTimes, setStationPrepTimes] = useState<Record<string, number>>({
    intake: 5,
    prep: 5,
    grill: 5,
    assembly: 5,
    expedite: 5
  });

  // Edit user state
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [editFullName, setEditFullName] = useState<string>('');
  const [editUsername, setEditUsername] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editRole, setEditRole] = useState<'MANAGER' | 'STAFF' | 'RECEPTIONIST'>('STAFF');
  const [editAssignedStations, setEditAssignedStations] = useState<StationId[]>([]);
  const [editStationPrepTimes, setEditStationPrepTimes] = useState<Record<string, number>>({});

  const allStationKeys: { id: StationId; label: string }[] = [
    { id: 'intake', label: '1. Order Intake' },
    { id: 'prep', label: '2. Prep Line' },
    { id: 'grill', label: '3. Grill & Cook' },
    { id: 'assembly', label: '4. Plate & Assembly' },
    { id: 'expedite', label: '5. Expedite & Pass' },
  ];

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('http://localhost:4000/api/users');
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStation = (stId: StationId) => {
    if (assignedStations.includes(stId)) {
      setAssignedStations(assignedStations.filter((s) => s !== stId));
    } else {
      setAssignedStations([...assignedStations, stId]);
    }
  };

  const handleToggleEditStation = (stId: StationId) => {
    if (editAssignedStations.includes(stId)) {
      setEditAssignedStations(editAssignedStations.filter((s) => s !== stId));
    } else {
      setEditAssignedStations([...editAssignedStations, stId]);
      if (editStationPrepTimes[stId] === undefined) {
        setEditStationPrepTimes({ ...editStationPrepTimes, [stId]: 5 });
      }
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Clean up prep times to only include checked stations
    const cleanedPrepTimes: Record<string, number> = {};
    assignedStations.forEach((st) => {
      cleanedPrepTimes[st] = stationPrepTimes[st] || 5;
    });

    try {
      const res = await authFetch('http://localhost:4000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          fullName,
          role,
          assignedStations,
          stationPrepTimes: cleanedPrepTimes,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        setErrorMsg(errData.error || 'Failed to create user');
        return;
      }

      setSuccessMsg(`Successfully created account for ${fullName} (${username})!`);
      setUsername('');
      setPassword('');
      setFullName('');
      setRole('STAFF');
      setAssignedStations(['prep', 'grill']);
      setIsCreating(false);
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating user');
    }
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanedPrepTimes: Record<string, number> = {};
    editAssignedStations.forEach((st) => {
      cleanedPrepTimes[st] = editStationPrepTimes[st] || 5;
    });

    try {
      const res = await authFetch(`http://localhost:4000/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: editUsername,
          fullName: editFullName,
          role: editRole,
          assignedStations: editAssignedStations,
          stationPrepTimes: cleanedPrepTimes,
          ...(editPassword ? { password: editPassword } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        setErrorMsg(errData.error || 'Failed to update user');
        return;
      }

      setSuccessMsg(`Successfully updated staff member ${editFullName}!`);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating user');
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete staff user "${name}"?`)) return;

    try {
      const res = await authFetch(`http://localhost:4000/api/users/${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  const openEditModal = (u: StaffUser) => {
    setEditingUser(u);
    setEditFullName(u.fullName);
    setEditUsername(u.username);
    setEditPassword('');
    setEditRole(u.role);
    setEditAssignedStations(u.assignedStations as StationId[]);
    setEditStationPrepTimes(u.stationPrepTimes || {});
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Kitchen Staff & Station Credentials</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              Admin Manager Control
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Create staff accounts, assign station access, configure role boundaries, and specify station average preparation times.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Users"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setIsCreating(!isCreating);
              setEditingUser(null);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>{isCreating ? 'Cancel' : 'Create New Staff Account'}</span>
          </button>
        </div>
      </div>

      {(successMsg || errorMsg) && (
        <div className="space-y-2">
          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2.5 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* Create New User Panel */}
      {isCreating && (
        <div className="bg-white border border-blue-200 rounded-2xl p-6 shadow-md space-y-5">
          <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-600" />
            <span>New Kitchen Staff Credentials</span>
          </h3>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Vikram Singh"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. cook1"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="e.g. pass123"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-blue-600"
                >
                  <option value="STAFF">Kitchen Staff (Station Limited)</option>
                  <option value="MANAGER">Admin Manager (Full Access)</option>
                  <option value="RECEPTIONIST">Receptionist (Intake Only)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">Station Access Permissions & Average Time</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {allStationKeys.map((st) => {
                    const isChecked = assignedStations.includes(st.id);
                    return (
                      <div key={st.id} className="flex flex-col p-2.5 border rounded-xl bg-slate-50/50 justify-between gap-2 border-slate-200">
                        <button
                          type="button"
                          onClick={() => handleToggleStation(st.id)}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            isChecked
                              ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold shadow-sm'
                              : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {isChecked ? '✓ ' : '+ '}
                          {st.label}
                        </button>
                        {isChecked && st.id !== 'intake' && (
                          <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-slate-200 self-start">
                            <span className="text-[10px] text-slate-500 font-bold">Avg prep time:</span>
                            <input
                              type="number"
                              min="1"
                              max="60"
                              value={stationPrepTimes[st.id] || 5}
                              onChange={(e) => setStationPrepTimes({ ...stationPrepTimes, [st.id]: parseInt(e.target.value) || 5 })}
                              className="w-12 border border-slate-200 rounded px-1.5 py-0.5 text-center text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                            />
                            <span className="text-[10px] text-slate-400 font-semibold">mins</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              >
                Save Staff Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit User Modal Panel */}
      {editingUser && (
        <div className="bg-slate-900/40 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-blue-600" />
              <span>Edit Staff Credentials: {editingUser.fullName}</span>
            </h3>

            <form onSubmit={handleSaveEditUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Username</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Password (Leave blank to keep same)</label>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-blue-600"
                  >
                    <option value="STAFF">Kitchen Staff (Station Limited)</option>
                    <option value="MANAGER">Admin Manager (Full Access)</option>
                    <option value="RECEPTIONIST">Receptionist (Intake Only)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Station Access Permissions & Average Time</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {allStationKeys.map((st) => {
                      const isChecked = editAssignedStations.includes(st.id);
                      return (
                        <div key={st.id} className="flex flex-col p-2.5 border rounded-xl bg-slate-50/50 justify-between gap-2 border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleToggleEditStation(st.id)}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              isChecked
                                ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold shadow-sm'
                                : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {isChecked ? '✓ ' : '+ '}
                            {st.label}
                          </button>
                          {isChecked && st.id !== 'intake' && (
                            <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-slate-200 self-start">
                              <span className="text-[10px] text-slate-500 font-bold">Avg prep time:</span>
                              <input
                                type="number"
                                min="1"
                                max="60"
                                value={editStationPrepTimes[st.id] ?? 5}
                                onChange={(e) => setEditStationPrepTimes({ ...editStationPrepTimes, [st.id]: parseInt(e.target.value) || 5 })}
                                className="w-12 border border-slate-200 rounded px-1.5 py-0.5 text-center text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                              />
                              <span className="text-[10px] text-slate-400 font-semibold">mins</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Accounts Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Active User Accounts ({users.length})</h3>
          <span className="text-xs font-mono text-slate-500">PostgreSQL Synchronized</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400 font-medium">Loading user accounts...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/30">
                  <th className="py-3 px-5">Staff Member</th>
                  <th className="py-3 px-5">Username</th>
                  <th className="py-3 px-5">Role</th>
                  <th className="py-3 px-5">Assigned Station Permissions & Avg Times</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-5 font-bold text-slate-900 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-xs">
                        {u.fullName.substring(0, 2).toUpperCase()}
                      </div>
                      <span>{u.fullName}</span>
                    </td>
                    <td className="py-4 px-5 font-mono text-slate-600">{u.username}</td>
                    <td className="py-4 px-5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          u.role === 'MANAGER'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : u.role === 'RECEPTIONIST'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex flex-wrap gap-1.5">
                        {allStationKeys.map((st) => {
                          const hasSt = u.assignedStations.includes(st.id);
                          const pTimes = u.stationPrepTimes || {};
                          const hasPrepTime = pTimes[st.id] !== undefined;

                          return (
                            <span
                              key={st.id}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                hasSt
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-400 border border-slate-200/60'
                              }`}
                            >
                              {st.id}
                              {hasSt && hasPrepTime && st.id !== 'intake' && (
                                <span className="ml-1 text-slate-500 font-normal">({pTimes[st.id]}m)</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-4 px-5 text-right space-x-1.5">
                      <button
                        onClick={() => openEditModal(u)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Edit Account Details"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {u.username !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.fullName)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
