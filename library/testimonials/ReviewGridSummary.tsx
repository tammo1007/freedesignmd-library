/**
 * ReviewGridSummary, product reviews with a rating summary (average, star
 * distribution bars that double as filters, would-buy-again and a texture
 * scale), filter chips (verified, with photos, skin type), sort, and a
 * masonry of review cards with verified badges, photos, skin meta, brand
 * replies and working helpful votes.
 *
 * Props: product ({ name, size, price, image }), reviews (Review[]),
 * distribution ([5★, 4★, 3★, 2★, 1★] counts across all reviews),
 * skinTypes, recommend (0..1), texture (0 rich .. 1 light), className.
 * Review: { id, rating, title, body, name, date, verified, skin, age, used,
 *   photos?, helpful, unhelpful, reply? }
 *
 * Browser support: all evergreen browsers (CSS multi-column masonry).
 * Accessibility: distribution rows and chips are toggle buttons with
 * aria-pressed; star ratings are labelled images; the result count is a
 * polite live region; votes are toggle buttons.
 */
import { useId, useMemo, useState } from "react";

export interface Review {
  id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
  name: string;
  /** "12 Feb 2026" (day, short English month, year) so sorting stays locale-proof. */
  date: string;
  verified: boolean;
  skin: string;
  age: string;
  used: string;
  photos?: string[];
  helpful: number;
  unhelpful: number;
  reply?: { from: string; text: string };
}

export interface Product { name: string; size: string; price: string; image: string }

export interface ReviewGridSummaryProps {
  product?: Product;
  reviews?: Review[];
  distribution?: [number, number, number, number, number];
  skinTypes?: string[];
  recommend?: number;
  texture?: number;
  className?: string;
}

const IMG = "/img/prism/";

export const DEFAULT_PRODUCT: Product = { name: "Barrier Balm", size: "50 ml", price: "€38", image: IMG + "balm-480.webp" };

