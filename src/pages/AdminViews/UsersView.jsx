import React, { useState, useEffect } from 'react';
import { auth, db } from '../../firebase';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import AddUserModal from '../../components/AddUserModal';

const UsersView = () => {
  const [users, setUsers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
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

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "mdrrmo-users"));
        const fetchedUsers = [];
        querySnapshot.forEach((doc) => {
          fetchedUsers.push({ ...doc.data(), id: doc.id });
        });
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Error fetching users from Firestore:", error);
      }
    };

    fetchUsers();
  }, []);

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

  const handleSave = async () => {
    try {
      const cleanedFormData = {
        ...formData,
        role: String(formData.role || ''),
        status: String(formData.status || '')
      };

      console.log("Saving user with ID:", editingId);
      console.log("Cleaned Form Data:", cleanedFormData);

      const userRef = doc(db, "mdrrmo-users", editingId);
      await setDoc(userRef, cleanedFormData, { merge: true });

      const querySnapshot = await getDocs(collection(db, "mdrrmo-users"));
      const updatedUsers = [];
      querySnapshot.forEach((doc) => {
        updatedUsers.push({ ...doc.data(), id: doc.id });
      });
      setUsers(updatedUsers);
      setEditingId(null);
    } catch (error) {
      console.error("🔥 Error during handleSave:", error);
      alert("Failed to save changes. Check console for details.");
    }
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

  const handleAddUser = async (userData) => {
    const auth = getAuth();
    const tempPassword = "Temp1234!";
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, userData.email, tempPassword);
      const uid = userCredential.user.uid;

      const newUserDoc = {
        ...userData,
        uid,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "mdrrmo-users", uid), newUserDoc);
      setUsers(prev => [...prev, { ...newUserDoc, id: uid }]);

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

      alert(`User created! Temporary password: ${tempPassword}`);
    } catch (error) {
      console.error("Error adding user:", error);
      alert(error.message);
    }
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
          {users.filter(user => user.role === "Admin").map(admin => (
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
                  <button className="btn btn-primary" onClick={handleSave}>Save</button>
                </div>
              </div>
            ) : (
              <>
                <div className="user-header">
                  <h3>{user.fullName}</h3>
                  <div className="user-meta">
                    <span className={`user-status ${String(user.status || '').toLowerCase()}`}>
                      {user.status || 'Unknown'}
                    </span>
                    <span className={`user-role ${String(user.role || '').toLowerCase()}`}>
                      {user.role || 'Unknown'}
                    </span>
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

      {showAddUserModal && (
        <AddUserModal
          show={showAddUserModal}
          onSubmit={handleAddUser}
          onClose={() => setShowAddUserModal(false)}
          onAddUser={handleAddUser}
          newUser={newUser}
          setNewUser={setNewUser}
          handleNewUserChange={handleNewUserChange}
        />
      )}
    </div>
  );
};

export default UsersView;
