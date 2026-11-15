import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageHero from "../components/landing/PageHero";
import { Target, Shield, Zap } from 'lucide-react';

const Mission = () => {
  return (
    <div className="ll-user-page">
      <div className="ll-ambient-grid" />
      <Navbar />
      <PageHero
        kicker="Our mission"
        accent="Transparent"
        title="Justice for All"
        text="Making legal representation in Pakistan open, verified and affordable through technology and trusted advocates."
        icon="scale"
      />

      <main className="container position-relative py-5 lx-after-hero" style={{ zIndex: 1 }} data-reveal>
        

        <div className="row g-4 mb-5 ll-perspective-wrap" data-reveal>
          <div className="col-lg-4 col-md-6">
            <div className="ll-card-3d h-100 p-4 text-center">
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: 'var(--ll-brand-green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <Target size={28} />
              </div>
              <h4 style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)", fontWeight: 700, color: 'var(--ll-text-primary)', marginBottom: '10px' }}>
                Universal Accessibility
              </h4>
              <p style={{ fontSize: '13.5px', color: 'var(--ll-text-secondary)', lineHeight: 1.6 }}>
                Ensuring every citizen, regardless of socio-economic background or geographic location, can access accredited legal counsel.
              </p>
            </div>
          </div>

          <div className="col-lg-4 col-md-6">
            <div className="ll-card-3d h-100 p-4 text-center">
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: 'rgba(212, 175, 55, 0.15)',
                  color: 'var(--ll-brand-gold)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <Shield size={28} />
              </div>
              <h4 style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)", fontWeight: 700, color: 'var(--ll-text-primary)', marginBottom: '10px' }}>
                Integrity & Ethics
              </h4>
              <p style={{ fontSize: '13.5px', color: 'var(--ll-text-secondary)', lineHeight: 1.6 }}>
                Upholding strict professional conduct and fee transparency under the Legal Practitioners and Bar Councils Act 1973.
              </p>
            </div>
          </div>

          <div className="col-lg-4 col-md-6">
            <div className="ll-card-3d h-100 p-4 text-center">
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: '#3B82F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <Zap size={28} />
              </div>
              <h4 style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)", fontWeight: 700, color: 'var(--ll-text-primary)', marginBottom: '10px' }}>
                Technological Velocity
              </h4>
              <p style={{ fontSize: '13.5px', color: 'var(--ll-text-secondary)', lineHeight: 1.6 }}>
                Eliminating procedural bottlenecks with real-time hearing trackers, digital dockets, and bilingual AI assistance.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Mission;
