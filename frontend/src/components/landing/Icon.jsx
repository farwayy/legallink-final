import React from "react";
import {
  ShieldCheck, HeartHandshake, Scale, Gavel, Home, Briefcase, Lock,
  FileText, Globe2, Check, ArrowRight, ChevronLeft, ChevronRight, Play, Star, Bot, MessageCircle,
} from "lucide-react";

/** One place that maps the icon names used in design.js to real icons. */
const ICONS = {
  shield: ShieldCheck,
  heart: HeartHandshake,
  scale: Scale,
  gavel: Gavel,
  home: Home,
  briefcase: Briefcase,
  lock: Lock,
  file: FileText,
  globe: Globe2,
  check: Check,
  arrow: ArrowRight,
  left: ChevronLeft,
  right: ChevronRight,
  play: Play,
  star: Star,
  bot: Bot,
  chat: MessageCircle,
};

const Icon = ({ name, size = 18, strokeWidth = 2, ...rest }) => {
  const Cmp = ICONS[name];
  if (!Cmp) return null;
  return <Cmp size={size} strokeWidth={strokeWidth} aria-hidden="true" {...rest} />;
};

export default Icon;
