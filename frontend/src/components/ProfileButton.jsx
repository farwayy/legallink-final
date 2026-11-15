import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../services/api';
import { User, Phone, CreditCard, Calendar, LogOut, ExternalLink } from 'lucide-react';

const ProfileButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const dropdownRef = useRef(null);
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();

  // ONLY show on homepage
  const isHomePage = location.pathname === '/';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'user' && isHomePage) {
      const fetchProfile = async () => {
        try {
          const response = await userAPI.getProfile();
          setProfile(response.data);
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      };
      fetchProfile();
    }
  }, [isAuthenticated, user, isHomePage]);

  // Don't show on non-homepage
  if (!isHomePage) {
    return null;
  }

  // Don't show if not logged in
  if (!isAuthenticated) {
    return null;
  }

  // For users - profile button at bottom right
  return (
    <div ref={dropdownRef} style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 999 }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          backgroundColor: '#404d4e',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.15)'
        }}
      >
        <User size={20} />
      </button>
      
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '60px',
          right: '0',
          width: '300px',
          backgroundColor: '#fff',
          borderRadius: '12px',
          boxShadow: '0 5px 20px rgba(0,0,0,0.15)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '15px', backgroundColor: '#1E3F2E', color: '#fff' }}>
            <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{profile?.name || user?.name}</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>{profile?.email || user?.email}</div>
          </div>
          
          <div style={{ padding: '15px', borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ marginBottom: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Phone size={14} color="#1E3F2E" />
              <strong>Phone:</strong> <span>{profile?.phone || 'Not provided'}</span>
            </div>
            <div style={{ marginBottom: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CreditCard size={14} color="#1E3F2E" />
              <strong>CNIC:</strong> <span>{profile?.cnic || 'Not provided'}</span>
            </div>
            <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} color="#1E3F2E" />
              <strong>Member Since:</strong> <span>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}</span>
            </div>
          </div>
          
          <div style={{ padding: '10px 15px' }}>
            <Link to="/user/profile" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', textDecoration: 'none', color: '#1E3F2E', fontWeight: '500' }} onClick={() => setIsOpen(false)}>
              <ExternalLink size={15} />
              <span>View Full Profile</span>
            </Link>
            <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 0', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: '#dc3545', fontWeight: '500' }}>
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileButton;