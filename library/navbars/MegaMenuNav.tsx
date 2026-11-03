/**
 * MegaMenuNav, a luxury retail header with full-width mega panels. Hover or
 * click a top item and a panel opens with columns of links plus two editorial
 * image cards. Moving between items re-measures the panel so its height
 * glides from one menu to the next while the content slides in from the side
 * you came from, and an underline slides between the top items.
 *
 * Props: brand, city, notice, menus (label, columns, cards, cardRatio),
 * utility links, bagCount.
 * CSS vars: --fd-mmn-paper, --fd-mmn-ink, --fd-mmn-accent.
 *
 * Behaviour: the header is `position: sticky` with a negative top equal to
 * the notice strip, so the strip scrolls away and the main row stays.
 * Browser support: all evergreen browsers.
 * Accessibility: top items are buttons with aria-expanded/aria-controls;
 * ArrowDown moves into the open panel, Escape closes and returns focus,
 * focus leaving the header closes it. The mobile drawer is a modal dialog
 * with a focus trap and drill-down sub panels with a Back button.
 * Reduced motion: panel height and content swap without sliding.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export interface MmnLink { label: string; href: string; note?: string }
export interface MmnColumn { heading: string; links: MmnLink[] }
export interface MmnCard { src: string; alt: string; kicker: string; title: string; href: string }
export interface MmnMenu { label: string; columns: MmnColumn[]; cards: [MmnCard, MmnCard]; cardRatio?: string }
export interface MegaMenuNavProps {
  brand?: string;
  city?: string;
  notice?: string;
  menus?: MmnMenu[];
  utility?: MmnLink[];
  bagCount?: number;
  className?: string;
}

const MENUS: MmnMenu[] = [
  {
    label: "Fragrance",
    cardRatio: "5 / 6",
    columns: [
      { heading: "Eaux de parfum", links: [
        { label: "Ambre Noir Nº 7", href: "#ambre", note: "New" },
        { label: "Thé Vert de Kyoto", href: "#the" },
        { label: "Pêche de Vigne", href: "#peche" },
        { label: "Nord", href: "#nord" },
        { label: "Crépuscule", href: "#crepuscule" },
        { label: "All fragrances", href: "#all" },
      ] },
      { heading: "By family", links: [
        { label: "Woody & amber", href: "#woody" },
        { label: "Green & tea", href: "#green" },
        { label: "Fruit & musk", href: "#fruit" },
        { label: "Cold florals", href: "#floral" },
      ] },
      { heading: "Services", links: [
        { label: "Discovery set, 8 × 2 ml", href: "#discovery" },
        { label: "Hand engraving", href: "#engrave" },
        { label: "Refill a flacon", href: "#refill" },
      ] },
    ],
    cards: [
      { src: "/img/lux/perfume-noir-800.webp", alt: "Amber glass flacon of Ambre Noir on a dark plinth", kicker: "New extrait", title: "Ambre Noir, made with labdanum from one farm in Crete", href: "#ambre" },
      { src: "/img/lux/perfume-green-800.webp", alt: "Green flacon in a pale green arch", kicker: "Bestseller", title: "Thé Vert de Kyoto, the shop's first scent since 1931", href: "#the" },
    ],
  },
  {
    label: "Home",
    cardRatio: "1 / 1",
    columns: [
      { heading: "Scent the room", links: [
        { label: "Candles, 220 g", href: "#candles" },
        { label: "Reed diffusers", href: "#reeds" },
        { label: "Room sprays", href: "#sprays" },
      ] },
      { heading: "Objects", links: [
        { label: "Stoneware vases", href: "#vases" },
        { label: "Tea service", href: "#tea" },
        { label: "Incense & holders", href: "#incense" },
      ] },
    ],
    cards: [
      { src: "/img/lux/still-vase-800.webp", alt: "White stoneware vase with an olive branch and lemons", kicker: "Objects", title: "The Ménerbes vase, thrown in Provence", href: "#vases" },
      { src: "/img/lux/still-tea-800.webp", alt: "Black teapot with two cups on a walnut shelf", kicker: "Ritual", title: "A tea service for one slow afternoon", href: "#tea" },
    ],
  },
  {
    label: "Textiles",
    cardRatio: "3 / 4",
    columns: [
      { heading: "Linen", links: [
        { label: "Throws", href: "#throws" },
        { label: "Bed linen", href: "#bed" },
        { label: "Table linen", href: "#table" },
        { label: "Curtains, made to measure", href: "#curtains" },
      ] },
      { heading: "Colours", links: [
        { label: "Oat", href: "#oat" },
        { label: "Terracotta", href: "#terra" },
        { label: "Encre", href: "#ink" },
      ] },
      { heading: "Care", links: [
        { label: "Washing linen", href: "#wash" },
        { label: "Linen water", href: "#water" },
      ] },
    ],
    cards: [
      { src: "/img/lux/drape-oat-800.webp", alt: "Folds of oat coloured linen", kicker: "Washed linen", title: "Oat, our undyed Normandy flax", href: "#oat" },
      { src: "/img/lux/drape-terra-800.webp", alt: "Folds of terracotta linen", kicker: "Garment dyed", title: "Terracotta, dyed with madder root", href: "#terra" },
    ],
  },
  {
    label: "Gifts",
    cardRatio: "3 / 2",
    columns: [
      { heading: "By price", links: [
        { label: "Under €80", href: "#u80" },
        { label: "€80 to €200", href: "#u200" },
        { label: "Over €200", href: "#o200" },
      ] },
      { heading: "Wrapped by hand", links: [
        { label: "Gift cards", href: "#cards" },
        { label: "Corporate gifting", href: "#corporate" },
      ] },
    ],
    cards: [
      { src: "/img/lux/perfume-peach-800.webp", alt: "Peach flacon in a warm arch", kicker: "Under €120", title: "Pêche de Vigne, 30 ml", href: "#peche" },
      { src: "/img/lux/still-grey-800.webp", alt: "White vase and bowls in grey light", kicker: "For the home", title: "The quiet shelf set", href: "#shelf" },
    ],
  },
  {
    label: "Maison",
    cardRatio: "16 / 10",
    columns: [
      { heading: "About", links: [
        { label: "Our atelier, rue de Saintonge", href: "#atelier" },
        { label: "The 1931 ledger", href: "#ledger" },
        { label: "Journal", href: "#journal" },
      ] },
      { heading: "Visit", links: [
        { label: "Paris, Le Marais", href: "#paris" },
        { label: "Copenhagen, Bredgade", href: "#cph" },
        { label: "Book a scent consultation", href: "#book" },
      ] },
    ],
    cards: [
      { src: "/img/lux/drape-ink-800.webp", alt: "Deep blue silk folds", kicker: "Journal", title: "Why our boxes are lined in encre silk", href: "#silk" },
      { src: "/img/lux/perfume-north-800.webp", alt: "Pale blue flacon in a white arch", kicker: "Copenhagen", title: "Nord, composed for the new store", href: "#nord" },
    ],
  },
];

const UTILITY: MmnLink[] = [
  { label: "Stores", href: "#stores" },
  { label: "France · EUR €", href: "#locale" },
];

export function MegaMenuNav({
  brand = "Vérane",
  city = "Paris",
  notice = "Complimentary hand engraving on every 100 ml flacon until 24 December",
  menus = MENUS,
  utility = UTILITY,
  bagCount = 2,
  className,
}: MegaMenuNavProps) {
  const uid = useId();
  const root = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const burger = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [dir, setDir] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [mobile, setMobile] = useState(false);
  const [sub, setSub] = useState<number | null>(null);
  const timer = useRef(0);
  const prev = useRef<number | null>(null);

  const go = (i: number | null) => {
    window.clearTimeout(timer.current);
    if (i !== null && prev.current !== null) setDir(i > prev.current ? 1 : -1);
    else setDir(0);
    prev.current = i;
    setActive(i);
  };
  const later = (i: number | null, ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => go(i), ms);
  };

  // Underline indicator follows the hovered or open item.
  const ind = hover ?? active;
  useLayoutEffect(() => {
    const b = bar.current;
    const t = ind !== null ? triggers.current[ind] : null;
    if (!b) return;
    if (!t) {
      b.style.opacity = "0";
      return;
    }
    const label = t.querySelector("span") as HTMLElement;
    b.style.opacity = "1";
    b.style.width = `${label.offsetWidth}px`;
    b.style.transform = `translateX(${t.offsetLeft + label.offsetLeft}px)`;
  }, [ind]);

  // Panel height follows the content of the open menu.
  useLayoutEffect(() => {
    const s = shell.current, c = inner.current;
    if (!s) return;
    if (!c || active === null) {
      s.style.height = "0px";
      return;
    }
    const set = () => (s.style.height = `${c.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(c);
    return () => ro.disconnect();
  }, [active]);

  // Escape + outside click for the desktop panel.
  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const t = triggers.current[active];
        go(null);
        t?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) go(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mobile drawer: focus in, trap, Escape.
  useEffect(() => {
    if (!mobile) return;
    const d = drawer.current;
    window.setTimeout(() => d?.querySelector<HTMLElement>("[data-first]")?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobile(false);
        burger.current?.focus();
      }
      if (e.key === "Tab" && d) {
        const f = Array.from(d.querySelectorAll<HTMLElement>("a,button")).filter((el) => el.offsetParent !== null && !el.closest("[inert]"));
        const i = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          f[f.length - 1]?.focus();
        } else if (!e.shiftKey && i === f.length - 1) {
          e.preventDefault();
          f[0]?.focus();
        }
      }
    };
    const mq = matchMedia("(min-width: 900px)");
    const onMq = () => mq.matches && setMobile(false);
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [mobile]);

  useEffect(() => {
    if (!mobile) setSub(null);
  }, [mobile]);
  useEffect(() => {
    if (!mobile) return;
    const d = drawer.current;
    window.setTimeout(() => {
      const target = sub === null ? d?.querySelector<HTMLElement>("[data-first]") : d?.querySelector<HTMLElement>("[data-back]");
      target?.focus();
    }, 60);
  }, [sub, mobile]);

  const onTriggerKey = (e: ReactKeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (active !== i) go(i);
      window.setTimeout(() => inner.current?.querySelector<HTMLElement>("a")?.focus(), 30);
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const n = (i + (e.key === "ArrowRight" ? 1 : -1) + menus.length) % menus.length;
      triggers.current[n]?.focus();
      if (active !== null) go(n);
    }
  };

  const menu = active !== null ? menus[active] : null;
  const panelId = `${uid}-panel`;

  return (
    <header
      ref={root}
      className={`fd-mmn${className ? " " + className : ""}`}
      data-open={active !== null ? "" : undefined}
      onPointerLeave={(e) => e.pointerType === "mouse" && later(null, 180)}
      onPointerEnter={() => window.clearTimeout(timer.current)}
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node) && !mobile) go(null);
      }}
    >
      <style>{css}</style>
      <div className="fd-mmn-notice">
        <p>{notice}</p>
        <div className="fd-mmn-util">
          {utility.map((u) => <a key={u.href} href={u.href}>{u.label}</a>)}
        </div>
      </div>

      <div className="fd-mmn-main">
        <button ref={burger} type="button" className="fd-mmn-burger" aria-label="Open menu" aria-expanded={mobile} aria-controls={`${uid}-drawer`} onClick={() => setMobile(true)}>
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M3 7h16M3 15h10" stroke="currentColor" strokeWidth="1.3" fill="none" /></svg>
        </button>
        <nav className="fd-mmn-nav" aria-label="Shop">
          <div ref={rail} className="fd-mmn-rail" onPointerLeave={() => setHover(null)}>
            {menus.map((m, i) => (
              <button
                key={m.label}
                ref={(el) => { triggers.current[i] = el; }}
                type="button"
                className="fd-mmn-top"
                aria-expanded={active === i}
                aria-controls={panelId}
                data-on={active === i ? "" : undefined}
                onPointerEnter={(e) => {
                  if (e.pointerType !== "mouse") return;
                  setHover(i);
                  if (active === null) later(i, 90);
                  else go(i);
                }}
                onClick={() => (active === i ? go(null) : go(i))}
                onKeyDown={(e) => onTriggerKey(e, i)}
              >
                <span>{m.label}</span>
              </button>
            ))}
            <span ref={bar} className="fd-mmn-bar" aria-hidden="true" />
          </div>
        </nav>

        <a className="fd-mmn-brand" href="#top" aria-label={`${brand} ${city}, home`}>
          <span className="fd-mmn-word">{brand}</span>
          <span className="fd-mmn-city">{city}</span>
        </a>

        <div className="fd-mmn-tools">
          <a href="#search" className="fd-mmn-tool fd-mmn-hide-sm">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.2" /><path d="M12 12l4 4" stroke="currentColor" strokeWidth="1.2" /></svg>
            <span>Search</span>
          </a>
          <a href="#account" className="fd-mmn-tool fd-mmn-hide-sm">Account</a>
          <a href="#bag" className="fd-mmn-tool fd-mmn-bag" aria-label={`Bag, ${bagCount} items`}>
            <span className="fd-mmn-bagtxt">Bag</span>
            <span className="fd-mmn-count">{bagCount}</span>
          </a>
        </div>
      </div>

      <div ref={shell} id={panelId} className="fd-mmn-shell" role="region" aria-label={menu ? `${menu.label} menu` : undefined}>
        {menu && (
          <div ref={inner} key={active} className="fd-mmn-panel" data-dir={dir} onKeyDown={(e) => {
            if (e.key === "ArrowUp" && active !== null && (e.target as HTMLElement) === inner.current?.querySelector("a")) {
              e.preventDefault();
              triggers.current[active]?.focus();
            }
          }}>
            <div className="fd-mmn-cols">
              {menu.columns.map((c) => (
                <div key={c.heading} className="fd-mmn-col">
                  <p className="fd-mmn-h">{c.heading}</p>
                  <ul>
                    {c.links.map((l) => (
                      <li key={l.href}>
                        <a href={l.href} className="fd-mmn-link">{l.label}{l.note && <em>{l.note}</em>}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="fd-mmn-cards">
              {menu.cards.map((c) => (
                <a key={c.href + c.src} href={c.href} className="fd-mmn-card">
                  <span className="fd-mmn-ph" style={{ aspectRatio: menu.cardRatio ?? "4 / 5" }}>
                    <img src={c.src} alt={c.alt} width={800} height={1000} loading="lazy" />
                  </span>
                  <span className="fd-mmn-kick">{c.kicker}</span>
                  <span className="fd-mmn-ct">{c.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="fd-mmn-scrim" aria-hidden="true" onPointerEnter={() => later(null, 60)} onClick={() => go(null)} />

      {/* Mobile drawer */}
      <div className="fd-mmn-dwrap" data-show={mobile ? "" : undefined} hidden={!mobile}>
        <div className="fd-mmn-dscrim" onClick={() => setMobile(false)} aria-hidden="true" />
        <div ref={drawer} id={`${uid}-drawer`} className="fd-mmn-drawer" role="dialog" aria-modal="true" aria-label="Menu" data-sub={sub !== null ? "" : undefined}>
          <div className="fd-mmn-dhead">
            <span className="fd-mmn-word fd-mmn-dword">{brand}</span>
            <button type="button" className="fd-mmn-x" aria-label="Close menu" onClick={() => { setMobile(false); burger.current?.focus(); }}>
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.3" /></svg>
            </button>
          </div>
          <div className="fd-mmn-track">
            <div className="fd-mmn-pane" inert={sub !== null ? true : undefined}>
              <ul className="fd-mmn-dlist">
                {menus.map((m, i) => (
                  <li key={m.label}>
                    <button type="button" className="fd-mmn-dtop" data-first={i === 0 ? "" : undefined} aria-expanded={sub === i} onClick={() => setSub(i)}>
                      <span>{m.label}</span>
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="fd-mmn-dutil">
                <a href="#account">Account</a>
                <a href="#search">Search</a>
                {utility.map((u) => <a key={u.href} href={u.href}>{u.label}</a>)}
              </div>
              <p className="fd-mmn-dnote">{notice}</p>
            </div>
            <div className="fd-mmn-pane" inert={sub === null ? true : undefined}>
              {sub !== null && (
                <>
                  <button type="button" className="fd-mmn-back" data-back="" onClick={() => setSub(null)}>
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
                    All
                  </button>
                  <p className="fd-mmn-dsubt">{menus[sub].label}</p>
                  <a href={menus[sub].cards[0].href} className="fd-mmn-dcard">
                    <img src={menus[sub].cards[0].src} alt={menus[sub].cards[0].alt} width={800} height={1000} loading="lazy" />
                    <span>{menus[sub].cards[0].kicker}</span>
                  </a>
                  {menus[sub].columns.map((c) => (
                    <div key={c.heading} className="fd-mmn-dgroup">
                      <p className="fd-mmn-h">{c.heading}</p>
                      <ul>
                        {c.links.map((l) => <li key={l.href}><a href={l.href} onClick={() => setMobile(false)}>{l.label}{l.note && <em>{l.note}</em>}</a></li>)}
                      </ul>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

const serif = `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif`;
const sans = `ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif`;

const css = `
.fd-mmn {
  --fd-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fd-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --fd-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --fd-dur-1: 120ms; --fd-dur-2: 240ms; --fd-dur-3: 420ms; --fd-dur-4: 700ms;
  --fd-mmn-paper: #f4f0e8;
  --fd-mmn-ink: #1b1815;
  --fd-mmn-soft: #6f675d;
  --fd-mmn-line: #ddd5c8;
  --fd-mmn-accent: #6e1f1c;
  position: sticky; top: -34px; z-index: 50; display: block; margin: 0; padding: 0;
  font: 400 15px/1.4 ${sans};
  color: var(--fd-mmn-ink); background: var(--fd-mmn-paper);
}
.fd-mmn, .fd-mmn *, .fd-mmn *::before, .fd-mmn *::after { box-sizing: border-box; }
.fd-mmn a:focus-visible, .fd-mmn button:focus-visible { outline: 2px solid color-mix(in srgb, var(--fd-mmn-accent) 70%, transparent); outline-offset: 2px; }

.fd-mmn-notice { display: flex; align-items: center; justify-content: center; height: 34px; margin: 0; padding: 0 32px; background: var(--fd-mmn-ink); color: #efe8db; position: relative; }
.fd-mmn-notice p { margin: 0; padding: 0; font: 400 0.75rem/1.2 ${sans}; letter-spacing: 0.02em; color: #efe8db; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fd-mmn-util { position: absolute; right: 32px; top: 0; height: 100%; display: flex; align-items: center; gap: 20px; }
.fd-mmn-util a { font: 400 0.75rem/1.2 ${sans}; color: #cfc6b7; text-decoration: none; }
.fd-mmn-util a:hover { color: #fff; }

.fd-mmn-main { position: relative; z-index: 3; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; height: 76px; margin: 0; padding: 0 32px; background: var(--fd-mmn-paper); border-bottom: 1px solid var(--fd-mmn-line); }
.fd-mmn-nav { margin: 0; padding: 0; }
.fd-mmn-rail { position: relative; display: flex; align-items: center; gap: 2px; margin: 0 0 0 -12px; padding: 0; }
.fd-mmn-top { position: relative; display: block; margin: 0; padding: 10px 12px; border: 0; background: none; font: 400 1rem/1.2 ${serif}; letter-spacing: 0; color: var(--fd-mmn-ink); cursor: pointer; appearance: none; -webkit-appearance: none; border-radius: 2px; }
.fd-mmn-top span { display: inline-block; }
.fd-mmn-bar { position: absolute; left: 0; bottom: 2px; height: 1px; width: 0; background: var(--fd-mmn-ink); opacity: 0; pointer-events: none; transition: transform var(--fd-dur-3) var(--fd-ease-out), width var(--fd-dur-3) var(--fd-ease-out), opacity var(--fd-dur-2) linear; }
.fd-mmn-top[data-on] { color: var(--fd-mmn-accent); }

.fd-mmn-brand { display: flex; flex-direction: column; align-items: center; gap: 4px; margin: 0; padding: 4px 8px; text-decoration: none; color: var(--fd-mmn-ink); }
.fd-mmn-word { display: block; font: 400 1.875rem/1 ${serif}; letter-spacing: 0.28em; text-transform: uppercase; color: var(--fd-mmn-ink); padding-left: 0.28em; }
.fd-mmn-city { display: block; font: 500 0.625rem/1 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: 0.32em; text-transform: uppercase; color: var(--fd-mmn-soft); padding-left: 0.32em; }

.fd-mmn-tools { display: flex; align-items: center; justify-content: flex-end; gap: 22px; margin: 0; padding: 0; }
.fd-mmn-tool { display: inline-flex; align-items: center; gap: 8px; margin: 0; padding: 6px 0; font: 400 0.875rem/1.2 ${sans}; color: var(--fd-mmn-ink); text-decoration: none; background-image: linear-gradient(currentColor, currentColor); background-size: 0% 1px; background-repeat: no-repeat; background-position: 0 100%; transition: background-size var(--fd-dur-2) var(--fd-ease-out); }
.fd-mmn-tool svg { display: block; }
.fd-mmn-tool:hover { background-size: 100% 1px; }
.fd-mmn-count { display: inline-grid; place-items: center; min-width: 20px; height: 20px; margin: 0; padding: 0 5px; border-radius: 9999px; font: 500 0.6875rem/1 ${sans}; color: #f4f0e8; background: var(--fd-mmn-accent); }

.fd-mmn-shell { position: absolute; left: 0; right: 0; top: 100%; z-index: 2; height: 0; overflow: hidden; margin: 0; padding: 0; background: var(--fd-mmn-paper); transition: height var(--fd-dur-3) var(--fd-ease-in-out); box-shadow: 0 30px 40px -30px rgba(27,24,21,0.18); }
.fd-mmn-panel { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 56px; margin: 0; padding: 36px 32px 44px; animation: fd-mmn-in var(--fd-dur-3) var(--fd-ease-out); }
.fd-mmn-panel[data-dir="1"] { animation-name: fd-mmn-inr; }
.fd-mmn-panel[data-dir="-1"] { animation-name: fd-mmn-inl; }
@keyframes fd-mmn-in { from { opacity: 0; transform: translateY(-6px); } }
@keyframes fd-mmn-inr { from { opacity: 0; transform: translateX(24px); } }
@keyframes fd-mmn-inl { from { opacity: 0; transform: translateX(-24px); } }
.fd-mmn-cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px; margin: 0; padding: 0; }
.fd-mmn-h { margin: 0 0 14px; padding: 0 0 10px; border-bottom: 1px solid var(--fd-mmn-line); font: 500 0.6875rem/1.2 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: 0.14em; text-transform: uppercase; color: var(--fd-mmn-soft); }
.fd-mmn-col ul, .fd-mmn-dgroup ul { margin: 0; padding: 0; list-style: none; }
.fd-mmn-col li { margin: 0; padding: 0; }
.fd-mmn-link { display: inline-flex; align-items: baseline; gap: 8px; margin: 0; padding: 5px 0; font: 400 1.0625rem/1.35 ${serif}; color: var(--fd-mmn-ink); text-decoration: none; transition: transform var(--fd-dur-2) var(--fd-ease-out), color var(--fd-dur-1) linear; }
.fd-mmn-link:hover, .fd-mmn-link:focus-visible { transform: translateX(4px); color: var(--fd-mmn-accent); }
.fd-mmn-link em, .fd-mmn-dgroup em { font: italic 400 0.8125rem/1 ${serif}; color: var(--fd-mmn-accent); }
.fd-mmn-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 0; padding: 0; align-items: start; }
.fd-mmn-card { display: block; margin: 0; padding: 0; color: var(--fd-mmn-ink); text-decoration: none; }
.fd-mmn-ph { display: block; overflow: hidden; margin: 0 0 12px; background: #e6dfd2; }
.fd-mmn-ph img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform var(--fd-dur-4) var(--fd-ease-out); }
.fd-mmn-card:hover .fd-mmn-ph img { transform: scale(1.04); }
.fd-mmn-kick { display: block; margin: 0 0 4px; font: 500 0.6875rem/1.2 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: 0.14em; text-transform: uppercase; color: var(--fd-mmn-accent); }
.fd-mmn-ct { display: block; font: italic 400 1rem/1.35 ${serif}; color: var(--fd-mmn-ink); max-width: 30ch; }

.fd-mmn-scrim { position: fixed; inset: 0; z-index: 1; background: rgba(27,24,21,0.28); opacity: 0; pointer-events: none; transition: opacity var(--fd-dur-3) var(--fd-ease-out); }
.fd-mmn[data-open] .fd-mmn-scrim { opacity: 1; pointer-events: auto; }

.fd-mmn-burger { display: none; width: 40px; height: 40px; margin: 0 0 0 -10px; padding: 9px; border: 0; background: none; color: var(--fd-mmn-ink); cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-mmn-burger svg { display: block; }

.fd-mmn-dwrap { position: fixed; inset: 0; z-index: 60; }
.fd-mmn-dwrap[hidden] { display: none; }
.fd-mmn-dscrim { position: absolute; inset: 0; background: rgba(27,24,21,0.4); animation: fd-mmn-fade var(--fd-dur-3) var(--fd-ease-out); }
@keyframes fd-mmn-fade { from { opacity: 0; } }
.fd-mmn-drawer { position: absolute; left: 0; top: 0; bottom: 0; width: min(420px, 100%); display: flex; flex-direction: column; margin: 0; padding: 0; background: var(--fd-mmn-paper); overflow: hidden; animation: fd-mmn-slide var(--fd-dur-3) var(--fd-ease-out); }
@keyframes fd-mmn-slide { from { transform: translateX(-100%); } }
.fd-mmn-dhead { flex: none; display: flex; align-items: center; justify-content: space-between; height: 64px; margin: 0; padding: 0 12px 0 20px; border-bottom: 1px solid var(--fd-mmn-line); }
.fd-mmn-dword { font-size: 1.25rem; }
.fd-mmn-x { display: grid; place-items: center; width: 44px; height: 44px; margin: 0; padding: 0; border: 0; background: none; color: var(--fd-mmn-ink); cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-mmn-x svg { display: block; }
.fd-mmn-track { position: relative; flex: 1; min-height: 0; display: grid; grid-template-columns: 100% 100%; margin: 0; padding: 0; transition: transform var(--fd-dur-3) var(--fd-ease-in-out); }
.fd-mmn-drawer[data-sub] .fd-mmn-track { transform: translateX(-100%); }
.fd-mmn-pane { min-height: 0; overflow-y: auto; margin: 0; padding: 12px 20px 32px; }
.fd-mmn-dlist { margin: 0; padding: 0; list-style: none; }
.fd-mmn-dlist li { margin: 0; padding: 0; border-bottom: 1px solid var(--fd-mmn-line); }
.fd-mmn-dtop { display: flex; width: 100%; align-items: center; justify-content: space-between; margin: 0; padding: 18px 0; border: 0; background: none; font: 400 1.75rem/1.1 ${serif}; letter-spacing: -0.01em; color: var(--fd-mmn-ink); text-align: left; cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-mmn-dtop svg { display: block; color: var(--fd-mmn-soft); }
.fd-mmn-dutil { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; margin: 28px 0 0; padding: 0; }
.fd-mmn-dutil a { font: 400 0.9375rem/1.3 ${sans}; color: var(--fd-mmn-ink); text-decoration: none; }
.fd-mmn-dnote { margin: 28px 0 0; padding: 14px 0 0; border-top: 1px solid var(--fd-mmn-line); font: italic 400 0.9375rem/1.4 ${serif}; color: var(--fd-mmn-soft); }
.fd-mmn-back { display: inline-flex; align-items: center; gap: 6px; margin: 4px 0 14px -4px; padding: 6px 4px; border: 0; background: none; font: 500 0.75rem/1 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: 0.14em; text-transform: uppercase; color: var(--fd-mmn-soft); cursor: pointer; appearance: none; -webkit-appearance: none; }
.fd-mmn-back svg { display: block; }
.fd-mmn-dsubt { margin: 0 0 16px; font: italic 400 2.25rem/1 ${serif}; letter-spacing: -0.02em; color: var(--fd-mmn-ink); }
.fd-mmn-dcard { position: relative; display: block; margin: 0 0 24px; height: 180px; overflow: hidden; text-decoration: none; }
.fd-mmn-dcard img { display: block; width: 100%; height: 100%; object-fit: cover; }
.fd-mmn-dcard span { position: absolute; left: 12px; bottom: 12px; padding: 5px 8px; font: 500 0.6875rem/1 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: 0.12em; text-transform: uppercase; color: var(--fd-mmn-ink); background: var(--fd-mmn-paper); }
.fd-mmn-dgroup { margin: 0 0 24px; padding: 0; }
.fd-mmn-dgroup li { margin: 0; padding: 0; }
.fd-mmn-dgroup a { display: flex; align-items: baseline; gap: 8px; margin: 0; padding: 9px 0; font: 400 1.125rem/1.3 ${serif}; color: var(--fd-mmn-ink); text-decoration: none; }

@media (max-width: 1180px) { .fd-mmn-util { display: none; } .fd-mmn-cols { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 899px) {
  .fd-mmn { top: -30px; }
  .fd-mmn-notice { height: 30px; padding: 0 16px; }
  .fd-mmn-notice p { font-size: 0.6875rem; }
  .fd-mmn-main { height: 64px; padding: 0 16px; grid-template-columns: 44px 1fr 44px; }
  .fd-mmn-nav, .fd-mmn-shell, .fd-mmn-scrim, .fd-mmn-hide-sm, .fd-mmn-bagtxt { display: none; }
  .fd-mmn-burger { display: block; }
  .fd-mmn-word { font-size: 1.375rem; }
  .fd-mmn-city { display: none; }
  .fd-mmn-tools { gap: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .fd-mmn-shell, .fd-mmn-bar, .fd-mmn-track, .fd-mmn-link, .fd-mmn-ph img { transition: none; }
  .fd-mmn-panel, .fd-mmn-drawer, .fd-mmn-dscrim { animation: none; }
}
`;

/* ── Demo ─────────────────────────────────────────────────────────────── */

const PRODUCTS = [
  { src: "/img/lux/perfume-green-800.webp", name: "Thé Vert de Kyoto", meta: "Eau de parfum · 50 ml", price: "€185" },
  { src: "/img/lux/perfume-peach-800.webp", name: "Pêche de Vigne", meta: "Eau de parfum · 50 ml", price: "€185" },
  { src: "/img/lux/perfume-north-800.webp", name: "Nord", meta: "Eau de parfum · 50 ml", price: "€195" },
  { src: "/img/lux/perfume-dusk-800.webp", name: "Crépuscule", meta: "Eau de parfum · 50 ml", price: "€195" },
];

export function Demo() {
  return (
    <div className="fd-mmn-demo">
      <style>{demoCss}</style>
      <MegaMenuNav />
      <main>
        <section className="fd-mmn-demo-hero">
          <div className="fd-mmn-demo-copy">
            <p className="fd-mmn-demo-k">Nº 7 · Extrait de parfum</p>
            <h1>Ambre <i>Noir</i></h1>
            <p className="fd-mmn-demo-lede">Labdanum, smoked black tea and a little cracked pepper. Macerated for nine weeks in our cellar on rue de Saintonge before it is bottled by hand.</p>
            <dl>
              <div><dt>Size</dt><dd>50 ml</dd></div>
              <div><dt>Price</dt><dd>€265</dd></div>
              <div><dt>Batch</dt><dd>0412 of 0600</dd></div>
            </dl>
            <a href="#add" className="fd-mmn-demo-btn">Add to bag</a>
          </div>
          <img className="fd-mmn-demo-img" src="/img/lux/perfume-noir.webp" alt="Ambre Noir flacon on a dark plinth" width={1200} height={1500} />
        </section>
        <section className="fd-mmn-demo-row" aria-label="More eaux de parfum">
          {PRODUCTS.map((p) => (
            <a key={p.name} href="#p" className="fd-mmn-demo-p">
              <img src={p.src} alt={`${p.name} flacon`} width={800} height={1000} loading="lazy" />
              <b>{p.name}</b>
              <span>{p.meta}</span>
              <span>{p.price}</span>
            </a>
          ))}
        </section>
      </main>
    </div>
  );
}

const demoCss = `
.fd-mmn-demo { margin: 0; padding: 0; min-height: 100vh; background: #f4f0e8; color: #1b1815; font: 400 15px/1.5 ${sans}; }
.fd-mmn-demo *, .fd-mmn-demo *::before, .fd-mmn-demo *::after { box-sizing: border-box; }
.fd-mmn-demo main { display: block; margin: 0; padding: 0 32px 120px; }
.fd-mmn-demo-hero { display: grid; grid-template-columns: 1fr 1.1fr; gap: 48px; align-items: end; margin: 0; padding: 48px 0 64px; border-bottom: 1px solid #ddd5c8; }
.fd-mmn-demo-k { margin: 0 0 18px; font: 500 0.75rem/1 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: 0.14em; text-transform: uppercase; color: #6e1f1c; }
.fd-mmn-demo h1 { margin: 0; font: 400 clamp(4rem, 11vw, 9.5rem)/0.86 ${serif}; letter-spacing: -0.045em; color: #1b1815; }
.fd-mmn-demo h1 i { font-style: italic; }
.fd-mmn-demo-lede { max-width: 42ch; margin: 28px 0 28px; font: 400 1.0625rem/1.55 ${serif}; color: #4a443d; }
.fd-mmn-demo dl { display: flex; gap: 36px; margin: 0 0 32px; padding: 16px 0; border-top: 1px solid #ddd5c8; border-bottom: 1px solid #ddd5c8; }
.fd-mmn-demo dt { margin: 0 0 4px; font: 500 0.6875rem/1 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; letter-spacing: 0.14em; text-transform: uppercase; color: #6f675d; }
.fd-mmn-demo dd { margin: 0; font: 400 1.0625rem/1.2 ${serif}; }
.fd-mmn-demo-btn { display: inline-block; padding: 16px 36px; font: 500 0.8125rem/1 ${sans}; letter-spacing: 0.12em; text-transform: uppercase; color: #f4f0e8; background: #1b1815; text-decoration: none; }
.fd-mmn-demo-img { display: block; width: 100%; height: 640px; object-fit: cover; }
.fd-mmn-demo-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 0; padding: 56px 0 0; }
.fd-mmn-demo-p { display: flex; flex-direction: column; gap: 2px; color: #1b1815; text-decoration: none; }
.fd-mmn-demo-p img { display: block; width: 100%; aspect-ratio: 4 / 5; height: auto; object-fit: cover; margin: 0 0 12px; }
.fd-mmn-demo-p b { font: 400 1.125rem/1.3 ${serif}; }
.fd-mmn-demo-p span { font: 400 0.8125rem/1.4 ${sans}; color: #6f675d; }
@media (max-width: 899px) {
  .fd-mmn-demo main { padding: 0 16px 80px; }
  .fd-mmn-demo-hero { grid-template-columns: 1fr; gap: 28px; padding: 28px 0 40px; }
  .fd-mmn-demo-img { height: 420px; order: -1; }
  .fd-mmn-demo-row { grid-template-columns: 1fr 1fr; gap: 14px; }
  .fd-mmn-demo dl { gap: 22px; }
}
`;
