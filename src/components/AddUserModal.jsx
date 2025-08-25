import React, { useState } from 'react';
import './modalstyles/AdminModalStyles.css';

export default function AddUserModal({ onClose, onSubmit }) {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        birthdate: '',
        age: '',
        address: '',
        gender: 'Male',
        role: 'responder',
        status: 'Active', 
        photoUrl: ''
    });

    const calculateAge = (birthdate) => {
        const today = new Date();
        const birthDate = new Date(birthdate);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        const newFormData = { ...formData };

        if (name === 'birthdate') {
            const age = calculateAge(value);
            newFormData.age = age > 0 ? age : '';
        }

        if (name === 'role' || name === 'status') {
            newFormData[name] = value.toLowerCase();
        } else {
            newFormData[name] = value;
        }

        setFormData(newFormData);
    };

    const handleSubmit = () => {
        if (!formData.fullName || !formData.email || !formData.birthdate || !formData.address) {
            alert("Please fill out all required fields.");
            return;
        }

        const newUser = {
            ...formData,
            age: parseInt(formData.age)
        };
        
        onSubmit(newUser);
        onClose();

        // Reset the form data after submission
        setFormData({
            fullName: '',
            email: '',
            phone: '',
            birthdate: '',
            age: '',
            address: '',
            gender: 'Male',
            role: 'responder',
            status: 'Active',
            photoUrl: ''
        });
    };

    return (
        <div className="modal-overlay">
            <div className="modal">
                <h3>Add New User</h3>

                <div className="form-group">
                    <label>Full Name</label>
                    <input name="fullName" value={formData.fullName} onChange={handleChange} required />
                </div>
                <div className="form-group">
                    <label>Email</label>
                    <input name="email" type="email" value={formData.email} onChange={handleChange} required />
                </div>
                <div className="form-group">
                    <label>Phone</label>
                    <input name="phone" value={formData.phone} onChange={handleChange} />
                </div>
                <div className="form-group">
                    <label>Birthdate</label>
                    <input type="date" name="birthdate" value={formData.birthdate} onChange={handleChange} />
                </div>
                <div className="form-group">
                    <label>Age</label>
                    <input name="age" value={formData.age} readOnly />
                </div>
                <div className="form-group">
                    <label>Address</label>
                    <input name="address" value={formData.address} onChange={handleChange} />
                </div>
                <div className="form-group">
                    <label>Gender</label>
                    <select name="gender" value={formData.gender} onChange={handleChange}>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Role</label>
                    <select name="role" value={formData.role} onChange={handleChange}>
                        <option value="responder">Responder</option>
                        <option value="dispatcher">Dispatcher</option>
                    </select>
                </div>
                
                <div className="info-box" style={{
                    backgroundColor: '#e3f2fd',
                    border: '1px solid #2196f3',
                    borderRadius: '4px',
                    padding: '12px',
                    margin: '16px 0',
                    fontSize: '14px',
                    color: '#1976d2'
                }}>
                    📧 The user will receive instructions to complete their registration using the provided email address.
                </div>

                <div className="modal-actions">
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit}>Add User</button>
                </div>
            </div>
        </div>
    );
}