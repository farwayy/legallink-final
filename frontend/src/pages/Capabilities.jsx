import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageHero from "../components/landing/PageHero";

const Capabilities = () => {
  const capabilities = [
    {
      icon: "/images/icons/civil-rights.png",
      title: "Civil Law & Litigation",
      description: "Expert representation in civil disputes including contract breaches, property matters, partition suits, and commercial disputes."
    },
    {
      icon: "/images/icons/human-rights.png",
      title: "Human Rights & Defense",
      description: "Constitutional writ petitions under Article 199, fundamental rights defense, and habeas corpus representation."
    },
    {
      icon: "/images/icons/family-law.png",
      title: "Family & Matrimonial Law",
      description: "Compassionate handling of khula, divorce dissolution, child custody petitions, guardianship, and maintenance claims."
    },
    {
      icon: "/images/icons/property-law.png",
      title: "Property & Land Revenue",
      description: "Guidance on registry verification, mutation (intiqal) scrutiny, revenue court disputes, and possession decrees."
    },
    {
      icon: "/images/icons/corporate-law.png",
      title: "Corporate & Commercial",
      description: "Comprehensive corporate advisory including SECP compliance, shareholder agreements, mergers, and tax tribunals."
    },
    {
      icon: "/images/icons/cyber-crime.png",
      title: "Cybercrime & PECA Defense",
      description: "Specialized defense under Prevention of Electronic Crimes Act (PECA), digital defamation, and online financial fraud."
    },
    {
      icon: "/images/icons/immigration-law.png",
      title: "Immigration & Visa Law",
      description: "Legal assistance with foreign visa appeals, citizenship, passport cancellation remedies, and exit control list (ECL) petitions."
    },
    {
      icon: "/images/icons/insurance-claims.png",
      title: "Insurance & Consumer Protection",
      description: "Aggressive consumer protection court claims, repudiated insurance settlements, and policyholder rights."
    }
  ];

  return (
    <div className="ll-user-page">
      <div className="ll-ambient-grid" />
      <Navbar />
      <PageHero
        kicker="Practice areas"
        accent="Legal"
        title="Capabilities & Practice Areas"
        text="Legal expertise across trial courts, district courts and the High Courts of Pakistan."
        icon="gavel"
      />

      <main className="container position-relative py-5 lx-after-hero" style={{ zIndex: 1 }} data-reveal>
        

        <div className="row g-4 ll-perspective-wrap" data-reveal>
          {capabilities.map((cap, index) => (
            <div className="col-md-6 col-lg-3" key={index}>
              <div className="ll-card-3d h-100 p-4 text-center d-flex flex-column justify-content-between">
                <div>
                  <div
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '16px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                      border: '1px solid var(--ll-border)',
                    }}
                  >
                    <img
                      src={cap.icon}
                      alt={cap.title}
                      style={{ width: '42px', height: '42px', objectFit: 'contain' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>

                  <h5
                    style={{
                      fontFamily: "var(--font-serif, 'Playfair Display', serif)",
                      fontWeight: 700,
                      color: 'var(--ll-text-primary)',
                      marginBottom: '10px',
                      fontSize: '1.1rem',
                    }}
                  >
                    {cap.title}
                  </h5>

                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--ll-text-secondary)',
                      lineHeight: '1.6',
                    }}
                  >
                    {cap.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Capabilities;
