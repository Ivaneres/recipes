/**
 * Shared styles for consistent theming across the application
 */

export const sharedStyles = `
  .action-button {
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 500;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
    border: none;
    cursor: pointer;
    box-sizing: border-box;
  }
  .action-button-primary {
    background: #007bff;
    color: white;
  }
  .action-button-primary:hover {
    background: #0056b3;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
  }
  .action-button-secondary {
    background: #f8f9fa;
    color: #213547;
    border: 1px solid #e0e0e0;
  }
  .action-button-secondary:hover {
    background: #e9ecef;
    border-color: #d0d0d0;
  }
  .action-button-danger {
    background: #dc3545;
    color: white;
  }
  .action-button-danger:hover {
    background: #c82333;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
  }
  .action-button-success {
    background: #28a745;
    color: white;
  }
  .action-button-success:hover {
    background: #218838;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
  }
  .form-input {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-size: 1rem;
    transition: all 0.2s;
    box-sizing: border-box;
  }
  .form-input:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }
  .form-label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: #213547;
    font-size: 0.95rem;
  }
  .form-group {
    margin-bottom: 20px;
  }
  .card {
    background: white;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
  .page-container {
    padding: 40px 20px;
    max-width: 1200px;
    margin: 0 auto;
    color: #213547;
  }
  .page-header {
    margin-bottom: 32px;
  }
  .page-title {
    font-size: 2.5rem;
    font-weight: 700;
    color: #213547;
    margin: 0 0 8px 0;
  }
  .page-subtitle {
    color: #666;
    margin: 0;
    font-size: 1.1rem;
  }
  .tag {
    display: inline-block;
    padding: 6px 12px;
    margin-right: 8px;
    margin-bottom: 8px;
    background-color: #e9ecef;
    color: #213547;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .alert {
    padding: 16px 20px;
    border-radius: 8px;
    margin-bottom: 20px;
  }
  .alert-error {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }
  .alert-success {
    background-color: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }
  .alert-info {
    background-color: #d1ecf1;
    color: #0c5460;
    border: 1px solid #bee5eb;
  }
`;
