import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from "firebase/functions";
import AddUserModal from '../../components/AddUserModal';

const UsersView = () => {
    const [users, setUsers] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({});
    const [showAddUserModal, setShowAddUserModal] = useState(false);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "mdrrmo-users"));
                const fetchedUsers = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                setUsers(fetchedUsers);
            } catch (error) {
                console.error("Error fetching users from Firestore:", error);
            }
        };
        fetchUsers();
    }, []);

    const handleAddUser = async (newUserData) => {
        const functions = getFunctions();
        const addUserFunction = httpsCallable(functions, 'addUser');
        try {
            await addUserFunction(newUserData);
            
            // Refetch users to get the latest list including the new one
            const querySnapshot = await getDocs(collection(db, "mdrrmo-users"));
            const updatedUsers = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            setUsers(updatedUsers);

            alert("User successfully added!");
            setShowAddUserModal(false);
        } catch (error) {
            console.error("Error adding user via cloud function:", error);
            alert(`Failed to add user: ${error.message}`);
        }
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
            const userRef = doc(db, "mdrrmo-users", editingId);
            await setDoc(userRef, formData, { merge: true });

            // Update local state to reflect the changes immediately
            setUsers(users.map(user => user.id === editingId ? { ...formData, id: editingId } : user));
            setEditingId(null);
        } catch (error) {
            console.error("Error during handleSave:", error);
            alert("Failed to save changes.");
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const filteredUsers = users.filter(user => user.role === "responder" || user.role === "dispatcher");

    return (
        <div className="users-container">
            <div className="users-header">
                <h2>User Management</h2>
                <button className="btn btn-primary" onClick={() => setShowAddUserModal(true)}>
                    <i className="fas fa-plus"></i> Add New User
                </button>
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
                                        <option value="responder">Responder</option>
                                        <option value="dispatcher">Dispatcher</option>
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
                                    <div className="anonymous-profile">
                                        <span className="profile-icon">👤</span>
                                    </div>
                                    <h3>{user.fullName}</h3>
                                    <div className="user-meta">
                                        <span className={`user-status ${String(user.status || '').toLowerCase()}`}>
                                            {user.status || 'unknown'}
                                        </span>
                                        <span className={`user-role ${String(user.role || '').toLowerCase()}`}>
                                            {user.role || 'unknown'}
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
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => handleEdit(user)}
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
                    onSubmit={handleAddUser}
                    onClose={() => setShowAddUserModal(false)}
                />
            )}
        </div>
    );
};

export default UsersView;