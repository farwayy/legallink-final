import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageHero from "../components/landing/PageHero";
import { ProfileCardSkeleton } from "../components/ui/Skeleton";
import { userAPI } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import {
  Search,
  Filter,
  MapPin,
  Award,
  Star,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Briefcase,
  SlidersHorizontal,
  X,
  Users,
  UserRound
} from 'lucide-react';
import { API_URL } from "../config";

const LawyerListing = () => {
  const [lawyers, setLawyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [minExperience, setMinExperience] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();

  const specializations = [
    'Family Law', 'Criminal Law', 'Property Law', 'Civil Law',
    'Corporate Law', 'Domestic Violence', 'Women Rights', 'Human Rights', 'Tax Law', 'Labor Law', 'Cyber Law'
  ];

  const popularCities = ['All Cities', 'Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Peshawar', 'Quetta', 'Multan'];

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const specParam = params.get('specialization');
    if (specParam) {
      const mappedSpec = {
        'family': 'Family Law',
        'property': 'Property Law', 
        'criminal': 'Criminal Law'
      }[specParam];
      if (mappedSpec) setSelectedSpecialization(mappedSpec);
    }
    fetchLawyers();
  }, [selectedSpecialization, location.search]);

  const fetchLawyers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedSpecialization) params.specialization = selectedSpecialization;
      const response = await userAPI.getLawyers(params);
      setLawyers(response.data.lawyers || []);
    } catch (error) {
      console.error('Error fetching lawyers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLawyers = lawyers.filter(lawyer => {
    const matchesSearch =
      lawyer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lawyer.specialization?.some(spec => spec.toLowerCase().includes(searchTerm.toLowerCase())) ||
      lawyer.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lawyer.bio?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCity = !selectedCity || selectedCity === 'All Cities'
      ? true
      : lawyer.location?.toLowerCase().includes(selectedCity.toLowerCase());

    const matchesExp = !minExperience
      ? true
      : (lawyer.experience || 0) >= Number(minExperience);

    return matchesSearch && matchesCity && matchesExp;
  });

  const getPhotoUrl = (photoPath) => {
    if (!photoPath) return null;
    if (/^(https?:|data:)/i.test(photoPath)) return photoPath;
    const apiUrl = API_URL;
    const serverUrl = apiUrl.replace(/\/api\/?$/, '');
    return `${serverUrl}${photoPath.startsWith('/') ? '' : '/'}${photoPath}`;
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedSpecialization('');
    setSelectedCity('');
    setMinExperience('');
  };

  return (
    <div className="ll-user-page">
      <div className="ll-ambient-grid" />
      <Navbar />
      <PageHero
        kicker="Find an advocate"
        accent="Verified"
        title="Legal Advocates Near You"
        text="Compare Bar Council–licensed advocates by practice area, city, experience and verified client reviews, then send your case directly."
        icon="scale"
      />

      <main className="container position-relative py-5 lx-after-hero" style={{ zIndex: 1 }}>
        

        {/* ========================================================= */}
        {/* 2. 3D SEARCH & FILTER CONTROLS BAR                       */}
        {/* ========================================================= */}
        <div
          className="ll-glass-card p-4 mb-4"
          style={{
            borderRadius: "22px",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #E2E8F0",
          }}
        >
          <div className="row g-3 align-items-center">
            {/* Search Input */}
            <div className="col-lg-5 col-md-12">
              <div className="position-relative">
                <Search
                  size={19}
                  style={{
                    position: "absolute",
                    left: "16px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: isDark ? "#94A3B8" : "#64748B",
                    pointerEvents: "none",
                  }}
                />
                <input
                  type="text"
                  className="ll-input-3d"
                  placeholder="Search by advocate name, specialty, city, keyword..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ paddingLeft: "46px" }}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    style={{
                      position: "absolute",
                      right: "14px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: isDark ? "#94A3B8" : "#64748B",
                      cursor: "pointer",
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Specialization Filter */}
            <div className="col-lg-3 col-md-4">
              <select
                className="ll-input-3d"
                value={selectedSpecialization}
                onChange={(e) => setSelectedSpecialization(e.target.value)}
              >
                <option value="">All Specializations</option>
                {specializations.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            {/* City Filter */}
            <div className="col-lg-2 col-md-4">
              <select
                className="ll-input-3d"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
              >
                {popularCities.map((c) => (
                  <option key={c} value={c === 'All Cities' ? '' : c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Experience Filter */}
            <div className="col-lg-2 col-md-4">
              <select
                className="ll-input-3d"
                value={minExperience}
                onChange={(e) => setMinExperience(e.target.value)}
              >
                <option value="">Any Experience</option>
                <option value="3">3+ Years</option>
                <option value="5">5+ Years</option>
                <option value="10">10+ Years</option>
                <option value="15">15+ Years</option>
              </select>
            </div>
          </div>

          {/* Quick Specialization Chips */}
          <div className="d-flex gap-2 flex-wrap align-items-center mt-3 pt-3 border-top" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0" }}>
            <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ll-text-muted)" }}>
              Quick Filter:
            </span>
            {specializations.slice(0, 6).map((spec) => {
              const isSelected = selectedSpecialization === spec;
              return (
                <button
                  key={spec}
                  onClick={() => setSelectedSpecialization(isSelected ? '' : spec)}
                  className="ll-badge-3d"
                  style={{
                    cursor: "pointer",
                    background: isSelected
                      ? isDark ? "#D4AF37" : "#1E3F2E"
                      : "transparent",
                    color: isSelected
                      ? isDark ? "#0A0E17" : "#FFFFFF"
                      : "var(--ll-text-secondary)",
                    borderColor: isSelected
                      ? isDark ? "#D4AF37" : "#1E3F2E"
                      : "var(--ll-border)",
                    fontWeight: isSelected ? 700 : 500,
                  }}
                >
                  {spec}
                </button>
              );
            })}
            {(searchTerm || selectedSpecialization || selectedCity || minExperience) && (
              <button
                onClick={clearFilters}
                className="btn btn-sm btn-link ms-auto text-decoration-none"
                style={{ color: isDark ? "#D4AF37" : "#DC2626", fontSize: "13px", fontWeight: 600 }}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. RESULTS STATUS BAR                                     */}
        {/* ========================================================= */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center gap-2">
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: isDark ? "#D4AF37" : "#1E3F2E",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--ll-text-secondary)" }}>
              {loading ? 'Finding verified advocates…' : `Showing ${filteredLawyers.length} Verified ${filteredLawyers.length === 1 ? 'Advocate' : 'Advocates'}`}
            </span>
          </div>
          <span className="ll-directory-verification-note" style={{ fontSize: "12.5px", color: "var(--ll-text-muted)" }}>
            <ShieldCheck size={14} />
            <span>Bar Council verification active</span>
          </span>
        </div>

        {/* ========================================================= */}
        {/* 4. LAWYERS GRID (3D PERSPECTIVE CARDS)                    */}
        {/* ========================================================= */}
        {loading ? (
          <div className="row g-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div className="col-md-6 col-lg-4" key={n}>
                <ProfileCardSkeleton />
              </div>
            ))}
          </div>
        ) : filteredLawyers.length === 0 ? (
          <div
            className="ll-glass-card text-center py-5 px-4 my-4"
            style={{ borderRadius: "24px" }}
          >
            <div
              style={{
                width: "68px",
                height: "68px",
                borderRadius: "50%",
                background: isDark ? "rgba(212, 175, 55, 0.15)" : "#FEF9C3",
                color: isDark ? "#D4AF37" : "#B48216",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <Users size={32} />
            </div>
            <h3 style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)", color: "var(--ll-text-primary)" }}>
              No Advocates Match Your Search
            </h3>
            <p style={{ color: "var(--ll-text-muted)", maxWidth: "420px", margin: "0 auto 20px" }}>
              We could not find advocates matching your current query. Try adjusting your filters or clearing search criteria.
            </p>
            <button onClick={clearFilters} className="ll-btn-3d ll-btn-3d-primary">
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="row g-4 ll-perspective-wrap" data-reveal>
            {filteredLawyers.map((lawyer) => {
              const photoUrl = getPhotoUrl(lawyer.photo);
              return (
                <div className="col-md-6 col-lg-4" key={lawyer._id}>
                  <div
                    className="ll-card-3d h-100 d-flex flex-column justify-content-between p-4"
                    onClick={() => navigate(`/lawyer/${lawyer._id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <div>
                      {/* Top Header of Card: Avatar & Verified Badge */}
                      <div className="d-flex align-items-start justify-content-between mb-3">
                        <div className="ll-avatar-3d-ring">
                          <div className="ll-avatar-inner ll-lawyer-directory-avatar">
                            {photoUrl && (
                              <img
                                src={photoUrl}
                                alt={`${lawyer.name} profile`}
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                  event.currentTarget.nextElementSibling?.classList.add("is-visible");
                                }}
                              />
                            )}
                            <div className={`ll-lawyer-avatar-placeholder${photoUrl ? "" : " is-visible"}`} aria-hidden="true">
                              <UserRound size={30} strokeWidth={1.6} />
                            </div>
                          </div>
                        </div>

                        <span
                          className="ll-badge-3d ll-badge-green"
                          style={{ fontSize: "11px", textTransform: "uppercase" }}
                        >
                          <ShieldCheck size={13} />
                          Verified
                        </span>
                      </div>

                      {/* Name & Location */}
                      <h4
                        style={{
                          fontFamily: "var(--font-serif, 'Playfair Display', serif)",
                          fontWeight: 700,
                          fontSize: "1.25rem",
                          color: "var(--ll-text-primary)",
                          marginBottom: "4px",
                        }}
                      >
                        {lawyer.name}
                      </h4>

                      <div
                        className="d-flex align-items-center gap-1 mb-3"
                        style={{ fontSize: "13px", color: "var(--ll-text-muted)" }}
                      >
                        <MapPin size={13} />
                        <span>{lawyer.location || "High Court Bar, Pakistan"}</span>
                      </div>

                      {/* Specialization Tags */}
                      <div className="d-flex flex-wrap gap-1 mb-3">
                        {lawyer.specialization?.slice(0, 3).map((spec, idx) => (
                          <span
                            key={idx}
                            className="ll-badge-3d"
                            style={{ fontSize: "11.5px", padding: "3px 9px" }}
                          >
                            {spec}
                          </span>
                        ))}
                      </div>

                      {/* Brief Bio Snippet */}
                      {lawyer.bio && (
                        <p
                          style={{
                            fontSize: "13px",
                            color: "var(--ll-text-secondary)",
                            lineHeight: 1.5,
                            marginBottom: "16px",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {lawyer.bio}
                        </p>
                      )}
                    </div>

                    {/* Card Footer: Metrics & CTA */}
                    <div>
                      <div
                        className="d-flex justify-content-between align-items-center py-2 px-3 mb-3"
                        style={{
                          background: isDark ? "rgba(0, 0, 0, 0.25)" : "rgba(241, 245, 249, 0.7)",
                          borderRadius: "12px",
                          border: isDark ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid #E2E8F0",
                        }}
                      >
                        <div className="d-flex align-items-center gap-1" style={{ fontSize: "13px", fontWeight: 600 }}>
                          <Briefcase size={14} style={{ color: isDark ? "#D4AF37" : "#1E3F2E" }} />
                          <span style={{ color: "var(--ll-text-primary)" }}>{lawyer.experience || 0}+ yrs</span>
                        </div>

                        <div className="d-flex align-items-center gap-1" style={{ fontSize: "13px", fontWeight: 700 }}>
                          <Star size={14} style={{ fill: "#F59E0B", color: "#F59E0B" }} />
                          <span style={{ color: "var(--ll-text-primary)" }}>
                            {Number(lawyer.rating || 5.0).toFixed(1)}
                          </span>
                          <span style={{ color: "var(--ll-text-muted)", fontSize: "11.5px", fontWeight: 500 }}>
                            ({lawyer.totalReviews ?? lawyer.reviewsCount ?? 0})
                          </span>
                        </div>
                      </div>

                      <button
                        className="ll-btn-3d ll-btn-3d-primary w-100"
                        style={{ borderRadius: "12px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/lawyer/${lawyer._id}`);
                        }}
                      >
                        <span>View Profile & Retainer</span>
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default LawyerListing;
