import React from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";

/**
 * Shared button.
 * variant: "primary" (green gradient) | "ghost" (outlined) | "white" (on dark/gradient) | "glass" (on gradient)
 * Pass `to` for an in-app link, `href` for an outside link, or neither for a <button>.
 */
const Button = ({ variant = "primary", to, href, icon, iconRight = "arrow", children, className = "", ...rest }) => {
  const cls = `lx-btn lx-btn-${variant} ${className}`;
  const inner = (
    <>
      {icon && <Icon name={icon} size={17} />}
      <span>{children}</span>
      {iconRight && <Icon name={iconRight} size={16} className="lx-btn-arrow" />}
    </>
  );

  if (to) return <Link to={to} className={cls} {...rest}>{inner}</Link>;
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls} {...rest}>{inner}</a>;
  return <button type="button" className={cls} {...rest}>{inner}</button>;
};

export default Button;
