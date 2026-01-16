// src/components/ConfirmDialog.jsx (The final, memoized, and high-performance version)

import React from 'react';
import '../styles/ConfirmDialog.css';

// ✨ 1. 導入 React.memo ✨
const ConfirmDialog = React.memo(({ isOpen, title, message, onConfirm, onCancel }) => {
  // 如果 isOpen 為 false，則不渲染任何內容
  if (!isOpen) {
    return null;
  }

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-actions">
          <button onClick={onConfirm}>Confirm</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
});

export default ConfirmDialog;
