import React from 'react';
import './modalstyles/RequestModalStyles.css';

const RequestModal = ({ show, onClose, onSubmit, newRequest, setNewRequest, isEditMode }) => {
  if (!show) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewRequest(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container">
        <h2>{isEditMode ? 'Edit Request' : 'Create Request'}</h2>
        <form onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}>
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              name="title"
              value={newRequest.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Type</label>
            <select
              name="type"
              value={newRequest.type}
              onChange={handleChange}
              required
            >
              <option value="">Select Type</option>
              <option value="Training">Training</option>
              <option value="Equipment">Equipment</option>
              <option value="Medical Supply">Medical Supply</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              rows="4"
              value={newRequest.description}
              onChange={handleChange}
              required
            ></textarea>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              {isEditMode ? 'Update' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RequestModal;
