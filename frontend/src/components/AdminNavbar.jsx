import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const AdminNavbar = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    navigate('/admin/login');
  };

  return (
    <nav style={{ backgroundColor: "#1c1c28", padding: "15px 0" }}>
      <div className="container">
        <div className="d-flex justify-content-between align-items-center">
          {/* Logo */}
          <Link to="/admin/dashboard" className="d-flex align-items-center text-decoration-none">
            <img
              src="/images/logo.png"
              alt="LegalLink Logo"
              style={{ width: '50px', height: '50px', objectFit: 'contain' }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
            <span
              style={{
                display: 'none',
                fontSize: '22px',
                fontWeight: 'bold',
                color: '#3B5e3B',
                fontFamily: 'Marcellus, serif'
              }}
            >
              LegalLink
            </span>
          </Link>
          <div className="d-flex gap-3">
            <Link to="/admin/dashboard" style={{ color: "#fff", textDecoration: "none" }}>Dashboard</Link>
            <Link to="/admin/lawyers" style={{ color: "#fff", textDecoration: "none" }}>Lawyers</Link>
            <Link to="/admin/ngos" style={{ color: "#fff", textDecoration: "none" }}>NGOs</Link>
            <Link to="/admin/users" style={{ color: "#fff", textDecoration: "none" }}>Users</Link>
            <button onClick={handleLogout} style={{ backgroundColor: "transparent", border: "1px solid #D4AF37", color: "#D4AF37", padding: "5px 15px", cursor: "pointer", borderRadius: "4px" }}>
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default AdminNavbar;