export const DEFAULT_REVIEWS: Review[] = [
  { id: "r1", rating: 5, title: "Finally stopped the flaking around my nose", name: "Hannah W.", date: "12 Feb 2026", verified: true, skin: "Dry", age: "35 to 44", used: "8 weeks", photos: [IMG + "balm-480.webp"], helpful: 48, unhelpful: 1,
    body: "Fourth barrier cream this winter. First one where the flaky patches by my nose were actually gone by day five, not just hidden under makeup. It's thick, so a pea-sized amount at night is plenty. The jar lasted me nine weeks." },
  { id: "r2", rating: 4, title: "Great, but it pills under my sunscreen", name: "Tomás R.", date: "3 Mar 2026", verified: true, skin: "Combination", age: "25 to 34", used: "4 weeks", helpful: 31, unhelpful: 3,
    body: "Love it at night. In the morning it pilled under my SPF unless I waited ten minutes. Docking a star because I'm impatient, not because of the balm.",
    reply: { from: "Mira, PRISM skin team", text: "Thanks Tomás. Try half the amount in the morning and press it in instead of rubbing. Our SPF 30 is made to sit over it." } },
  { id: "r3", rating: 5, title: "My dermatologist asked what I'd changed", name: "Aiko M.", date: "21 Jan 2026", verified: true, skin: "Sensitive", age: "45 to 54", used: "12 weeks", photos: [IMG + "balm-480.webp", IMG + "tube-480.webp"], helpful: 62, unhelpful: 0,
    body: "Rosacea-prone, so I patch test everything for a week. No sting, no flush. At my three-month check-up my derm asked what I was using. Unscented actually means unscented here." },
  { id: "r4", rating: 3, title: "Too heavy for my forehead", name: "Leon B.", date: "28 Feb 2026", verified: false, skin: "Oily", age: "18 to 24", used: "3 weeks", helpful: 17, unhelpful: 4,
    body: "Fine on my cheeks, gave me a few bumps on my forehead. To be fair the label says dry to normal skin. Now using it on my hands after the gym and it's great there." },
  { id: "r5", rating: 5, title: "Survived a ski week in Åre", name: "Sanna L.", date: "9 Mar 2026", verified: true, skin: "Normal", age: "25 to 34", used: "2 weeks", photos: [IMG + "tube-480.webp"], helpful: 22, unhelpful: 0,
    body: "Minus 18 and wind all week. My partner's face was raw by Wednesday, mine wasn't. He is now using my jar, which was not the plan." },
  { id: "r6", rating: 4, title: "Wish it came in a bigger size", name: "Grace O.", date: "14 Feb 2026", verified: true, skin: "Dry", age: "55 to 64", used: "10 weeks", helpful: 19, unhelpful: 1,
    body: "50 ml goes quickly if you do your neck too, and you should. I'd happily pay for a 100 ml refill pouch. Texture and results are a 5." },
  { id: "r7", rating: 1, title: "Jar arrived cracked", name: "Pete D.", date: "2 Mar 2026", verified: true, skin: "Combination", age: "45 to 54", used: "1 week", helpful: 9, unhelpful: 6,
    body: "Lid was split and some balm had leaked into the box. Support sent a new jar in two days without asking for photos, so this is one star for the courier and five for the people.",
    reply: { from: "Jonah, PRISM support", text: "Sorry Pete. We've moved to a thicker outer carton since February, so this shouldn't happen again." } },
  { id: "r8", rating: 5, title: "Under-eye dryness gone in a week", name: "Priyanka S.", date: "18 Feb 2026", verified: true, skin: "Combination", age: "35 to 44", used: "6 weeks", helpful: 14, unhelpful: 0,
    body: "I use a tiny amount under my eyes before bed. The crepey dry lines I had every morning are gone. No milia so far, which was my worry with balms." },
  { id: "r9", rating: 4, title: "Smells of nothing, feels like a lot", name: "Noor A.", date: "6 Mar 2026", verified: false, skin: "Sensitive", age: "25 to 34", used: "5 weeks", helpful: 11, unhelpful: 2,
    body: "Like a soft wax that melts on contact. Takes about five minutes to sink in, so I put it on before brushing my teeth and it's done by the time I'm finished." },
  { id: "r10", rating: 5, title: "Bought a second jar for my mum", name: "Jonas K.", date: "25 Jan 2026", verified: true, skin: "Dry", age: "25 to 34", used: "7 weeks", photos: [IMG + "balm-480.webp"], helpful: 8, unhelpful: 0,
    body: "She has been using a pharmacy tub for thirty years and called me after three days to ask where to reorder. That has never happened with anything I've given her." },
];

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="fd-rgs-stars" role="img" aria-label={`${value} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((k) => {
        const f = Math.max(0, Math.min(1, value - k));
        return (
          <svg key={k} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 1.2l2 4.3 4.7.5-3.5 3.2 1 4.6L8 11.5l-4.2 2.3 1-4.6L1.3 6l4.7-.5z" fill="var(--fd-rgs-line2)" />
            {f > 0 && <path d="M8 1.2l2 4.3 4.7.5-3.5 3.2 1 4.6L8 11.5l-4.2 2.3 1-4.6L1.3 6l4.7-.5z" fill="currentColor" style={f < 1 ? { clipPath: `inset(0 ${(1 - f) * 100}% 0 0)` } : undefined} />}
          </svg>
        );
      })}
    </span>
  );
}

const Check = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 .8l1.6 1.1 1.9-.1.7 1.8 1.6 1-.5 1.9.5 1.9-1.6 1-.7 1.8-1.9-.1L7 13.2l-1.6-1.1-1.9.1-.7-1.8-1.6-1L1.7 7.5 1.2 5.6l1.6-1 .7-1.8 1.9.1z" fill="currentColor" /><path className="fd-rgs-ck" d="M4.6 7.1l1.6 1.6 3.2-3.3" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

type Sort = "helpful" | "newest" | "low";

export function ReviewGridSummary({
  product = DEFAULT_PRODUCT,
  reviews = DEFAULT_REVIEWS,
  distribution = [902, 241, 78, 31, 32],
  skinTypes = ["Dry", "Combination", "Oily", "Sensitive", "Normal"],
  recommend = 0.94,
  texture = 0.28,
  className,
}: ReviewGridSummaryProps) {
  const [stars, setStars] = useState<number | null>(null);
  const [verified, setVerified] = useState(false);
  const [photos, setPhotos] = useState(false);
  const [skin, setSkin] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("helpful");
  const [votes, setVotes] = useState<Record<string, "up" | "down" | undefined>>({});

  const tid = useId();
  const total = distribution.reduce((a, b) => a + b, 0);
  const avg = distribution.reduce((a, c, i) => a + c * (5 - i), 0) / total;
  const max = Math.max(...distribution);

  const list = useMemo(() => {
    const M = "JanFebMarAprMayJunJulAugSepOctNovDec";
    const ts = (d: string) => { const [dd, mm, yy] = d.split(" "); return +yy * 400 + (M.indexOf(mm) / 3) * 32 + +dd; };
    const out = reviews.filter((r) => (stars ? r.rating === stars : true) && (!verified || r.verified) && (!photos || (r.photos && r.photos.length)) && (!skin || r.skin === skin));
    return out.sort((a, b) => (sort === "newest" ? ts(b.date) - ts(a.date) : sort === "low" ? a.rating - b.rating : b.helpful - a.helpful));
  }, [reviews, stars, verified, photos, skin, sort]);

  const filtered = stars != null || verified || photos || skin != null;
  const clear = () => { setStars(null); setVerified(false); setPhotos(false); setSkin(null); };
  const vote = (id: string, v: "up" | "down") => setVotes((s) => ({ ...s, [id]: s[id] === v ? undefined : v }));

  return (
    <section className={`fd-rgs${className ? " " + className : ""}`} aria-labelledby={tid}>
      <style>{css}</style>
      <aside className="fd-rgs-side">
        <div className="fd-rgs-prod">
          <img src={product.image} alt="" width={56} height={72} loading="lazy" decoding="async" />
          <div>
            <p className="fd-rgs-pn">{product.name}</p>
            <p className="fd-rgs-ps">{product.size} · {product.price}</p>
          </div>
        </div>
        <h2 className="fd-rgs-title" id={tid}>Reviews</h2>
        <div className="fd-rgs-avg">
          <span className="fd-rgs-big">{avg.toFixed(1)}</span>
          <span className="fd-rgs-avgm">
            <Stars value={Math.round(avg * 10) / 10} size={16} />
            <span>{total.toLocaleString("en-US")} reviews</span>
          </span>
        </div>
        <ul className="fd-rgs-dist" aria-label="Filter by rating">
          {distribution.map((c, i) => {
            const s = 5 - i;
            const on = stars === s;
            return (
              <li key={s}>
                <button type="button" className="fd-rgs-drow" aria-pressed={on} onClick={() => setStars(on ? null : s)} aria-label={`${s} star, ${c} reviews`}>
                  <span className="fd-rgs-dl">{s}<svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.2l2 4.3 4.7.5-3.5 3.2 1 4.6L8 11.5l-4.2 2.3 1-4.6L1.3 6l4.7-.5z" fill="currentColor" /></svg></span>
                  <span className="fd-rgs-track"><i style={{ ["--w" as string]: c / max }} /></span>
                  <span className="fd-rgs-dc">{c}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <dl className="fd-rgs-facts">
          <div>
            <dt>Would buy again</dt>
            <dd><b>{Math.round(recommend * 100)}%</b></dd>
          </div>
          <div>
            <dt>Texture</dt>
            <dd>
              <span className="fd-rgs-scale" role="img" aria-label={`Texture: ${texture < 0.4 ? "rich" : texture > 0.6 ? "light" : "medium"}`}>
                <i style={{ left: `${texture * 100}%` }} />
              </span>
              <span className="fd-rgs-scl" aria-hidden="true"><span>Rich</span><span>Light</span></span>
            </dd>
          </div>
        </dl>
        <a className="fd-rgs-write" href="#write-review">Write a review</a>
      </aside>

      <div className="fd-rgs-main">
        <div className="fd-rgs-bar">
          <div className="fd-rgs-chips" role="group" aria-label="Filters">
            <button type="button" className="fd-rgs-chip" aria-pressed={verified} onClick={() => setVerified((v) => !v)}><Check />Verified buyers</button>
            <button type="button" className="fd-rgs-chip" aria-pressed={photos} onClick={() => setPhotos((v) => !v)}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="1.5" y="2.5" width="11" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" /><path d="M2 10l3-3 2.5 2.5L9.5 7.5 12 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
              With photos
            </button>
            <span className="fd-rgs-sep" aria-hidden="true" />
            {skinTypes.map((t) => (
              <button key={t} type="button" className="fd-rgs-chip" data-skin="" aria-pressed={skin === t} onClick={() => setSkin(skin === t ? null : t)}>{t}</button>
            ))}
          </div>
        </div>
        <div className="fd-rgs-row">
          <p className="fd-rgs-count" aria-live="polite">
            <span>{filtered ? <>Showing <b>{list.length}</b> matching reviews from this page</> : <>Showing <b>{list.length}</b> of {total.toLocaleString("en-US")}</>}</span>
            {filtered && <button type="button" className="fd-rgs-clear" onClick={clear}>Clear filters</button>}
          </p>
            <label className="fd-rgs-sort">
            <span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="helpful">Most helpful</option>
              <option value="newest">Newest</option>
              <option value="low">Lowest rated</option>
            </select>
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </label>
        </div>

        {list.length === 0 ? (
          <div className="fd-rgs-empty">
            <p>No reviews match all of those yet.</p>
            <button type="button" className="fd-rgs-clear" onClick={clear}>Clear filters</button>
          </div>
        ) : (
          <div className="fd-rgs-grid">
            {list.map((r) => {
              const v = votes[r.id];
              return (
                <article key={r.id} className="fd-rgs-card" aria-label={`${r.rating} star review by ${r.name}`}>
                  <header className="fd-rgs-ch">
                    <Stars value={r.rating} />
                    <time className="fd-rgs-date">{r.date}</time>
                  </header>
                  <h3 className="fd-rgs-rt">{r.title}</h3>
                  <p className="fd-rgs-body">{r.body}</p>
                  {r.photos && r.photos.length > 0 && (
                    <div className="fd-rgs-photos">
                      {r.photos.map((p, k) => <img key={k} src={p} alt={`Photo ${k + 1} from ${r.name}`} width={72} height={72} loading="lazy" decoding="async" />)}
                    </div>
                  )}
                  <dl className="fd-rgs-meta">
                    <div><dt>Skin</dt><dd>{r.skin}</dd></div>
                    <div><dt>Age</dt><dd>{r.age}</dd></div>
                    <div><dt>Used for</dt><dd>{r.used}</dd></div>
                  </dl>
                  <p className="fd-rgs-by">
                    <span className="fd-rgs-name">{r.name}</span>
                    {r.verified && <span className="fd-rgs-ver"><Check />Verified buyer</span>}
                  </p>
                  {r.reply && (
                    <div className="fd-rgs-reply">
                      <p className="fd-rgs-rf">{r.reply.from}</p>
                      <p className="fd-rgs-rx">{r.reply.text}</p>
                    </div>
                  )}
                  <footer className="fd-rgs-help">
                    <span>Helpful?</span>
                    <button type="button" className="fd-rgs-vote" aria-pressed={v === "up"} aria-label={`Yes, helpful (${r.helpful + (v === "up" ? 1 : 0)})`} onClick={() => vote(r.id, "up")}>
                      <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true"><path d="M4.5 6.2V12H2.2V6.2zM4.5 6.2L7 1.5c1 0 1.7.8 1.5 1.8L8.1 5.4h3.1c.8 0 1.4.8 1.2 1.6l-1 4c-.2.6-.7 1-1.3 1H4.5" fill={v === "up" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
                      <span key={"u" + (v === "up")} className="fd-rgs-n">{r.helpful + (v === "up" ? 1 : 0)}</span>
                    </button>
                    <button type="button" className="fd-rgs-vote" aria-pressed={v === "down"} aria-label={`No, not helpful (${r.unhelpful + (v === "down" ? 1 : 0)})`} onClick={() => vote(r.id, "down")}>
                      <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true" style={{ transform: "rotate(180deg)" }}><path d="M4.5 6.2V12H2.2V6.2zM4.5 6.2L7 1.5c1 0 1.7.8 1.5 1.8L8.1 5.4h3.1c.8 0 1.4.8 1.2 1.6l-1 4c-.2.6-.7 1-1.3 1H4.5" fill={v === "down" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
                      <span key={"d" + (v === "down")} className="fd-rgs-n">{r.unhelpful + (v === "down" ? 1 : 0)}</span>
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

const SANS = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const css = `
.fd-rgs,.fd-rgs *,.fd-rgs *::before,.fd-rgs *::after{box-sizing:border-box}
.fd-rgs{--fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;--fd-dur-4:700ms;
  --fd-rgs-bg:#FAFAF7;--fd-rgs-card:#FFFFFF;--fd-rgs-ink:#1B1D1A;--fd-rgs-mut:#6A6E66;--fd-rgs-line:#E7E5DF;--fd-rgs-line2:#D9D7D0;--fd-rgs-sage:#4E6B57;--fd-rgs-sage-bg:#E9EFE9;
  display:grid;grid-template-columns:300px minmax(0,1fr);gap:56px;max-width:1240px;margin:0 auto;padding:72px 32px 88px;background:var(--fd-rgs-bg);color:var(--fd-rgs-ink);
  font:400 15px/1.5 ${SANS};letter-spacing:-.003em;-webkit-font-smoothing:antialiased}
.fd-rgs button{font-family:inherit}
.fd-rgs-side{position:sticky;top:24px;align-self:start;margin:0;padding:0}
.fd-rgs-prod{display:flex;align-items:center;gap:14px;margin:0 0 32px;padding:0 0 20px;border-bottom:1px solid var(--fd-rgs-line)}
.fd-rgs-prod img{display:block;width:56px;height:72px;object-fit:cover;border-radius:6px;background:#E5E6E3}
.fd-rgs-pn{margin:0;padding:0;font:600 15px/1.3 ${SANS};letter-spacing:-.01em;color:var(--fd-rgs-ink)}
.fd-rgs-ps{margin:2px 0 0;padding:0;font:400 13px/1.3 ${SANS};color:var(--fd-rgs-mut)}
.fd-rgs-title{margin:0 0 12px;padding:0;font:600 12px/1 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:var(--fd-rgs-mut)}
.fd-rgs-avg{display:flex;align-items:center;gap:16px;margin:0 0 24px}
.fd-rgs-big{font:500 4rem/1 ${SANS};letter-spacing:-.05em;color:var(--fd-rgs-ink);font-variant-numeric:tabular-nums}
.fd-rgs-avgm{display:flex;flex-direction:column;gap:6px;font:400 13px/1.2 ${SANS};color:var(--fd-rgs-mut)}
.fd-rgs-stars{display:inline-flex;gap:2px;color:var(--fd-rgs-ink)}
.fd-rgs-stars svg{display:block}
.fd-rgs-dist{display:grid;gap:2px;margin:0 0 28px;padding:0;list-style:none}
.fd-rgs-dist li{margin:0;padding:0;list-style:none}
.fd-rgs-drow{appearance:none;-webkit-appearance:none;display:grid;grid-template-columns:28px 1fr 40px;align-items:center;gap:10px;width:100%;height:28px;margin:0;padding:0 6px;border:0;border-radius:6px;background:transparent;color:var(--fd-rgs-ink);cursor:pointer;text-align:left;
  font:500 13px/1 ${SANS};transition:background-color var(--fd-dur-1)}
.fd-rgs-drow:hover{background:#F0EFEA}
.fd-rgs-drow[aria-pressed="true"]{background:var(--fd-rgs-ink);color:#fff}
.fd-rgs-dl{display:inline-flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums}
.fd-rgs-dl svg{display:block}
.fd-rgs-track{display:block;height:6px;border-radius:9999px;background:var(--fd-rgs-line);overflow:hidden}
.fd-rgs-track i{display:block;height:100%;border-radius:inherit;background:currentColor;transform-origin:0 50%;transform:scaleX(var(--w));animation:fd-rgs-grow var(--fd-dur-4) var(--fd-ease-out) both}
.fd-rgs-drow[aria-pressed="true"] .fd-rgs-track{background:rgba(255,255,255,.22)}
@keyframes fd-rgs-grow{from{transform:scaleX(0)}}
.fd-rgs-dc{text-align:right;font:400 12px/1 ${SANS};color:inherit;opacity:.65;font-variant-numeric:tabular-nums}
.fd-rgs-facts{display:grid;grid-template-columns:1fr 1.3fr;gap:16px;margin:0 0 28px;padding:20px 0 0;border-top:1px solid var(--fd-rgs-line)}
.fd-rgs-facts div{margin:0;padding:0}
.fd-rgs-facts dt{margin:0 0 8px;padding:0;font:500 12px/1.2 ${SANS};color:var(--fd-rgs-mut)}
.fd-rgs-facts dd{margin:0;padding:0}
.fd-rgs-facts b{font:500 1.5rem/1 ${SANS};letter-spacing:-.03em;color:var(--fd-rgs-sage)}
.fd-rgs-scale{position:relative;display:block;height:6px;margin:8px 0 6px;border-radius:9999px;background:linear-gradient(90deg,var(--fd-rgs-line2),var(--fd-rgs-line))}
.fd-rgs-scale i{position:absolute;top:50%;display:block;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:var(--fd-rgs-card);box-shadow:0 0 0 2px var(--fd-rgs-ink)}
.fd-rgs-scl{display:flex;justify-content:space-between;font:400 11px/1 ${SANS};color:var(--fd-rgs-mut)}
.fd-rgs-write{display:flex;align-items:center;justify-content:center;height:44px;margin:0;padding:0 18px;border-radius:9999px;border:1px solid var(--fd-rgs-ink);background:transparent;color:var(--fd-rgs-ink);font:600 14px/1 ${SANS};text-decoration:none;
  transition:background-color var(--fd-dur-2),color var(--fd-dur-2),transform var(--fd-dur-2) var(--fd-spring)}
.fd-rgs-write:hover{background:var(--fd-rgs-ink);color:#fff}
.fd-rgs-write:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-rgs-main{min-width:0;margin:0;padding:0}
.fd-rgs-bar{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin:0 0 16px}
.fd-rgs-chips{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.fd-rgs-chip{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;gap:6px;height:34px;margin:0;padding:0 14px;border:1px solid var(--fd-rgs-line2);border-radius:9999px;background:var(--fd-rgs-card);color:var(--fd-rgs-ink);cursor:pointer;
  font:500 13px/1 ${SANS};letter-spacing:0;transition:background-color var(--fd-dur-1),border-color var(--fd-dur-1),color var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring)}
.fd-rgs-chip svg{display:block}
.fd-rgs-chip:hover{border-color:var(--fd-rgs-ink)}
.fd-rgs-chip:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-rgs-chip[aria-pressed="true"]{background:var(--fd-rgs-ink);border-color:var(--fd-rgs-ink);color:#fff}
.fd-rgs-chip[data-skin][aria-pressed="true"]{background:var(--fd-rgs-sage);border-color:var(--fd-rgs-sage)}
.fd-rgs-chip[aria-pressed="true"] .fd-rgs-ck{stroke:var(--fd-rgs-ink)}
.fd-rgs-sep{display:block;width:1px;height:20px;margin:0 4px;background:var(--fd-rgs-line2)}
.fd-rgs-sort{position:relative;display:inline-flex;align-items:center;gap:8px;flex:none;height:34px;margin:0;padding:0;font:500 13px/1 ${SANS};color:var(--fd-rgs-mut)}
.fd-rgs-sort select{appearance:none;-webkit-appearance:none;height:34px;margin:0;padding:0 30px 0 12px;border:1px solid var(--fd-rgs-line2);border-radius:9999px;background:var(--fd-rgs-card);color:var(--fd-rgs-ink);font:500 13px/1 ${SANS};cursor:pointer}
.fd-rgs-sort svg{position:absolute;right:12px;top:12px;display:block;pointer-events:none;color:var(--fd-rgs-ink)}
.fd-rgs-row{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 20px;padding:16px 0 0;border-top:1px solid var(--fd-rgs-line)}
.fd-rgs-count{display:flex;align-items:center;gap:12px;min-height:24px;margin:0;padding:0;font:400 13px/1.3 ${SANS};color:var(--fd-rgs-mut)}
.fd-rgs-count b{font-weight:600;color:var(--fd-rgs-ink)}
.fd-rgs-clear{appearance:none;-webkit-appearance:none;margin:0;padding:0;border:0;background:none;color:var(--fd-rgs-ink);cursor:pointer;font:600 13px/1.3 ${SANS};text-decoration:underline;text-underline-offset:3px}
.fd-rgs-grid{columns:2 300px;column-gap:16px}
.fd-rgs-card{display:block;break-inside:avoid;margin:0 0 16px;padding:22px 22px 14px;border:1px solid var(--fd-rgs-line);border-radius:14px;background:var(--fd-rgs-card);color:var(--fd-rgs-ink);animation:fd-rgs-in var(--fd-dur-3) var(--fd-ease-out) both}
@keyframes fd-rgs-in{from{opacity:0;transform:translateY(6px)}}
.fd-rgs-ch{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px}
.fd-rgs-date{font:400 12px/1 ${SANS};color:var(--fd-rgs-mut)}
.fd-rgs-rt{margin:0 0 6px;padding:0;font:600 1.0625rem/1.3 ${SANS};letter-spacing:-.015em;color:var(--fd-rgs-ink)}
.fd-rgs-body{margin:0;padding:0;font:400 0.9375rem/1.55 ${SANS};color:#3B3E39;text-wrap:pretty}
.fd-rgs-photos{display:flex;gap:8px;margin:14px 0 0}
.fd-rgs-photos img{display:block;width:72px;height:72px;object-fit:cover;border-radius:8px;background:#E5E6E3}
.fd-rgs-meta{display:flex;flex-wrap:wrap;gap:6px;margin:16px 0 0;padding:0}
.fd-rgs-meta div{display:flex;gap:5px;margin:0;padding:4px 9px;border-radius:6px;background:#F3F2EE;font:400 12px/1.3 ${SANS}}
.fd-rgs-meta dt{margin:0;padding:0;color:var(--fd-rgs-mut)}
.fd-rgs-meta dd{margin:0;padding:0;font-weight:500;color:var(--fd-rgs-ink)}
.fd-rgs-by{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:16px 0 0;padding:0;font:600 13px/1.3 ${SANS};color:var(--fd-rgs-ink)}
.fd-rgs-ver{display:inline-flex;align-items:center;gap:4px;font:500 12px/1 ${SANS};color:var(--fd-rgs-sage)}
.fd-rgs-ver svg{display:block}
.fd-rgs-reply{margin:14px 0 0;padding:12px 14px;border-left:2px solid var(--fd-rgs-sage);border-radius:0 8px 8px 0;background:var(--fd-rgs-sage-bg)}
.fd-rgs-rf{margin:0 0 4px;padding:0;font:600 12px/1.3 ${SANS};color:var(--fd-rgs-sage)}
.fd-rgs-rx{margin:0;padding:0;font:400 13px/1.5 ${SANS};color:#33403A}
.fd-rgs-help{display:flex;align-items:center;gap:6px;margin:16px 0 0;padding:12px 0 0;border-top:1px solid var(--fd-rgs-line);font:400 12px/1 ${SANS};color:var(--fd-rgs-mut)}
.fd-rgs-help>span{margin-right:4px}
.fd-rgs-vote{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;gap:6px;height:28px;margin:0;padding:0 10px;border:1px solid transparent;border-radius:9999px;background:transparent;color:var(--fd-rgs-mut);cursor:pointer;
  font:500 12px/1 ${SANS};font-variant-numeric:tabular-nums;transition:background-color var(--fd-dur-1),color var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring)}
.fd-rgs-vote svg{display:block}
.fd-rgs-vote:hover{background:#F3F2EE;color:var(--fd-rgs-ink)}
.fd-rgs-vote:active{transform:scale(.96);transition-duration:var(--fd-dur-1)}
.fd-rgs-vote[aria-pressed="true"]{border-color:var(--fd-rgs-ink);color:var(--fd-rgs-ink);background:var(--fd-rgs-card)}
.fd-rgs-vote[aria-pressed="true"] .fd-rgs-n{animation:fd-rgs-tick var(--fd-dur-3) var(--fd-spring) both}
.fd-rgs-n{display:inline-block}
@keyframes fd-rgs-tick{from{transform:translateY(60%);opacity:0}}
.fd-rgs-empty{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:40px 24px;border:1px dashed var(--fd-rgs-line2);border-radius:14px}
.fd-rgs-empty p{margin:0;padding:0;font:500 15px/1.4 ${SANS};color:var(--fd-rgs-ink)}
.fd-rgs :focus-visible{outline:2px solid rgba(78,107,87,.75);outline-offset:2px}
@media (max-width:900px){
  .fd-rgs{grid-template-columns:1fr;gap:32px;padding:48px 16px 64px}
  .fd-rgs-side{position:static}
  .fd-rgs-prod{margin-bottom:24px}
  .fd-rgs-bar{flex-direction:column;align-items:stretch}
  .fd-rgs-chips{flex-wrap:nowrap;overflow-x:auto;margin:0 -16px;padding:0 16px 2px;scrollbar-width:none}
  .fd-rgs-chips::-webkit-scrollbar{display:none}
  .fd-rgs-chip{flex:none}
  .fd-rgs-count{flex-wrap:wrap}
}
@media (prefers-reduced-motion:reduce){.fd-rgs *{animation:none!important;transition-duration:1ms!important}}
@media (prefers-contrast:more){.fd-rgs{--fd-rgs-line:#8B8E86;--fd-rgs-mut:#4A4D47}}
`;

export function Demo() {
  return (
    <div className="fd-rgsd">
      <style>{demoCss}</style>
      <header className="fd-rgsd-bar">
        <span className="fd-rgsd-logo">PRISM</span>
        <nav className="fd-rgsd-crumb" aria-label="Breadcrumb"><a href="#face">Face</a><span aria-hidden="true">/</span><a href="#moisturisers">Moisturisers</a><span aria-hidden="true">/</span><span aria-current="page">Barrier Balm</span></nav>
        <a className="fd-rgsd-bag" href="#bag">Bag (1)</a>
      </header>
      <ReviewGridSummary />
    </div>
  );
}

const demoCss = `
.fd-rgsd,.fd-rgsd *{box-sizing:border-box}
.fd-rgsd{min-height:100vh;margin:0;padding:0;background:#FAFAF7;color:#1B1D1A;font:400 14px/1.4 ${SANS}}
.fd-rgsd-bar{display:flex;align-items:center;gap:28px;max-width:1240px;height:60px;margin:0 auto;padding:0 32px;border-bottom:1px solid #E7E5DF}
.fd-rgsd-logo{font:600 16px/1 ${SANS};letter-spacing:.32em;color:#1B1D1A}
.fd-rgsd-crumb{display:flex;align-items:center;gap:8px;font:400 13px/1 ${SANS};color:#6A6E66}
.fd-rgsd-crumb a{color:#6A6E66;text-decoration:none}.fd-rgsd-crumb a:hover{color:#1B1D1A}
.fd-rgsd-crumb [aria-current]{color:#1B1D1A}
.fd-rgsd-bag{margin-left:auto;font:500 13px/1 ${SANS};color:#1B1D1A;text-decoration:none}
.fd-rgsd a:focus-visible{outline:2px solid rgba(78,107,87,.75);outline-offset:2px}
@media (max-width:900px){.fd-rgsd-bar{padding:0 16px}.fd-rgsd-crumb{display:none}}
`;
