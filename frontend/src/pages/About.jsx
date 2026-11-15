import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageHero from "../components/landing/PageHero";
import { ShieldCheck, BookOpen, HeartHandshake } from 'lucide-react';

const About = () => {
  return (
    <div className="ll-user-page">
      <div className="ll-ambient-grid" />
      <Navbar />
      <PageHero
        kicker="About us"
        accent="About"
        title="LegalLink Pakistan"
        text="LegalLink brings together verified advocates, pro bono legal aid organisations and citizens, so everyone in Pakistan can find trustworthy legal help."
        icon="shield"
      />

      <main className="container position-relative py-5 lx-after-hero" style={{ zIndex: 1 }} data-reveal>
        

        {/* 3D Pillars Grid */}
        <div className="row g-4 mb-5 ll-perspective-wrap" data-reveal>
          <div className="col-md-4">
            <div className="ll-card-3d h-100 p-4 text-center">
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: 'var(--ll-brand-green-light)',
                  color: 'var(--ll-brand-green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <ShieldCheck size={28} />
              </div>
              <h4 style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)", fontWeight: 700, color: 'var(--ll-text-primary)', marginBottom: '10px' }}>
                Bar Council Verified
              </h4>
              <p style={{ fontSize: '13.5px', color: 'var(--ll-text-secondary)', lineHeight: 1.6 }}>
                Every advocate profile on LegalLink is cross-referenced with Bar Council enrollment rolls and verified court standing.
              </p>
            </div>
          </div>

          <div className="col-md-4">
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
                <HeartHandshake size={28} />
              </div>
              <h4 style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)", fontWeight: 700, color: 'var(--ll-text-primary)', marginBottom: '10px' }}>
                Pro Bono & Human Rights
              </h4>
              <p style={{ fontSize: '13.5px', color: 'var(--ll-text-secondary)', lineHeight: 1.6 }}>
                Directly affiliated with accredited national Legal Aid Societies to ensure vulnerable citizens receive free legal representation.
              </p>
            </div>
          </div>

          <div className="col-md-4">
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
                <BookOpen size={28} />
              </div>
              <h4 style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)", fontWeight: 700, color: 'var(--ll-text-primary)', marginBottom: '10px' }}>
                AI Legal Intelligence
              </h4>
              <p style={{ fontSize: '13.5px', color: 'var(--ll-text-secondary)', lineHeight: 1.6 }}>
                Natural Language Processing engine trained on statutory legal codes in both English and Roman Urdu for instantaneous civic legal guidance.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default About;
