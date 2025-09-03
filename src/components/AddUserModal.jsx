import React, { useState } from 'react';
import './modalstyles/AdminModalStyles.css'; // Make sure this path is correct

export default function AddUserModal({ onClose, onSubmit }) {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        birthdate: '',
        age: '',
        address: '',
        gender: 'male',    // Corrected to lowercase to match <option> values
        role: 'responder',
        status: 'active',
    });

    /**
     * Calculates the age based on a given birthdate string.
     * @param {string} birthdate - The birthdate in 'YYYY-MM-DD' format.
     * @returns {number|string} The calculated age or an empty string if invalid.
     */
    const calculateAge = (birthdate) => {
        if (!birthdate) return '';
        const today = new Date();
        const birthDate = new Date(birthdate);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDifference = today.getMonth() - birthDate.getMonth();

        // Adjust age if the birthday hasn't occurred yet this year
        if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    /**
     * Handles changes for all input fields and updates the form state.
     * It automatically calculates the age when the birthdate is changed.
     */
    const handleChange = (e) => {
        const { name, value } = e.target;
        
        setFormData(prevData => {
            const newData = { ...prevData, [name]: value };

            // Special handling for birthdate to auto-calculate age
            if (name === 'birthdate') {
                const age = calculateAge(value);
                newData.age = age >= 0 ? age.toString() : '';
            }
            return newData;
        });
    };

    /**
     * Handles the form submission.
     * It performs validation and passes the final user data to the parent component.
     */
    const handleSubmit = (e) => {
        // Prevent the browser's default form submission behavior
        e.preventDefault(); 

        // Basic validation check
        if (!formData.fullName || !formData.email || !formData.birthdate || !formData.address) {
            alert("Please fill out all required fields.");
            return;
        }

        // Construct the final user object, ensuring age is a number
        const newUser = {
            ...formData,
            age: parseInt(formData.age, 10) || 0
        };
        
        // Pass the prepared data to the onSubmit function from UsersView.js
        onSubmit(newUser);
    };

    return (
        // The overlay allows closing the modal by clicking outside of it
        <div className="modal-overlay" onClick={onClose}>
            {/* stopPropagation prevents the modal from closing when clicking inside it */}
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
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
                        <input name="phone" type="tel" value={formData.phone} onChange={handleChange} />
                    </div>

                    <div className="form-group">
                        <label>Birthdate</label>
                        <input type="date" name="birthdate" value={formData.birthdate} onChange={handleChange} required />
                    </div>

                    <div className="form-group">
                        <label>Age</label>
                        <input name="age" value={formData.age} readOnly disabled />
                    </div>

                    <div className="form-group">
                        <label>Address</label>
                        <input name="address" value={formData.address} onChange={handleChange} required />
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
                    
                    <div className="info-box">
                        📧 The user will receive instructions to complete their registration using the provided email address.
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Add User</button>
                    </div>
                </form>
            </div>
        </div>
    );
}