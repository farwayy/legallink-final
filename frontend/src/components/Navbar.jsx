import React from "react";
import LandingNav from "./landing/LandingNav";

/**
 * Public site navbar. Uses the same navigation as the landing page
 * (solid green bar that sticks to the top) so every page looks the same.
 */
const Navbar = () => <LandingNav variant="solid" />;

export default Navbar;
