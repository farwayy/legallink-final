import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ngoAPI } from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import PageHero from "../components/landing/PageHero";
import { ProfileCardSkeleton } from "../components/ui/Skeleton";

const FOCUS_OPTIONS = [
  "All Areas",
  "Human Rights",
  "Domestic Violence",
  "Child Protection",
  "Labor Rights",
  "Prisoner Aid",
  "Women Rights",
  "Refugee Rights",
  "Environmental Law",
  "Disability Rights"
];

const PAKISTAN_CITIES = [
  "All Cities",
  "Karachi",
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Hyderabad",
  "Sialkot",
  "Gujranwala"
];

const NGODirectory = () => {
  const [ngos, setNgos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("All Cities");
  const [focusArea, setFocusArea] = useState("All Areas");

  const fetchNGOs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (keyword.trim()) params.keyword = keyword.trim();
      if (city !== "All Cities") params.city = city;
      if (focusArea !== "All Areas") params.focusArea = focusArea;

      const res = await ngoAPI.getDirectory(params);
      setNgos(res.data.ngos || []);
    } catch (e) {
      console.error("Failed to load NGO directory:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNGOs();
  }, [city, focusArea]); // eslint-disable-line

  const handleSearch = (e) => {
    e.preventDefault();
    fetchNGOs();
  };

  return (
    <>
      <Navbar />
      <style>{`
        .ngo-dir-page {
          background-color: #f8f9fa;
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
          color: #1f2937;
        }

        /* ── Hero Banner ── */
        .ngo-dir-hero {
          background: transparent;
          padding: 0 20px 40px;
          text-align: center;
          position: relative;
        }
        .ngo-dir-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #ecfdf5;
          color: #065f46;
          border: 1px solid #a7f3d0;
          font-size: 0.76rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 5px 14px;
          border-radius: 20px;
          margin-bottom: 18px;
        }
        .ngo-dir-title {
          font-family: 'Marcellus', Georgia, serif;
          font-size: clamp(2rem, 4vw, 2.8rem);
          font-weight: 700;
          color: #0c1333;
          margin-bottom: 12px;
          letter-spacing: -0.01em;
        }
        .ngo-dir-subtitle {
          font-size: 1.05rem;
          color: #4b5563;
          max-width: 660px;
          margin: 0 auto 36px;
          line-height: 1.6;
        }

        /* ── Filter Bar ── */
        .ngo-filter-card {
          max-width: 960px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 16px 20px;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
        }
        .ngo-filter-form {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
        }
        .ngo-search-input {
          flex: 2;
          min-width: 220px;
          padding: 10px 16px;
          font-size: 0.9rem;
          color: #111827;
          background: #f9fafb;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          outline: none;
          transition: all 0.2s;
        }
        .ngo-search-input:focus {
          background: #ffffff;
          border-color: #0A3622;
          box-shadow: 0 0 0 3px rgba(10, 54, 34, 0.1);
        }
        .ngo-filter-select {
          flex: 1;
          min-width: 170px;
          padding: 10px 14px;
          font-size: 0.88rem;
          color: #374151;
          background: #f9fafb;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          outline: none;
          cursor: pointer;
          transition: all 0.2s;
        }
        .ngo-filter-select:focus {
          background: #ffffff;
          border-color: #0A3622;
        }
        .ngo-search-btn {
          background: #0A3622;
          border: 1px solid #0A3622;
          color: #ffffff;
          padding: 10px 22px;
          font-size: 0.88rem;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .ngo-search-btn:hover {
          background: #072618;
          border-color: #072618;
        }

        /* ── Results Container ── */
        .ngo-results-section {
          max-width: 1180px;
          margin: 40px auto 80px;
          padding: 0 20px;
        }
        .ngo-results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .ngo-results-count {
          font-size: 0.95rem;
          color: var(--ll-text-secondary);
        }
        .ngo-results-count strong {
          color: var(--ll-text-primary);
        }

        /* ── NGO Cards Grid ── */
        .ngo-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
          gap: 24px;
        }
        .ngo-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 24px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .ngo-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
          border-color: #d1d5db;
        }
        .ngo-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }
        .ngo-card-name {
          font-family: 'Marcellus', Georgia, serif;
          font-size: 1.28rem;
          font-weight: 700;
          color: #0c1333;
          line-height: 1.3;
          margin: 0;
        }
        .ngo-verified-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 4px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .ngo-card-loc {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.82rem;
          color: #6b7280;
          margin-bottom: 14px;
        }
        .ngo-card-bio {
          font-size: 0.88rem;
          color: #4b5563;
          line-height: 1.5;
          margin-bottom: 16px;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ngo-pill-container {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 20px;
        }
        .ngo-tag {
          font-size: 0.72rem;
          font-weight: 600;
          background: #f0fdf4;
          color: #0A3622;
          border: 1px solid #dcfce7;
          padding: 3px 8px;
          border-radius: 4px;
        }
        .ngo-card-footer {
          border-top: 1px solid #f3f4f6;
          padding-top: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .ngo-card-hours {
          font-size: 0.78rem;
          color: #6b7280;
        }
        .ngo-view-btn {
          background: #0A3622;
          color: #ffffff;
          padding: 8px 18px;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          text-decoration: none;
          transition: background 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .ngo-view-btn:hover {
          background: #072618;
          color: #ffffff;
        }

        /* ── Empty State ── */
        .ngo-empty-state {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 60px 20px;
          text-align: center;
          max-width: 600px;
          margin: 0 auto;
        }
        .ngo-empty-icon {
          font-size: 48px;
          color: #6b7280;
          margin-bottom: 16px;
        }
        .ngo-empty-title {
          font-family: 'Marcellus', Georgia, serif;
          font-size: 1.4rem;
          color: #0c1333;
          margin-bottom: 8px;
        }
        .ngo-empty-text {
          font-size: 0.9rem;
          color: #6b7280;
          margin-bottom: 20px;
        }

        /* 3D Animations & Transitions */
        .ngo-card {
          transition: transform 0.35s cubic-bezier(0.165, 0.84, 0.44, 1), box-shadow 0.35s ease, border-color 0.3s ease;
          transform-style: preserve-3d;
          border-radius: 18px !important;
        }
        .ngo-card:hover {
          transform: translateY(-8px) rotateX(1.8deg) scale(1.015);
          box-shadow: var(--ll-shadow-3d-hover) !important;
          border-color: var(--ll-brand-gold) !important;
        }
        .ngo-filter-card {
          border-radius: 18px !important;
          box-shadow: var(--ll-shadow-3d) !important;
          transition: all 0.3s ease;
        }

        /* Dark Mode Overrides */
        html.dark .ngo-dir-page, [data-theme="dark"] .ngo-dir-page {
          background-color: var(--ll-bg-page) !important;
          color: var(--ll-text-primary) !important;
        }
        html.dark .ngo-dir-hero, [data-theme="dark"] .ngo-dir-hero {
          background: transparent !important;
        }
        html.dark .ngo-dir-title, [data-theme="dark"] .ngo-dir-title {
          color: var(--ll-text-primary) !important;
        }
        html.dark .ngo-dir-subtitle, [data-theme="dark"] .ngo-dir-subtitle {
          color: var(--ll-text-secondary) !important;
        }
        html.dark .ngo-filter-card, [data-theme="dark"] .ngo-filter-card {
          background: var(--ll-bg-card) !important;
          border-color: var(--ll-border) !important;
        }
        html.dark .ngo-search-input, [data-theme="dark"] .ngo-search-input,
        html.dark .ngo-filter-select, [data-theme="dark"] .ngo-filter-select {
          background: var(--ll-bg-input) !important;
          color: var(--ll-text-primary) !important;
          border-color: var(--ll-border) !important;
        }
        html.dark .ngo-card, [data-theme="dark"] .ngo-card {
          background: var(--ll-bg-card) !important;
          border-color: var(--ll-border) !important;
          color: var(--ll-text-primary) !important;
        }
        html.dark .ngo-card-name, [data-theme="dark"] .ngo-card-name {
          color: var(--ll-text-primary) !important;
        }
        html.dark .ngo-card-bio, [data-theme="dark"] .ngo-card-bio {
          color: var(--ll-text-secondary) !important;
        }
        html.dark .ngo-card-footer, [data-theme="dark"] .ngo-card-footer {
          border-color: var(--ll-border) !important;
        }
        html.dark .ngo-empty-state, [data-theme="dark"] .ngo-empty-state {
          background: var(--ll-bg-card) !important;
          border-color: var(--ll-border) !important;
        }
        html.dark .ngo-empty-title, [data-theme="dark"] .ngo-empty-title {
          color: var(--ll-text-primary) !important;
        }
        html.dark .ngo-tag, [data-theme="dark"] .ngo-tag {
          background: rgba(111, 191, 149, 0.12) !important;
          color: #8FD3AE !important;
          border-color: rgba(111, 191, 149, 0.3) !important;
        }
        html.dark .ngo-search-btn, [data-theme="dark"] .ngo-search-btn,
        html.dark .ngo-view-btn, [data-theme="dark"] .ngo-view-btn {
          background: linear-gradient(135deg, #E2C15A, #C9A23A) !important;
          border-color: #C9A23A !important;
          color: #0A1A13 !important;
          font-weight: 700;
        }
        html.dark .ngo-search-btn:hover, [data-theme="dark"] .ngo-search-btn:hover,
        html.dark .ngo-view-btn:hover, [data-theme="dark"] .ngo-view-btn:hover {
          background: #E2C15A !important;
        }
      `}</style>

      <PageHero
        kicker="National legal aid directory"
        accent="Free"
        title="Legal Aid Organisations"
        text="Accredited NGOs offering pro bono representation, mediation and human rights support for those who can't afford a lawyer — women, children and vulnerable groups across Pakistan."
        icon="heart"
      />
      <div className="ngo-dir-page">
        {/* Filter bar overlaps the green header */}
        <section className="ngo-dir-hero lx-after-hero">
          {/* Filter Bar */}
          <div className="ngo-filter-card">
            <form className="ngo-filter-form" onSubmit={handleSearch}>
              <input
                type="text"
                className="ngo-search-input"
                placeholder="Search by NGO name, keywords, or legal specialty..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />

              <select
                className="ngo-filter-select"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                {PAKISTAN_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                className="ngo-filter-select"
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value)}
              >
                {FOCUS_OPTIONS.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>

              <button type="submit" className="ngo-search-btn">
                <span>Search NGOs</span>
              </button>
            </form>
          </div>
        </section>

        {/* Directory Listing */}
        <section className="ngo-results-section">
          <div className="ngo-results-header">
            <div className="ngo-results-count">
              {loading ? "Finding verified legal aid organisations…" : <>Showing <strong>{ngos.length}</strong> accredited organizations</>}
              {!loading && city !== "All Cities" && ` in ${city}`}
              {!loading && focusArea !== "All Areas" && ` for ${focusArea}`}
            </div>
            <Link
              to="/ngo/signup"
              style={{
                fontSize: "0.85rem",
                color: "var(--ll-brand-green)",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Are you a legal aid NGO? Register your organization →
            </Link>
          </div>

          {loading ? (
            <div className="ngo-cards-grid" role="status" aria-label="Loading organisations">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <ProfileCardSkeleton key={n} />
              ))}
            </div>
          ) : ngos.length === 0 ? (
            <div className="ngo-empty-state">
              
              <h3 className="ngo-empty-title">No Organizations Found</h3>
              <p className="ngo-empty-text">
                No verified NGOs matched your active search query or filters. Try adjusting your city or focus area.
              </p>
              <button
                type="button"
                className="ngo-search-btn"
                onClick={() => {
                  setKeyword("");
                  setCity("All Cities");
                  setFocusArea("All Areas");
                }}
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="ngo-cards-grid" data-reveal>
              {ngos.map((ngo) => (
                <div key={ngo._id} className="ngo-card">
                  <div>
                    <div className="ngo-card-top">
                      <h3 className="ngo-card-name">{ngo.name}</h3>
                      <div className="ngo-verified-pill">
                        
                        <span>Accredited</span>
                      </div>
                    </div>

                    <div className="ngo-card-loc">
                      
                      <span>
                        {ngo.city}{ngo.province ? `, ${ngo.province}` : ""}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0 8px 0', fontSize: '12.5px' }}>
                      {ngo.totalReviews > 0 ? (
                        <span style={{ fontWeight: 600, color: '#B45309' }}>
                          ⭐ {Number(ngo.rating || 0).toFixed(1)} <span style={{ color: '#6B7280', fontWeight: 400, fontSize: '11.5px' }}>({ngo.totalReviews} {ngo.totalReviews === 1 ? 'review' : 'reviews'})</span>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ll-text-muted)', fontSize: '12px' }}>
                          ⭐ Unrated <span style={{ fontSize: '11px' }}>(0 reviews)</span>
                        </span>
                      )}
                    </div>

                    <p className="ngo-card-bio">
                      {ngo.bio || "Dedicated to providing pro-bono defense, legal awareness, and mediation assistance to citizens without financial means."}
                    </p>

                    <div className="ngo-pill-container">
                      {(ngo.focusAreas || []).slice(0, 3).map((area) => (
                        <span key={area} className="ngo-tag">
                          {area}
                        </span>
                      ))}
                      {(ngo.focusAreas || []).length > 3 && (
                        <span
                          className="ngo-tag"
                          style={{ background: "#f3f4f6", color: "#4b5563", borderColor: "#e5e7eb" }}
                        >
                          +{ngo.focusAreas.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="ngo-card-footer">
                    <div className="ngo-card-hours">
                      <span>{ngo.operatingHours || "09:00 AM - 05:00 PM"}</span>
                    </div>
                    <Link to={`/ngo/${ngo._id}`} className="ngo-view-btn">
                      View Profile & Aid →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <Footer />
    </>
  );
};

export default NGODirectory;
