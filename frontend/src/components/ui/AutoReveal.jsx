import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scroll reveal for whole pages without wrapping every element by hand.
 *
 * Put `data-reveal` on a container; each of its direct children then fades and
 * rises into view the first time it scrolls on screen. Items that come into view
 * together appear one after another (a short stagger), left to right, top to bottom.
 *
 *   <div className="row" data-reveal> ...cards... </div>
 *
 * Styles live in styles/motion.css (.ar-item / .ar-in). It uses a one-time
 * animation rather than a transition, so cards keep their own hover effects. Mounted once by the
 * public navbar, so every public page gets it. Content loaded later (lists from
 * the server) is picked up automatically.
 */
const STAGGER_MS = 150;
const MAX_DELAY_MS = 600;

const AutoReveal = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") return undefined;

    const seen = new WeakSet();

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
        visible.forEach((entry, i) => {
          const el = entry.target;
          el.style.animationDelay = `${Math.min(i * STAGGER_MS, MAX_DELAY_MS)}ms`;
          el.classList.add("ar-in");
          io.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );

    const scan = () => {
      document.querySelectorAll("[data-reveal] > *").forEach((el) => {
        // A nested container is not animated itself; its own children are
        if (seen.has(el) || el.classList.contains("lx-reveal") || el.hasAttribute("data-reveal")) return;
        seen.add(el);
        el.classList.add("ar-item");
        io.observe(el);
      });
    };

    scan();
    let pending = null;
    const mo = new MutationObserver(() => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = null;
        scan();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      if (pending) cancelAnimationFrame(pending);
    };
  }, [pathname]);

  return null;
};

export default AutoReveal;
