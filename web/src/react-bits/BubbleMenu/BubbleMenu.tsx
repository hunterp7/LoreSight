import type { CSSProperties, ReactNode } from 'react';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { Menu } from 'pixelarticons/react/Menu';
import { Close } from 'pixelarticons/react/Close';

import './BubbleMenu.css';

type MenuItem = {
  label: string;
  href: string;
  ariaLabel?: string;
  rotation?: number;
  hoverStyles?: {
    bgColor?: string;
    textColor?: string;
    glowColor?: string;
    paperColor?: string;
    textShadow?: string;
  };
};

export type BubbleMenuProps = {
  logo: ReactNode | string;
  onMenuClick?: (open: boolean) => void;
  className?: string;
  style?: CSSProperties;
  menuAriaLabel?: string;
  menuBg?: string;
  menuContentColor?: string;
  toggleBg?: string;
  toggleContentColor?: string;
  useFixedPosition?: boolean;
  items?: MenuItem[];
  animationEase?: string;
  animationDuration?: number;
  staggerDelay?: number;
  overlayTargetSelector?: string;
};

const DEFAULT_ITEMS: MenuItem[] = [
  {
    label: 'home',
    href: '#',
    ariaLabel: 'Home',
    rotation: -8,
    hoverStyles: { bgColor: '#3b82f6', textColor: '#ffffff' }
  },
  {
    label: 'about',
    href: '#',
    ariaLabel: 'About',
    rotation: 8,
    hoverStyles: { bgColor: '#10b981', textColor: '#ffffff' }
  },
  {
    label: 'projects',
    href: '#',
    ariaLabel: 'Documentation',
    rotation: 8,
    hoverStyles: { bgColor: '#f59e0b', textColor: '#ffffff' }
  },
  {
    label: 'blog',
    href: '#',
    ariaLabel: 'Blog',
    rotation: 8,
    hoverStyles: { bgColor: '#ef4444', textColor: '#ffffff' }
  },
  {
    label: 'contact',
    href: '#',
    ariaLabel: 'Contact',
    rotation: -8,
    hoverStyles: { bgColor: '#8b5cf6', textColor: '#ffffff' }
  }
];

