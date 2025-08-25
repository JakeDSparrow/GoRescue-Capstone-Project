import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import AddUserModal from '../../components/AddUserModal';

const UsersView = () => {
    const [users, setUsers] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({});
    const [showAddUserModal, setShowAddUserModal] = useState(false);

    const auth = getAuth();

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
                role: String(formData.role || '').toLowerCase(),
                status: String(formData.status || '').toLowerCase()
            };

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

    const handleAddUser = async (userData) => {
        try {
            // Generate a unique ID for the user
            const userId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            
            const newUserDoc = {
                ...userData,
                id: userId,
                uid: null, // No Firebase Auth account yet
                accountStatus: 'pending', // User needs to complete registration
                createdAt: new Date().toISOString(),
                createdBy: auth.currentUser.uid
            };

            // Save user data to Firestore
            await setDoc(doc(db, "mdrrmo-users", userId), newUserDoc);
            
            // Update the users list
            setUsers(prev => [...prev, newUserDoc]);
            setShowAddUserModal(false);

            alert(`User added successfully! They can now register using email: ${userData.email}`);
            
        } catch (error) {
            console.error("Error adding user:", error);
            alert(`Error adding user: ${error.message}`);
        }
    };

    const handleNewUserChange = (e) => {
        const { name, value } = e.target;
        const newFormData = { ...formData, [name]: value };

        if (name === 'birthdate') {
            const age = calculateAge(value);
            newFormData.age = age > 0 ? age.toString() : '';
        }
        
        setFormData(newFormData);
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
                                            {user.role === "dispatcher" ? "active" : (user.status || 'unknown')}
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
                                        disabled={user.status === "inactive"}
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
                />
            )}
        </div>
    );
};

export default UsersView;