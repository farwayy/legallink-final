import React, { useState, useEffect } from 'react';
import { ProfilePageSkeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { userAPI } from '../../services/api';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import ProfileButton from '../../components/ProfileButton';
import axios from 'axios';
import {
  Briefcase,
  Phone,
  MapPin,
  Calendar,
  Edit3,
  Save,
  X,
  Scale,
  Camera,
  Mail,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  PlusCircle,
  Building2,
  UserRound
} from 'lucide-react';
import '../../styles/counselPortal.css';
import { API_URL, API_ORIGIN } from "../../config";

// Read-only value, or the input in edit mode (outside the component so inputs keep focus)
const Field = ({ label, value, editing, children }) => (
  <div className={`cp-field${editing && children ? ' is-editing' : ''}`}>
    <span className="cp-field-label">{label}</span>
    {editing && children ? children : (
      <span className={`cp-field-value${value ? '' : ' is-empty'}`}>{value || 'Not provided'}</span>
    )}
  </div>
);

const UserProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3500);
  };
  const [editForm, setEditForm] = useState({
    phone: '',
    cnic: '',
    address: ''
  });

  useEffect(() => {
    fetchProfileAndCases();
  }, []);

  const fetchProfileAndCases = async () => {
    try {
      console.log("Fetching user profile and cases...");
      const [profileRes, casesRes] = await Promise.all([
        userAPI.getProfile(),
        userAPI.getCases()
      ]);
      console.log("Profile data:", profileRes.data);
      console.log("Cases data:", casesRes.data);
      setProfile(profileRes.data);
      setCases(casesRes.data.cases || []);
      setEditForm({
        phone: profileRes.data?.phone || '',
        cnic: profileRes.data?.cnic || '',
        address: profileRes.data?.address || ''
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditChange = (e) => {
    setEditForm({
      ...editForm,
      [e.target.name]: e.target.value
    });
  };

  const handleUpdateProfile = async () => {
    setUpdating(true);
    try {
      await userAPI.updateProfile(editForm);
      setProfile({ ...profile, ...editForm });
      setIsEditing(false);
      showToast('Profile updated.');
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast(error.response?.data?.message || "Couldn't update your profile.", 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      showToast('Please upload a JPG or PNG image.', 'error');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showToast('The photo must be smaller than 2 MB.', 'error');
      return;
    }

    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/users/upload-photo`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setProfile({ ...profile, photo: response.data.photoUrl });
        showToast('Profile photo updated.');
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      showToast("Couldn't upload the photo. Please try again.", 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const getPhotoUrl = (photoPath) => {
    if (!photoPath) return null;
    if (photoPath.startsWith('http')) return photoPath;
    return `${API_ORIGIN}${photoPath}`;
  };

  const STATUS = {
    pending: { tone: 'is-warn', text: 'Pending' },
    under_review: { tone: 'is-info', text: 'Under review' },
    assigned: { tone: 'is-info', text: 'Assigned' },
    in_progress: { tone: 'is-ok', text: 'In progress' },
    resolved: { tone: 'is-ok', text: 'Resolved' },
    rejected: { tone: 'is-danger', text: 'Rejected' }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not available';
    try {
      return new Date(dateString).toLocaleDateString('en-PK', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return 'Not available';
    }
  };

  if (loading) {
    return (
      <div className="cp-page citizen-portal">
        <Navbar />
        <ProfilePageSkeleton />
      </div>
    );
  }

  const name = profile?.name || user?.name || 'Citizen';
  const email = profile?.email || user?.email;
  const photo = getPhotoUrl(profile?.photo);
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const activeCount = cases.filter((c) => ['assigned', 'in_progress', 'under_review'].includes(c.status)).length;
  const resolvedCount = cases.filter((c) => c.status === 'resolved').length;
  const city = profile?.city || (profile?.address ? profile.address.split(',').pop().trim() : '');

  return (
    <div className="cp-page citizen-portal page-fade">
      <Navbar />
      <ProfileButton />

      {toast.msg && (
        <div className={`cp-toast${toast.type === 'error' ? ' is-error' : ''}`} role="status">
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* ── Identity banner ── */}
      <section className="cp-hero is-compact cp-profile-hero ll-on-dark">
        <div className="cp-hero-inner">
          <div className="cp-hero-main">
            <div className="cp-identity">
              <label className="cp-identity-photo citizen-photo" title="Change photo">
                {photo ? <img src={photo} alt={name} /> : initials}
                <span className="citizen-photo-edit">{uploadingPhoto ? '…' : <Camera size={15} />}</span>
                <input type="file" accept="image/jpeg,image/png" onChange={handlePhotoUpload} disabled={uploadingPhoto} hidden />
              </label>
              <div className="cp-identity-text">
                <span className="cp-chip"><UserRound size={13} strokeWidth={2.2} /> Citizen account</span>
                <h1 className="cp-hero-title"><span>{name}</span></h1>
                <div className="cp-identity-meta">
                  {email && <span><Mail size={14} /> {email}</span>}
                  {profile?.phone && <span><Phone size={14} /> {profile.phone}</span>}
                  {city && <span><MapPin size={14} /> {city}</span>}
                </div>
              </div>
            </div>
          </div>
          <div className="cp-hero-side">
            {!isEditing ? (
              <button type="button" className="cp-btn-gold" onClick={() => setIsEditing(true)}>
                <Edit3 size={16} /> Edit profile
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="cp-btn-ghost"
                  onClick={() => {
                    setIsEditing(false);
                    setEditForm({ phone: profile?.phone || '', cnic: profile?.cnic || '', address: profile?.address || '' });
                  }}
                >
                  <X size={16} /> Cancel
                </button>
                <button type="button" className="cp-btn-gold" onClick={handleUpdateProfile} disabled={updating}>
                  <Save size={16} /> {updating ? <><span className="btn-spinner" />Saving…</> : 'Save changes'}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="cp-main citizen-main">
        <section className="cp-stats" aria-label="Your account at a glance">
          <div className="cp-stat">
            <div className="cp-stat-head">
              <span className="cp-icon-tile"><Briefcase size={20} strokeWidth={1.8} /></span>
              <span className="cp-stat-label">Cases filed</span>
            </div>
            <div className="cp-stat-row"><span className="cp-stat-value">{cases.length}</span><span className="cp-stat-note">All time</span></div>
          </div>
          <div className="cp-stat">
            <div className="cp-stat-head">
              <span className="cp-icon-tile"><Clock size={20} strokeWidth={1.8} /></span>
              <span className="cp-stat-label">Active</span>
            </div>
            <div className="cp-stat-row"><span className="cp-stat-value">{activeCount}</span><span className="cp-stat-note">With counsel</span></div>
          </div>
          <div className="cp-stat">
            <div className="cp-stat-head">
              <span className="cp-icon-tile"><CheckCircle2 size={20} strokeWidth={1.8} /></span>
              <span className="cp-stat-label">Resolved</span>
            </div>
            <div className="cp-stat-row"><span className="cp-stat-value">{resolvedCount}</span><span className="cp-stat-note">Concluded</span></div>
          </div>
          <div className="cp-stat">
            <div className="cp-stat-head">
              <span className="cp-icon-tile"><Calendar size={20} strokeWidth={1.8} /></span>
              <span className="cp-stat-label">Member since</span>
            </div>
            <div className="cp-stat-row">
              <span className="cp-stat-value" style={{ fontSize: 22 }}>
                {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-PK', { month: 'short', year: 'numeric' }) : '—'}
              </span>
            </div>
          </div>
        </section>

        <div className="cp-layout">
          <div className="pub-col">
            <section className="cp-card cp-card-pad">
              <div className="cp-card-head">
                <h2 className="cp-section-title" style={{ fontSize: 19 }}>Personal information</h2>
                {!isEditing && (
                  <button type="button" className="cp-btn-outline is-small" onClick={() => setIsEditing(true)}>
                    <Edit3 size={14} /> Edit
                  </button>
                )}
              </div>
              <div className="cp-field-grid">
                <Field editing={isEditing} label="Full name" value={name} />
                <Field editing={isEditing} label="Email" value={email} />
                <Field editing={isEditing} label="Phone" value={profile?.phone}>
                  <input className="cp-input" name="phone" value={editForm.phone} onChange={handleEditChange} placeholder="+92 3xx xxxxxxx" />
                </Field>
                <Field editing={isEditing} label="CNIC" value={profile?.cnic}>
                  <input className="cp-input" name="cnic" value={editForm.cnic} onChange={handleEditChange} placeholder="35201-1234567-1" />
                </Field>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Field editing={isEditing} label="Address" value={profile?.address}>
                    <input className="cp-input" name="address" value={editForm.address} onChange={handleEditChange} placeholder="House, street, city" />
                  </Field>
                </div>
              </div>
            </section>

            <section className="cp-card cp-card-pad">
              <div className="cp-card-head">
                <div>
                  <h2 className="cp-section-title" style={{ fontSize: 19 }}>My cases</h2>
                  <span className="cp-section-sub">Open a case to see hearings, documents and messages</span>
                </div>
                <Link to="/user/dashboard" className="cp-btn-outline is-small" style={{ textDecoration: 'none' }}>Dashboard</Link>
              </div>
              {cases.length === 0 ? (
                <div className="cp-empty" style={{ padding: '28px 20px' }}>
                  <span className="cp-empty-icon"><Scale size={24} strokeWidth={1.8} /></span>
                  <strong>No cases yet</strong>
                  <p>Submit a legal matter from your dashboard, or contact a verified advocate.</p>
                  <Link to="/user/dashboard" className="cp-btn-primary" style={{ textDecoration: 'none' }}><PlusCircle size={15} /> Submit a case</Link>
                </div>
              ) : (
                <ul className="citizen-case-list">
                  {cases.map((c) => {
                    const st = STATUS[c.status] || { tone: 'is-neutral', text: c.status || 'Open' };
                    const counsel = c.lawyerId?.name || c.ngoId?.name;
                    return (
                      <li key={c._id}>
                        <Link to={`/case/${c._id}`} className="citizen-case">
                          <span className="cp-icon-tile">{c.ngoId ? <Building2 size={18} strokeWidth={1.8} /> : <Scale size={18} strokeWidth={1.8} />}</span>
                          <span className="citizen-case-main">
                            <strong>{c.title}</strong>
                            <small>
                              {c.category || 'General'}
                              {counsel ? ` · ${counsel}` : ' · Awaiting counsel'}
                              {c.createdAt ? ` · Filed ${formatDate(c.createdAt)}` : ''}
                            </small>
                          </span>
                          <span className={`cp-pill ${st.tone}`}>{st.text}</span>
                          <ChevronRight size={18} className="citizen-case-arrow" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <aside className="cp-aside">
            <section className="cp-card cp-card-pad">
              <h2 className="cp-card-title">Get legal help</h2>
              <Link to="/lawyers" className="cp-action"><span className="cp-icon-tile"><Briefcase size={17} strokeWidth={1.8} /></span><span className="cp-action-label">Find a verified advocate</span><span className="cp-action-chevron"><ChevronRight size={16} /></span></Link>
              <Link to="/ngos" className="cp-action"><span className="cp-icon-tile"><Building2 size={17} strokeWidth={1.8} /></span><span className="cp-action-label">Request free legal aid</span><span className="cp-action-chevron"><ChevronRight size={16} /></span></Link>
              <Link to="/chatbot" className="cp-action"><span className="cp-icon-tile"><Scale size={17} strokeWidth={1.8} /></span><span className="cp-action-label">Ask the AI assistant</span><span className="cp-action-chevron"><ChevronRight size={16} /></span></Link>
            </section>
            <section className="cp-card cp-card-pad">
              <h2 className="cp-card-title">Account</h2>
              <dl className="cp-dl">
                <div className="cp-dl-row"><dt>Account type</dt><dd>Citizen</dd></div>
                <div className="cp-dl-row"><dt>Email</dt><dd>{email}</dd></div>
                <div className="cp-dl-row"><dt>Joined</dt><dd>{formatDate(profile?.createdAt)}</dd></div>
              </dl>
            </section>
          </aside>
        </div>
      </div>
      <Footer showCta={false} />
    </div>
  );
};

export default UserProfile;
