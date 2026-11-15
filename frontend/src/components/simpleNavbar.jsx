import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const SimpleNavbar = () => {
  

  return (
    <>
      {/* Top Bar - Olive */}
      <div style={{ 
        backgroundColor: '#3B5e3B', 
        padding: '8px 0',
        color: '#fff',
        fontSize: '13px'
      }}>
        
      </div>

      {/* Main Navbar - White with Olive accents */}
      <nav style={{ 
        backgroundColor: '#fff', 
        padding: '15px 0',
        borderBottom: '3px solid #3B5e3B',
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
      }}>
        <div className="container">
          <div className="d-flex justify-content-between align-items-center">
            
            {/* Logo */}
            <Link to="/" className="d-flex align-items-center text-decoration-none gap-2">
              <img 
                src="/images/legallink-logo1.png" 
                alt="LegalLink Logo"
                style={{ height: '40px', width: 'auto', objectFit: 'contain' }}
              />
              <span 
                className="brand-signature"
                style={{ 
                  fontSize: '30px', 
                  fontWeight: '400', 
                  color: '#1E3F2E',
                  fontFamily: "'Great Vibes', 'Alex Brush', cursive",
                  lineHeight: 1
                }}
              >
                LegalLink
              </span>
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
};

export default SimpleNavbar;