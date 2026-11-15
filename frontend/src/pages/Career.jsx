import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageHero from "../components/landing/PageHero";
import { MapPin, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';

const Career = () => {
  const [showForm, setShowForm] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState('');
  const [applicant, setApplicant] = useState({ name: '', email: '', phone: '', cvUrl: '' });
  const [submitted, setSubmitted] = useState(false);

  const positions = [
    { title: "Senior Associate Advocate", location: "Lahore", type: "Full-time", experience: "5+ years", dept: "Civil Litigation" },
    { title: "Junior Associate Advocate", location: "Karachi", type: "Full-time", experience: "1-3 years", dept: "Corporate Law" },
    { title: "Legal Research Intern", location: "Islamabad", type: "Internship", experience: "Law Student / LLB", dept: "Constitutional Law" },
    { title: "Pro Bono Aid Coordinator", location: "Lahore", type: "Full-time", experience: "2+ years", dept: "Human Rights" },
    { title: "Legal Tech Engineer", location: "Remote / Hybrid", type: "Full-time", experience: "3+ years", dept: "AI & Platform" },
    { title: "Corporate Counsel", location: "Karachi", type: "Full-time", experience: "7+ years", dept: "Commercial Contracts" }
  ];

  const handleApply = (position) => {
    setSelectedPosition(position.title);
    setShowForm(true);
    setSubmitted(false);
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="ll-user-page">
      <div className="ll-ambient-grid" />
      <Navbar />
      <PageHero
        kicker="Careers"
        accent="Join"
        title="the LegalLink Team"
        text="Help shape legal technology and access to justice across Pakistan."
        icon="briefcase"
      />

      <main className="container position-relative py-5 lx-after-hero" style={{ zIndex: 1 }} data-reveal>
        

        {/* Application Form Drawer */}
        {showForm && (
          <div
            className="ll-glass-card p-4 p-md-5 mb-5"
            style={{
              borderRadius: '24px',
              border: '1px solid var(--ll-brand-gold)',
              boxShadow: 'var(--ll-shadow-3d-hover)',
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom" style={{ borderColor: 'var(--ll-border)' }}>
              <div>
                <h3 style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)", fontWeight: 700, margin: 0, color: 'var(--ll-text-primary)' }}>
                  Applying for: {selectedPosition}
                </h3>
                <small style={{ color: 'var(--ll-text-muted)' }}>Fill in your contact information to submit your dossier</small>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="btn btn-sm btn-outline-secondary"
                style={{ borderRadius: '8px' }}
              >
                ✕ Cancel
              </button>
            </div>

            {submitted ? (
              <div className="text-center py-4">
                <CheckCircle2 size={42} className="text-success mb-2" />
                <h4 style={{ color: 'var(--ll-text-primary)' }}>Application Received</h4>
                <p style={{ color: 'var(--ll-text-muted)' }}>Our talent acquisition team will review your qualifications and contact you shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-bold" style={{ fontSize: '13px', color: 'var(--ll-text-primary)' }}>Full Name</label>
                  <input
                    type="text"
                    required
                    className="ll-input-3d"
                    value={applicant.name}
                    onChange={(e) => setApplicant({ ...applicant, name: e.target.value })}
                    placeholder="Adv. Ahmed Raza"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold" style={{ fontSize: '13px', color: 'var(--ll-text-primary)' }}>Email Address</label>
                  <input
                    type="email"
                    required
                    className="ll-input-3d"
                    value={applicant.email}
                    onChange={(e) => setApplicant({ ...applicant, email: e.target.value })}
                    placeholder="ahmed@example.com"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold" style={{ fontSize: '13px', color: 'var(--ll-text-primary)' }}>Contact Number</label>
                  <input
                    type="tel"
                    required
                    className="ll-input-3d"
                    value={applicant.phone}
                    onChange={(e) => setApplicant({ ...applicant, phone: e.target.value })}
                    placeholder="+92 300 1234567"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold" style={{ fontSize: '13px', color: 'var(--ll-text-primary)' }}>CV / Portfolio Link</label>
                  <input
                    type="url"
                    required
                    className="ll-input-3d"
                    value={applicant.cvUrl}
                    onChange={(e) => setApplicant({ ...applicant, cvUrl: e.target.value })}
                    placeholder="https://linkedin.com/in/... or Google Drive"
                  />
                </div>
                <div className="col-12 mt-3">
                  <button type="submit" className="ll-btn-3d ll-btn-3d-primary">
                    Submit Candidate Dossier
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Positions Grid */}
        <div className="row g-4 ll-perspective-wrap" data-reveal>
          {positions.map((pos, idx) => (
            <div className="col-md-6 col-lg-4" key={idx}>
              <div className="ll-card-3d h-100 p-4 d-flex flex-column justify-content-between">
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <span className="ll-badge-3d ll-badge-gold">{pos.dept}</span>
                    <span className="ll-badge-3d">{pos.type}</span>
                  </div>

                  <h4
                    style={{
                      fontFamily: "var(--font-serif, 'Playfair Display', serif)",
                      fontWeight: 700,
                      color: 'var(--ll-text-primary)',
                      fontSize: '1.2rem',
                      marginBottom: '8px',
                    }}
                  >
                    {pos.title}
                  </h4>

                  <div className="d-flex align-items-center gap-3 mb-3" style={{ fontSize: '13px', color: 'var(--ll-text-muted)' }}>
                    <div className="d-flex align-items-center gap-1">
                      <MapPin size={13} />
                      <span>{pos.location}</span>
                    </div>
                    <div className="d-flex align-items-center gap-1">
                      <Clock size={13} />
                      <span>{pos.experience}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleApply(pos)}
                  className="ll-btn-3d ll-btn-3d-secondary w-100"
                  style={{ borderRadius: '10px' }}
                >
                  <span>Apply for Position</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Career;
