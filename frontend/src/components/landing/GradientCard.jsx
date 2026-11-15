import React from "react";

/** Rounded card with the brand green gradient. Text inside is white. */
const GradientCard = ({ as: Tag = "div", className = "", children, ...rest }) => (
  <Tag className={`lx-gcard ll-on-dark ${className}`} {...rest}>
    {children}
  </Tag>
);

export default GradientCard;
