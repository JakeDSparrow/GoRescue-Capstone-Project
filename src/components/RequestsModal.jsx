import React, { useState } from 'react';
import './ModalStyles.css'; // Reuse your existing modal styles

export default function AddUserModal({ show, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    birthdate: '',
    age: '',
    address: '',
    gender: 'Male',
    role: 'Responder',
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

    if (name === 'birthdate') {
      const age = calculateAge(value);
      setFormData(prev => ({
        ...prev,
        birthdate: value,
        age: age > 0 ? age : ''
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = () => {
    if (!formData.fullName || !formData.email || !formData.birthdate || !formData.address) {
      alert("Please fill out all required fields.");
      return;
    }

    const newUser = {
      ...formData,
      id: Date.now(), // or use a custom UID if needed
      age: parseInt(formData.age)
    };

    onSubmit(newUser);
    onClose();

    // Reset form
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      birthdate: '',
      age: '',
      address: '',
      gender: 'Male',
      role: 'Responder',
      status: 'Active',
      photoUrl: ''
    });
  };

  if (!show) return null;

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
          <input name="email" value={formData.email} onChange={handleChange} required />
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
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
        </div>
        <div className="form-group">
          <label>Role</label>
          <select name="role" value={formData.role} onChange={handleChange}>
            <option>Responder</option>
            <option>Dispatcher</option>
            <option>Admin</option>
          </select>
        </div>

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>Add User</button>
        </div>
      </div>
    </div>
  );
}