export default function BubbleMenu({
  logo,
  onMenuClick,
  className,
  style,
  menuAriaLabel = 'Toggle menu',
  menuBg = '#fff',
  menuContentColor = '#111',
  toggleBg = menuBg,
  toggleContentColor = menuContentColor,
  useFixedPosition = false,
  items,
  animationEase = 'back.out(1.5)',
  animationDuration = 0.5,
  staggerDelay = 0.12,
  overlayTargetSelector
}: BubbleMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayFrame, setOverlayFrame] = useState<CSSProperties | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);
  const bubblesRef = useRef<HTMLAnchorElement[]>([]);
  const labelRefs = useRef<HTMLSpanElement[]>([]);

  const menuItems = items?.length ? items : DEFAULT_ITEMS;
  const containerClassName = ['bubble-menu', useFixedPosition ? 'fixed' : 'absolute', isMenuOpen ? 'menu-open' : '', className]
    .filter(Boolean)
    .join(' ');

  const handleToggle = () => {
    const nextState = !isMenuOpen;
    if (nextState) setShowOverlay(true);
    setIsMenuOpen(nextState);
    onMenuClick?.(nextState);
  };

  useEffect(() => {
    if (!showOverlay || !overlayTargetSelector || typeof window === 'undefined') return;
    const target = document.querySelector<HTMLElement>(overlayTargetSelector);
    if (!target) return;
    const updateFrame = () => {
      const rect = target.getBoundingClientRect();
      const radius = getComputedStyle(target).borderRadius;
      // Set `inset` first: assigning it after explicit coordinates would reset
      // left/top in CSSStyleDeclaration and move the portal to the viewport edge.
      setOverlayFrame({ position: 'fixed', inset: 'auto', left: rect.left, top: rect.top, width: rect.width, height: rect.height, borderRadius: radius });
    };
    updateFrame();
    window.addEventListener('resize', updateFrame);
    const observer = new ResizeObserver(updateFrame);
    observer.observe(target);
    return () => {
      window.removeEventListener('resize', updateFrame);
      observer.disconnect();
    };
  }, [showOverlay, overlayTargetSelector]);

  useEffect(() => {
    const overlay = overlayRef.current;
    const bubbles = bubblesRef.current.filter(Boolean);
    const labels = labelRefs.current.filter(Boolean);

    if (!overlay || !bubbles.length) return;

    if (isMenuOpen) {
      gsap.set(overlay, { display: 'flex' });
      gsap.killTweensOf([...bubbles, ...labels]);
      gsap.set(bubbles, { scale: 0, transformOrigin: '50% 50%' });
      gsap.set(labels, { y: 24, autoAlpha: 0 });

      bubbles.forEach((bubble, i) => {
        const delay = i * staggerDelay + gsap.utils.random(-0.05, 0.05);
        const tl = gsap.timeline({ delay });

        tl.to(bubble, {
          scale: 1,
          duration: animationDuration,
          ease: animationEase
        });
        if (labels[i]) {
          tl.to(
            labels[i],
            {
              y: 0,
              autoAlpha: 1,
              duration: animationDuration,
              ease: 'power3.out'
            },
            `-=${animationDuration * 0.9}`
          );
        }
      });
    } else if (showOverlay) {
      gsap.killTweensOf([...bubbles, ...labels]);
      gsap.to(labels, {
        y: 24,
        autoAlpha: 0,
        duration: 0.2,
        ease: 'power3.in'
      });
      gsap.to(bubbles, {
        scale: 0,
        duration: 0.2,
        ease: 'power3.in',
        onComplete: () => {
          gsap.set(overlay, { display: 'none' });
          setShowOverlay(false);
        }
      });
    }
  }, [isMenuOpen, showOverlay, animationEase, animationDuration, staggerDelay]);

  useEffect(() => {
    const handleResize = () => {
      if (isMenuOpen) {
        const bubbles = bubblesRef.current.filter(Boolean);
        const isDesktop = window.innerWidth >= 900;

        bubbles.forEach((bubble, i) => {
          const item = menuItems[i];
          if (bubble && item) {
            const rotation = isDesktop ? (item.rotation ?? 0) : 0;
            gsap.set(bubble, { rotation });
          }
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMenuOpen, menuItems]);

  return (
    <>
      <nav className={containerClassName} style={style} aria-label="Main navigation">
        <div className="bubble logo-bubble" aria-label="Logo" style={{ background: toggleBg, color: toggleContentColor }}>
          <span className="logo-content">
            {typeof logo === 'string' ? <img src={logo} alt="Logo" className="bubble-logo" /> : logo}
          </span>
        </div>

        <button
          type="button"
          className={`bubble toggle-bubble menu-btn ${isMenuOpen ? 'open' : ''}`}
          onClick={handleToggle}
          aria-label={menuAriaLabel}
          aria-pressed={isMenuOpen}
          style={{ background: toggleBg, color: toggleContentColor }}
        >
          {isMenuOpen
            ? <Close className="menu-icon" width={18} height={18} aria-hidden="true" focusable="false" />
            : <Menu className="menu-icon" width={18} height={18} aria-hidden="true" focusable="false" />}
        </button>
      </nav>
      {showOverlay && (
        (overlayTargetSelector && overlayFrame ? createPortal(
          <div
            ref={overlayRef}
            className="bubble-menu-items fixed loresight-bubble-menu-overlay"
            style={overlayFrame}
            aria-hidden={!isMenuOpen}
          >
            <ul className="pill-list" role="menu" aria-label="Menu links">
              {menuItems.map((item, idx) => (
                <li key={idx} role="none" className="pill-col">
                  <a
                    role="menuitem"
                    href={item.href}
                    aria-label={item.ariaLabel || item.label}
                    className="pill-link"
                    ref={(el) => { if (el) bubblesRef.current[idx] = el; }}
                    data-hover-bg={item.hoverStyles?.bgColor}
                    data-hover-text={item.hoverStyles?.textColor}
                    data-hover-glow={item.hoverStyles?.glowColor}
                    data-hover-paper={item.hoverStyles?.paperColor}
                    data-hover-shadow={item.hoverStyles?.textShadow}
                    style={{
                      '--item-rot': `${item.rotation ?? 0}deg`,
                      '--pill-bg': menuBg,
                      '--pill-color': menuContentColor,
                      '--hover-bg': item.hoverStyles?.bgColor || '#f3f4f6',
                      '--hover-color': item.hoverStyles?.textColor || menuContentColor,
                      '--hover-glow': item.hoverStyles?.glowColor || item.hoverStyles?.textColor || menuContentColor,
                      '--hover-paper': item.hoverStyles?.paperColor || item.hoverStyles?.bgColor || '#ffffff',
                      '--hover-shadow': item.hoverStyles?.textShadow || '0 0 8px currentColor'
                    } as CSSProperties}
                  >
                    <span className="pill-label" ref={(el) => { if (el) labelRefs.current[idx] = el; }}>{item.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>, document.body
        ) : <div
          ref={overlayRef}
          className={`bubble-menu-items ${useFixedPosition ? 'fixed' : 'absolute'}`}
          aria-hidden={!isMenuOpen}
        >
          <ul className="pill-list" role="menu" aria-label="Menu links">
            {menuItems.map((item, idx) => (
              <li key={idx} role="none" className="pill-col">
                <a
                  role="menuitem"
                  href={item.href}
                  aria-label={item.ariaLabel || item.label}
                  className="pill-link"
                  style={
                    {
                      '--item-rot': `${item.rotation ?? 0}deg`,
                      '--pill-bg': menuBg,
                      '--pill-color': menuContentColor,
                      '--hover-bg': item.hoverStyles?.bgColor || '#f3f4f6',
                      '--hover-color': item.hoverStyles?.textColor || menuContentColor,
                      '--hover-glow': item.hoverStyles?.glowColor || item.hoverStyles?.textColor || menuContentColor,
                      '--hover-paper': item.hoverStyles?.paperColor || item.hoverStyles?.bgColor || '#ffffff',
                      '--hover-shadow': item.hoverStyles?.textShadow || '0 0 8px currentColor'
                    } as CSSProperties
                  }
                  ref={el => {
                    if (el) bubblesRef.current[idx] = el;
                  }}
                >
                  <span
                    className="pill-label"
                    ref={el => {
                      if (el) labelRefs.current[idx] = el;
                    }}
                  >
                    {item.label}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>)
      )}
    </>
  );
}
