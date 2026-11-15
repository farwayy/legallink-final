import React from "react";

/**
 * Grey placeholder shapes shown while data loads (styles in styles/motion.css).
 *   <Skeleton w="60%" h={14} />        a single bar
 *   <Skeleton circle size={56} />      a round avatar
 *   <SkeletonText lines={3} />         a few lines of text
 */
export const Skeleton = ({ w = "100%", h = 14, circle = false, size, radius, className = "", style = {} }) => (
  <span
    aria-hidden="true"
    className={`sk${circle ? " sk-circle" : ""} ${className}`}
    style={{
      width: circle ? size : w,
      height: circle ? size : h,
      ...(radius != null ? { borderRadius: radius } : {}),
      ...style,
    }}
  />
);

export const SkeletonText = ({ lines = 3, last = "60%" }) => (
  <span aria-hidden="true" style={{ display: "block" }}>
    {Array.from({ length: lines }).map((_, i) => (
      <span key={i} className="sk sk-line" style={{ width: i === lines - 1 ? last : "100%" }} />
    ))}
  </span>
);

/** Placeholder in the shape of an advocate / NGO directory card */
export const ProfileCardSkeleton = () => (
  <div className="sk-card h-100" role="status" aria-label="Loading">
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <Skeleton circle size={84} />
      <Skeleton w="62%" h={18} />
      <Skeleton w="40%" h={12} />
    </div>
    <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "18px 0" }}>
      <Skeleton w={78} h={24} radius={999} />
      <Skeleton w={92} h={24} radius={999} />
    </div>
    <SkeletonText lines={3} last="70%" />
    <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
      <Skeleton w="50%" h={40} radius={12} />
      <Skeleton w="50%" h={40} radius={12} />
    </div>
  </div>
);

/** Placeholder for a row of number cards on a dashboard */
export const StatCardsSkeleton = ({ count = 4 }) => (
  <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`, gap: 16 }}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="sk-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Skeleton w={40} h={40} radius={12} />
          <Skeleton w="50%" h={13} />
        </div>
        <Skeleton w="35%" h={28} style={{ marginTop: 18 }} />
      </div>
    ))}
  </div>
);

/** Placeholder for list rows (case lists, inquiries, chats) */
export const ListSkeleton = ({ rows = 4 }) => (
  <div role="status" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 4px" }}>
        <Skeleton w={38} h={38} radius={10} />
        <div style={{ flex: 1 }}>
          <Skeleton w={`${55 - (i % 3) * 8}%`} h={13} />
          <Skeleton w={`${35 - (i % 2) * 6}%`} h={11} style={{ marginTop: 8 }} />
        </div>
        <Skeleton w={70} h={28} radius={8} />
      </div>
    ))}
  </div>
);

/** Placeholder for a whole profile page (public advocate / NGO profile, own profile) */
export const ProfilePageSkeleton = () => (
  <div role="status" aria-label="Loading profile">
    <div className="sk-hero">
      <div className="sk-hero-inner">
        <Skeleton circle size={92} className="sk-on-dark" />
        <div style={{ flex: 1, maxWidth: 460 }}>
          <Skeleton w="38%" h={22} radius={999} className="sk-on-dark" />
          <Skeleton w="80%" h={34} className="sk-on-dark" style={{ marginTop: 14 }} />
          <Skeleton w="55%" h={14} className="sk-on-dark" style={{ marginTop: 14 }} />
        </div>
      </div>
    </div>
    <div className="sk-page-body">
      <StatCardsSkeleton count={4} />
      <div className="sk-two-col">
        <div className="sk-card" style={{ flex: "2 1 520px" }}>
          <Skeleton w="30%" h={18} />
          <div style={{ marginTop: 18 }}><SkeletonText lines={4} last="55%" /></div>
          <Skeleton w="24%" h={18} style={{ marginTop: 30 }} />
          <div style={{ marginTop: 18 }}><SkeletonText lines={3} last="40%" /></div>
        </div>
        <div className="sk-card" style={{ flex: "1 1 280px" }}>
          <Skeleton w="50%" h={18} />
          <div style={{ marginTop: 18 }}><SkeletonText lines={3} last="70%" /></div>
          <Skeleton w="100%" h={44} radius={12} style={{ marginTop: 22 }} />
        </div>
      </div>
    </div>
  </div>
);

export default Skeleton;
