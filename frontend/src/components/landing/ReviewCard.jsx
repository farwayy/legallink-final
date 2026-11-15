import React from "react";
import Icon from "./Icon";

const Stars = ({ value = 5 }) => (
  <span className="lx-stars" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((s) => (
      <Icon key={s} name="star" size={14} fill={s <= value ? "currentColor" : "none"} />
    ))}
  </span>
);

const initial = (name = "") => name.trim().charAt(0).toUpperCase() || "L";

/** Big green card with the full review text. */
export const QuoteCard = ({ review }) => (
  <article className="lx-quote ll-on-dark">
    <div>
      <Stars value={review.rating} />
      <p className="lx-quote-text">“{review.comment}”</p>
    </div>
    <div className="lx-quote-who">
      {review.photo ? (
        <img className="lx-quote-avatar" src={review.photo} alt="" />
      ) : (
        <span className="lx-quote-avatar">{initial(review.author)}</span>
      )}
      <span>
        <strong>{review.author}</strong>
        <small>{review.detail}</small>
      </span>
    </div>
  </article>
);

/**
 * Tall photo card for the side columns.
 * Shows the reviewer's own photo when they have one; otherwise a courtroom
 * scene (`scene`) with their initial, so a stock face is never put next to a
 * real person's name.
 */
export const PhotoCard = ({ review, scene, onClick }) => (
  <button type="button" className="lx-photo-card" onClick={onClick} aria-label={`Read ${review.author}'s review`}>
    {review.photo ? (
      <img src={review.photo} alt="" loading="lazy" />
    ) : (
      <>
        {scene && <img src={scene} alt="" loading="lazy" className="is-scene" />}
        <span className="lx-photo-quote">“{review.comment}”</span>
      </>
    )}
    <span className="lx-photo-play"><Icon name="right" size={18} /></span>
    <span className="lx-photo-cap">
      <Stars value={review.rating} />
      <strong>{review.author}</strong>
      <small>{review.detail}</small>
    </span>
  </button>
);
