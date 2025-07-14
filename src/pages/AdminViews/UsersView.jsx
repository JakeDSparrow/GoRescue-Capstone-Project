import React, { useState } from 'react';

const UsersView = () => {
  const [users, setUsers] = useState([
    {
      id: 1,
      fullName: "Admin One",
      age: 35,
      birthdate: "1988-03-10",
      address: "123 Admin Street",
      phone: "+1 555 123 4567",
      email: "admin1@gorescue.com",
      gender: "Male",
      status: "Active",
      role: "Admin",
      photoUrl: ""
    },
    {
      id: 2,
      fullName: "Admin Two",
      age: 32,
      birthdate: "1991-07-22",
      address: "456 Admin Avenue",
      phone: "+1 555 987 6543",
      email: "admin2@gorescue.com",
      gender: "Female",
      status: "Active",
      role: "Admin",
      photoUrl: ""
    },
    {
      id: 3,
      fullName: "John Responder",
      age: 28,
      birthdate: "1995-05-15",
      address: "123 Rescue St",
      phone: "+1 234 567 8901",
      email: "john@gorescue.com",
      gender: "Male",
      status: "Active",
      role: "Responder",
      photoUrl: ""
    },
    {
      id: 4,
      fullName: "Jane Dispatcher",
      age: 30,
      birthdate: "1993-08-12",
      address: "456 Dispatch Ave",
      phone: "+1 987 654 3210",
      email: "jane@gorescue.com",
      gender: "Female",
      status: "Active",
      role: "Dispatcher",
      photoUrl: ""
    }
  ]);

  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    fullName: '',
    email: '',
    phone: '',
    birthdate: '',
    age: '',
    address: '',
    nationality: '',
    gender: 'Male',
    role: 'Responder',
    status: 'Active'
  });

  const calculateAge = (birthdate) => {
    const today = new Date();
    const birthDate = new Date(birthdate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleEdit = (user) => {
    setEditingId(user.id);
    setFormData({ ...user });
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleSave = (id) => {
    setUsers(users.map(user => user.id === id ? { ...formData } : user));
    setEditingId(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStatusChange = (id, status) => {
    if (status === "Inactive") {
      if (window.confirm("Are you sure? Inactive status cannot be changed later.")) {
        setUsers(users.map(user => user.id === id ? { ...user, status } : user));
      }
    } else {
      setUsers(users.map(user => user.id === id ? { ...user, status } : user));
    }
  };

  const openRoleModal = (userId) => {
    setSelectedUserId(userId);
    setShowRoleModal(true);
  };

  const updateUserRole = (role) => {
    setUsers(users.map(user => user.id === selectedUserId ? { ...user, role } : user));
    setShowRoleModal(false);
  };

  const handleAddUser = () => {
    setUsers([
      ...users,
      {
        ...newUser,
        id: Math.max(...users.map(u => u.id)) + 1,
        age: parseInt(newUser.age) || 0,
        photoUrl: ""
      }
    ]);
    setShowAddUserModal(false);
    setNewUser({
      fullName: '',
      email: '',
      phone: '',
      birthdate: '',
      age: '',
      address: '',
      nationality: '',
      gender: 'Male',
      role: 'Responder',
      status: 'Active'
    });
  };

  const handleNewUserChange = (e) => {
    const { name, value } = e.target;

    if (name === 'birthdate') {
      const age = calculateAge(value);
      setNewUser(prev => ({
        ...prev,
        birthdate: value,
        age: age > 0 ? age.toString() : ''
      }));
    } else {
      setNewUser(prev => ({ ...prev, [name]: value }));
    }
  };

  const filteredUsers = users.filter(user => user.role !== "Admin");

  return (
    <div className="users-container">
      <div className="users-header">
        <h2>User Management</h2>
        <button className="btn btn-primary" onClick={() => setShowAddUserModal(true)}>
          <i className="fas fa-plus"></i> Add New User
        </button>
      </div>

      <div className="admin-users">
        <h3>Administrators</h3>
        <div className="admin-list">
          {users
            .filter(user => user.role === "Admin")
            .map(admin => (
              <div key={admin.id} className="admin-card">
                <div className="admin-info">
                  <h4>{admin.fullName}</h4>
                  <p>{admin.email}</p>
                </div>
                <span className="admin-badge">Admin</span>
              </div>
            ))}
        </div>
      </div>

      <div className="users-list">
        {filteredUsers.map(user => (
          <div key={user.id} className="user-card">
            {editingId === user.id ? (
              <div className="user-edit-form">
                <div className="form-group">
                  <label>Full Name</label>
                  <input name="fullName" value={formData.fullName} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input name="email" value={formData.email} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input name="phone" value={formData.phone} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select name="role" value={formData.role} onChange={handleChange}>
                    <option value="Responder">Responder</option>
                    <option value="Dispatcher">Dispatcher</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleChange}>
                    <option value="Active">Active</option>
                    <option value="Unavailable">Unavailable</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="form-actions">
                  <button className="btn btn-outline" onClick={handleCancel}>Cancel</button>
                  <button className="btn btn-primary" onClick={() => handleSave(user.id)}>Save</button>
                </div>
              </div>
            ) : (
              <>
                <div className="user-header">
                  <h3>{user.fullName}</h3>
                  <div className="user-meta">
                    <span className={`user-status ${user.status.toLowerCase()}`}>{user.status}</span>
                    <span className={`user-role ${user.role.toLowerCase()}`}>{user.role}</span>
                  </div>
                </div>
                <div className="user-details">
                  <p><strong>Email:</strong> {user.email}</p>
                  <p><strong>Phone:</strong> {user.phone}</p>
                  <p><strong>Birthdate:</strong> {user.birthdate}</p>
                  <p><strong>Address:</strong> {user.address}</p>
                  <p><strong>Gender:</strong> {user.gender}</p>
                </div>
                <div className="user-actions">
                  <div className="status-actions">
                    <label>Change Status:</label>
                    <select
                      value={user.status}
                      onChange={(e) => handleStatusChange(user.id, e.target.value)}
                      disabled={user.status === "Inactive"}
                    >
                      <option value="Active">Active</option>
                      <option value="Unavailable">Unavailable</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                    <button className="btn btn-outline" onClick={() => openRoleModal(user.id)}>
                      Change Role
                    </button>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleEdit(user)}
                    disabled={user.status === "Inactive"}
                  >
                    <i className="fas fa-edit"></i> Edit
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="modal-overlay">
          {/* Add modal content (as you already have it) */}
        </div>
      )}

      {/* Role Change Modal */}
      {showRoleModal && (
        <div className="modal-overlay">
          {/* Add role modal content (as you already have it) */}
        </div>
      )}
    </div>
  );
};

export default UsersView;
