import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import api from "../services/api";
import ProfileButton from "../components/ProfileButton";
import {
  Icon,
  Reveal,
  Button,
  SectionHeading,
  GradientCard,
  Marquee,
  StatsRow,
  StepCard,
  PracticeCard,
  JusticePortal,
  QuoteCard,
  PhotoCard,
  LandingNav,
  LandingFooter,
} from "../components/landing";
import {
  cssVars,
  images,
  hero,
  practiceTicker,
  stats,
  about,
  steps,
  practiceAreas,
  ways,
  fallbackReviews,
} from "../design/design";
import "../styles/home.css";

/** Turns an API review into the shape the review cards use. */
const mapReview = (r) => ({
  id: r._id,
  author: r.userId?.name || "Verified citizen",
  detail: [r.caseId?.category, r.lawyerId?.name || r.ngoId?.name].filter(Boolean).join(" · ") || "Resolved case",
  rating: r.rating || 5,
  comment: r.comment,
  photo: r.userId?.profilePicture || null,
});

const LandingPage = () => {
  const { isDark } = useTheme();
  const practiceRef = useRef(null);

  // ── Reviews: real ones from the database, sample ones until they load ──
  const [reviews, setReviews] = useState(fallbackReviews);
  const [reviewIdx, setReviewIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .get("/reviews/featured")
      .then(({ data }) => {
        const list = (data?.reviews || []).filter((r) => r.comment).map(mapReview);
        if (alive && list.length >= 3) setReviews(list);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const pick = (offset) => reviews[(reviewIdx + offset) % reviews.length];
  const nextReview = () => setReviewIdx((i) => (i + 1) % reviews.length);
  const prevReview = () => setReviewIdx((i) => (i - 1 + reviews.length) % reviews.length);

  const scrollPractice = (dir) => {
    const el = practiceRef.current;
    if (el) el.scrollBy({ left: dir * (el.clientWidth / 2), behavior: "smooth" });
  };

  return (
    <div className="lx-page" style={cssVars(isDark)}>
      <LandingNav />

      {/* ───────────── 1. Hero ───────────── */}
      <section className="lx-hero ll-on-dark">
        <div className="lx-wrap lx-hero-inner">
          <div className="lx-hero-card">
            <h1 className="lx-hero-title">
              <em>{hero.accent}</em> {hero.title[0]}
              <br />
              {hero.title[1]}
              <br />
              {hero.title[2]}
            </h1>
            <p className="lx-hero-text">{hero.text}</p>
            <div className="lx-hero-actions">
              <Button to={hero.primary.to}>{hero.primary.label}</Button>
              <Button variant="ghost" to={hero.secondary.to} icon="bot" iconRight={null}>
                {hero.secondary.label}
              </Button>
            </div>
          </div>

          <div className="lx-hero-visual">
            <img className="lx-hero-person" src={images.hero} alt="A LegalLink advocate" />
            {hero.badges.map((b, i) => (
              <div key={b.title} className={`lx-glass-badge is-${i === 0 ? "top" : "bottom"}`}>
                <span className="lx-glass-icon"><Icon name={b.icon} size={17} /></span>
                <span>
                  <strong>{b.title}</strong>
                  <small>{b.text}</small>
                </span>
              </div>
            ))}
          </div>
        </div>
        <Marquee items={practiceTicker} />
      </section>

      {/* ───────────── 2. About ───────────── */}
      <section className="lx-section">
        <div className="lx-wrap lx-about">
          <Reveal>
            <GradientCard className="lx-about-card">
              <div className="lx-about-top">
                <img src={images.about} alt="An advocate advising a client" loading="lazy" />
                <div>
                  <p>{about.cardText}</p>
                  <Button variant="white" to={about.cardCta.to} iconRight={null}>
                    {about.cardCta.label}
                  </Button>
                </div>
              </div>
              <StatsRow items={stats} />
            </GradientCard>
          </Reveal>

          <Reveal delay={120}>
            <SectionHeading kicker={about.kicker} accent={about.accent} title={about.title} />
            <p className="lx-lead">{about.text}</p>
            <ul className="lx-checks">
              {about.points.map((p) => (
                <li key={p}>
                  <span><Icon name="check" size={13} strokeWidth={3} /></span>
                  {p}
                </li>
              ))}
            </ul>
            <div className="lx-media">
              <img src={images.aboutSide} alt="" loading="lazy" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────────── 3. How it works ───────────── */}
      <section className="lx-section lx-process ll-on-dark">
        <div className="lx-wrap">
          <Reveal>
            <SectionHeading kicker="How it works" accent="A Clear," title="Step-by-Step Path to Justice" light />
          </Reveal>
          <div className="lx-steps">
            {steps.map((s, i) => (
              <Reveal key={s.num} delay={i * 150}>
                <StepCard {...s} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── 4. Practice areas ───────────── */}
      <section className="lx-section">
        <div className="lx-wrap">
          <div className="lx-row-head">
            <Reveal>
              <SectionHeading kicker="Practice areas" accent="Specialised" title="Counsel for Every Matter" />
            </Reveal>
            <div className="lx-arrows">
              <button type="button" onClick={() => scrollPractice(-1)} aria-label="Previous practice areas">
                <Icon name="left" />
              </button>
              <button type="button" onClick={() => scrollPractice(1)} aria-label="Next practice areas">
                <Icon name="right" />
              </button>
            </div>
          </div>
          <div className="lx-practice-track" ref={practiceRef}>
            {practiceAreas.map((p, i) => (
              <PracticeCard key={p.title} {...p} featured={i === 1} />
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── 5. Three ways (rotating portal) ───────────── */}
      <section className="lx-section lx-soft">
        <div className="lx-wrap lx-ways">
          <JusticePortal image={images.portal} seal={ways.seal} badges={ways.badges} />
          <Reveal>
            <SectionHeading kicker={ways.kicker} accent={ways.accent} title={ways.title} />
            <div className="lx-way-list">
              {ways.items.map((w) => (
                <Link key={w.num} to={w.to} className="lx-way">
                  <span className="lx-way-num">{w.num}</span>
                  <span>
                    <strong>{w.title}</strong>
                    <small>{w.text}</small>
                  </span>
                  <Icon name="arrow" size={18} className="lx-way-arrow" />
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────────── 6. Client stories ───────────── */}
      <section className="lx-section">
        <div className="lx-wrap">
          <div className="lx-row-head">
            <Reveal>
              <SectionHeading kicker="Client stories" accent="Stories" title="of Justice Delivered" />
            </Reveal>
            <div className="lx-arrows">
              <button type="button" onClick={prevReview} aria-label="Previous review"><Icon name="left" /></button>
              <button type="button" onClick={nextReview} aria-label="Next review"><Icon name="right" /></button>
            </div>
          </div>
          <div className="lx-reviews" key={pick(0).id}>
            <QuoteCard review={pick(0)} />
            <PhotoCard review={pick(1)} scene={images.reviewScenes[0]} onClick={nextReview} />
            <PhotoCard
              review={pick(2)}
              scene={images.reviewScenes[1]}
              onClick={() => setReviewIdx((i) => (i + 2) % reviews.length)}
            />
          </div>
        </div>
      </section>

      <LandingFooter />
      <ProfileButton />
    </div>
  );
};

export default LandingPage;
