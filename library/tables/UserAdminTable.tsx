/**
 * UserAdminTable, a team-admin table: photo avatars (initials fallback) with a presence dot,
 * an inline role dropdown, status pills, search plus filter chips, and a row
 * actions menu that appears on hover or focus.
 *
 * Props: users, roles, onRoleChange(id, role), onAction(id, action),
 * theme. Actions: "edit" | "resend" | "suspend" | "reactivate" | "remove".
 * Controlled data: pass `users` and update it from the callbacks.
 *
 * Browser support: all evergreen browsers. Popovers use position: fixed so they
 * escape the scroll container; they close on scroll and resize.
 * Accessibility: native table semantics; the role trigger is a menu button
 * (aria-haspopup="menu", aria-expanded) opening a menuitemradio group; the
 * actions trigger is a labelled menu button. Arrow keys / Home / End move,
 * Enter or Space selects, Escape closes and returns focus, Tab closes.
 * Filter chips are toggle buttons (aria-pressed) with counts; results are
 * announced in a polite live region. Row actions stay visible on touch and
 * whenever focus is inside the row.
 * Reduced motion: popovers fade without movement.
 * Demo images: /img/people/pN.webp (in the repo's public/img/people, copy next to your page or swap in your own).
 * Set `avatar` on a user to show a photo; without it the initials badge shows.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

export type UserStatus = "active" | "invited" | "suspended";
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: UserStatus;
  lastActive: string;
  /** Optional photo URL; falls back to initials. */
  avatar?: string;
}
export type UserAction = "edit" | "resend" | "suspend" | "reactivate" | "remove";

export interface UserAdminTableProps {
  users: AdminUser[];
  roles?: { id: string; label: string; hint: string }[];
  onRoleChange?: (id: string, role: string) => void;
  onAction?: (id: string, action: UserAction) => void;
  theme?: "light" | "dark";
  className?: string;
}

const DEFAULT_ROLES = [
  { id: "owner", label: "Owner", hint: "Full access, billing and deletion" },
  { id: "admin", label: "Admin", hint: "Manage members and settings" },
  { id: "member", label: "Member", hint: "Create and edit projects" },
  { id: "viewer", label: "Viewer", hint: "Read-only access" },
];

const hue = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const STATUS = { active: "Active", invited: "Invited", suspended: "Suspended" } as const;

type Pop = { id: string; kind: "role" | "actions"; x: number; y: number; w: number; up: boolean } | null;

/** Tracks whether the table's own container is narrow, so hidden columns are not rendered at all (keeps colSpan rows correct). */
function useNarrow(max: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const f = () => setNarrow(el.clientWidth <= max);
    f();
    const ro = new ResizeObserver(f);
    ro.observe(el);
    return () => ro.disconnect();
  }, [max]);
  return [ref, narrow] as const;
}
export function UserAdminTable({ users, roles = DEFAULT_ROLES, onRoleChange, onAction, theme, className }: UserAdminTableProps) {
  const uid = useId();
  const [cardRef, narrow] = useNarrow(640);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | UserStatus | "admins">("all");
  const [pop, setPop] = useState<Pop>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const menu = useRef<HTMLDivElement>(null);

  const counts = useMemo(
    () => ({
      all: users.length,
      admins: users.filter((u) => u.role === "owner" || u.role === "admin").length,
      active: users.filter((u) => u.status === "active").length,
      invited: users.filter((u) => u.status === "invited").length,
      suspended: users.filter((u) => u.status === "suspended").length,
    }),
    [users],
  );

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === "admins" ? !(u.role === "owner" || u.role === "admin") : filter !== "all" && u.status !== filter) return false;
      return !t || (u.name + " " + u.email).toLowerCase().includes(t);
    });
  }, [users, q, filter]);

  const close = useCallback((restore = true) => {
    setPop(null);
    if (restore) requestAnimationFrame(() => trigger.current?.focus());
  }, []);

  const open = (e: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>, id: string, kind: "role" | "actions", h: number) => {
    const el = e.currentTarget;
    trigger.current = el;
    if (pop && pop.id === id && pop.kind === kind) return close();
    const r = el.getBoundingClientRect();
    const w = kind === "role" ? 264 : 232;
    const up = window.innerHeight - r.bottom < h + 16 && r.top > h + 16;
    const x = Math.max(8, Math.min(kind === "role" ? r.left : r.right - w, window.innerWidth - w - 8));
    setPop({ id, kind, x, y: up ? r.top - 6 : r.bottom + 6, w, up });
  };

  useEffect(() => {
    if (!pop) return;
    const items = () => [...(menu.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? [])];
    const cur = items().find((i) => i.getAttribute("aria-checked") === "true") ?? items()[0];
    cur?.focus();
    const dismiss = (e: Event) => {
      if (!menu.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setPop(null);
    };
    const away = () => setPop(null);
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", away);
    window.addEventListener("scroll", away, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", away);
      window.removeEventListener("scroll", away, true);
    };
  }, [pop?.id, pop?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    // the menu measures after mount: if it would overflow the bottom, nudge up
    const m = menu.current;
    if (!m || !pop || pop.up) return;
    const r = m.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 8) m.style.top = `${Math.max(8, window.innerHeight - r.height - 8)}px`;
  }, [pop]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const list = [...(menu.current?.querySelectorAll<HTMLElement>("[role^=menuitem]:not([disabled])") ?? [])];
    const i = list.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => (list[(n + list.length) % list.length] as HTMLElement).focus();
    if (e.key === "ArrowDown") { e.preventDefault(); go(i + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); go(i - 1); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(list.length - 1); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Tab") close(false);
  };

  const target = pop ? users.find((u) => u.id === pop.id) : undefined;
  const run = (a: UserAction) => {
    if (!target) return;
    onAction?.(target.id, a);
    close(a !== "remove");
  };

  const chips: { id: typeof filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "admins", label: "Admins" },
    { id: "active", label: "Active" },
    { id: "invited", label: "Invited" },
    { id: "suspended", label: "Suspended" },
  ];

  return (
    <div className={`fd-ua${className ? " " + className : ""}`} data-fd-theme={theme}>
      <style>{css}</style>
      <div className="fd-ua-tools">
        <label className="fd-ua-search">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" aria-label="Search members" />
        </label>
        <div className="fd-ua-chips" role="group" aria-label="Filter members">
          {chips.map((c) => (
            <button key={c.id} type="button" className="fd-ua-chip" aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>
              {c.label}<span>{counts[c.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="fd-ua-card" ref={cardRef}>
        <div className="fd-ua-scroll" role="region" aria-label="Team members, scrollable" tabIndex={0}>
          <table className="fd-ua-table">
            <caption className="fd-ua-sr">Team members</caption>
            <thead>
              <tr>
                <th scope="col" className="fd-ua-th">Member</th>
                <th scope="col" className="fd-ua-th" style={{ width: 176 }}>Role</th>
                {!narrow && <th scope="col" className="fd-ua-th" style={{ width: 128 }}>Status</th>}
                {!narrow && <th scope="col" className="fd-ua-th" style={{ width: 128 }}>Last active</th>}
                <th scope="col" className="fd-ua-th" style={{ width: 56 }}><span className="fd-ua-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const rl = roles.find((r) => r.id === u.role);
                const isOpen = pop?.id === u.id;
                return (
                  <tr key={u.id} className="fd-ua-row" data-open={isOpen ? "" : undefined} data-s={u.status}>
                    <td className="fd-ua-td">
                      <div className="fd-ua-who">
                        <span className="fd-ua-av" style={{ ["--h" as string]: hue(u.name) }} aria-hidden="true">
                          {u.avatar ? <img src={u.avatar} alt="" width={36} height={36} loading="lazy" decoding="async" /> : initials(u.name)}
                          <i className="fd-ua-dot" data-s={u.status} />
                        </span>
                        <span className="fd-ua-nm"><b>{u.name}</b><small>{u.email}</small></span>
                      </div>
                    </td>
                    <td className="fd-ua-td">
                      <button
                        type="button"
                        className="fd-ua-role"
                        aria-haspopup="menu"
                        aria-expanded={isOpen && pop?.kind === "role"}
                        aria-label={`Role for ${u.name}: ${rl?.label}. Change role`}
                        disabled={u.role === "owner"}
                        onClick={(e) => open(e, u.id, "role", roles.length * 52 + 12)}
                        onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); open(e, u.id, "role", roles.length * 52 + 12); } }}
                      >
                        <span>{rl?.label ?? u.role}</span>
                        {u.role !== "owner" && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 4.5l3 3 3-3" /></svg>}
                      </button>
                    </td>
                    {!narrow && <td className="fd-ua-td"><span className="fd-ua-pill" data-s={u.status}><i />{STATUS[u.status]}</span></td>}
                    {!narrow && <td className="fd-ua-td fd-ua-mut">{u.lastActive}</td>}
                    <td className="fd-ua-td fd-ua-end">
                      <button
                        type="button"
                        className="fd-ua-more"
                        aria-haspopup="menu"
                        aria-expanded={isOpen && pop?.kind === "actions"}
                        aria-label={`Actions for ${u.name}`}
                        onClick={(e) => open(e, u.id, "actions", 5 * 40 + 16)}
                        onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); open(e, u.id, "actions", 5 * 40 + 16); } }}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3.5" cy="8" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="12.5" cy="8" r="1.3" /></svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td className="fd-ua-empty" colSpan={narrow ? 3 : 5}>
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="14" cy="13" r="5" /><path d="M5 29c1-5 5-8 9-8s8 3 9 8M24 10c3 0 5 2 5 5M26 21c3 .8 5 3 6 6" /></svg>
                    <b>No members found</b>
                    <span>{q ? `Nobody matches “${q}”.` : "No one has this status yet."}</span>
                    <button type="button" className="fd-ua-reset" onClick={() => { setQ(""); setFilter("all"); }}>Reset filters</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="fd-ua-foot"><span>Showing <b>{rows.length}</b> of {users.length} members</span></div>
      </div>
      <div className="fd-ua-sr" role="status" aria-live="polite">{`${rows.length} ${rows.length === 1 ? "member" : "members"} shown`}</div>

      {pop && target && (
        <div
          ref={menu}
          id={`${uid}-menu`}
          role="menu"
          aria-label={pop.kind === "role" ? `Role for ${target.name}` : `Actions for ${target.name}`}
          className="fd-ua-menu"
          data-fd-theme={theme}
          data-up={pop.up ? "" : undefined}
          style={{ left: pop.x, top: pop.up ? undefined : pop.y, bottom: pop.up ? window.innerHeight - pop.y : undefined, width: pop.w }}
          onKeyDown={onMenuKey}
        >
          {pop.kind === "role" ? (
            roles.map((r) => (
              <button
                key={r.id}
                type="button"
                role="menuitemradio"
                aria-checked={r.id === target.role}
                className="fd-ua-mi fd-ua-mi-role"
                disabled={r.id === "owner"}
                onClick={() => { onRoleChange?.(target.id, r.id); close(); }}
              >
                <span className="fd-ua-mt"><b>{r.label}</b><small>{r.hint}</small></span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>
              </button>
            ))
          ) : (
            <>
              <button type="button" role="menuitem" className="fd-ua-mi" onClick={() => run("edit")}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 13.5l.7-3L10.8 3a1.4 1.4 0 012 2l-7.6 7.6z" /></svg>Edit profile
              </button>
              {target.status === "invited" && (
                <button type="button" role="menuitem" className="fd-ua-mi" onClick={() => run("resend")}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3.5" width="12" height="9" rx="2" /><path d="M2.5 5l5.5 4 5.5-4" /></svg>Resend invite
                </button>
              )}
              {target.status !== "invited" && target.role !== "owner" && (
                <button type="button" role="menuitem" className="fd-ua-mi" onClick={() => run(target.status === "suspended" ? "reactivate" : "suspend")}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="5.5" /><path d={target.status === "suspended" ? "M6.5 5.5v5l4-2.5z" : "M4.2 11.8l7.6-7.6"} /></svg>
                  {target.status === "suspended" ? "Reactivate" : "Suspend access"}
                </button>
              )}
              {target.role !== "owner" && (
                <>
                  <div className="fd-ua-sep" role="separator" />
                  <button type="button" role="menuitem" className="fd-ua-mi" data-danger="" onClick={() => run("remove")}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 4.5h11M6 4.5V3a1 1 0 011-1h2a1 1 0 011 1v1.5M4 4.5l.6 8a1 1 0 001 .9h4.8a1 1 0 001-.9l.6-8" /></svg>Remove from workspace
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const css = `
:where(.fd-ua,.fd-ua *,.fd-ua-menu,.fd-ua-menu *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;border:0;background:none}
:where(.fd-ua,.fd-ua *,.fd-ua-menu,.fd-ua-menu *)::before,:where(.fd-ua,.fd-ua *,.fd-ua-menu,.fd-ua-menu *)::after{box-sizing:border-box}
:where(.fd-ua svg,.fd-ua-menu svg){display:block;flex-shrink:0}
:where(.fd-ua button,.fd-ua input,.fd-ua-menu button){appearance:none;-webkit-appearance:none;outline:0;border-radius:0;cursor:pointer}
:where(.fd-ua table){border-collapse:separate;border-spacing:0}
.fd-ua,.fd-ua-menu{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --u-bg:#fff;--u-head:#FAFAF9;--u-fg:#16151A;--u-mut:#6E6B78;--u-line:rgba(22,21,26,.08);--u-line2:rgba(22,21,26,.16);--u-hover:rgba(22,21,26,.03);--u-accent:#0F766E;--u-ring:rgba(15,118,110,.5);--u-pop:#fff;
  font:400 14px/20px ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.006em;color:var(--u-fg);-webkit-font-smoothing:antialiased}
[data-fd-theme="dark"].fd-ua,[data-fd-theme="dark"] .fd-ua,.fd-ua-menu[data-fd-theme="dark"]{--u-bg:#131217;--u-head:#17161C;--u-fg:#F3F2F6;--u-mut:#9F9CAB;--u-line:rgba(255,255,255,.07);--u-line2:rgba(255,255,255,.16);--u-hover:rgba(255,255,255,.035);--u-accent:#2DD4BF;--u-ring:rgba(45,212,191,.55);--u-pop:#1D1C23}
.fd-ua{width:100%}
.fd-ua-tools{display:flex;align-items:center;justify-content:space-between;gap:12px 16px;flex-wrap:wrap;margin-bottom:12px}
.fd-ua-search{position:relative;display:block;flex:1 1 240px;max-width:320px}
.fd-ua-search svg{position:absolute;left:12px;top:10px;color:var(--u-mut);pointer-events:none}
.fd-ua-search input{width:100%;height:36px;padding:0 12px 0 36px;border-radius:10px;background:var(--u-bg);box-shadow:0 0 0 1px var(--u-line2),0 1px 2px rgba(22,21,26,.04);font-size:14px;color:var(--u-fg);cursor:text;transition:box-shadow var(--fd-dur-1)}
.fd-ua-search input::placeholder{color:var(--u-mut)}
.fd-ua-search input:focus-visible{box-shadow:0 0 0 1.5px var(--u-accent),0 0 0 4px var(--u-ring)}
.fd-ua-chips{display:flex;gap:6px;flex-wrap:wrap}
.fd-ua-chip{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:9999px;font-size:13px;font-weight:500;line-height:1;color:var(--u-mut);box-shadow:inset 0 0 0 1px var(--u-line2);transition:background-color var(--fd-dur-1),color var(--fd-dur-1),box-shadow var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring)}
.fd-ua-chip span{font-size:12px;font-variant-numeric:tabular-nums;opacity:.65}
@media (hover:hover){.fd-ua-chip:hover:not([aria-pressed=true]){color:var(--u-fg);background:var(--u-hover)}}
.fd-ua-chip:active{transform:scale(.96)}
.fd-ua-chip[aria-pressed=true]{background:var(--u-fg);color:var(--u-bg);box-shadow:none}
.fd-ua-chip:focus-visible,.fd-ua-role:focus-visible,.fd-ua-more:focus-visible,.fd-ua-reset:focus-visible{box-shadow:0 0 0 2px var(--u-bg),0 0 0 4px var(--u-ring)}
.fd-ua-card{border-radius:16px;background:var(--u-bg);overflow:hidden;box-shadow:0 0 0 1px var(--u-line),0 1px 2px rgba(22,21,26,.04),0 12px 32px -16px rgba(22,21,26,.12);container-type:inline-size}
.fd-ua-scroll{overflow-x:auto}.fd-ua-scroll:focus-visible{outline:2px solid var(--u-ring);outline-offset:-2px}
.fd-ua-table{width:100%;table-layout:fixed;min-width:520px}
.fd-ua-th{height:40px;padding:0 16px;background:var(--u-head);font-size:12px;line-height:16px;font-weight:500;color:var(--u-mut);text-align:left;box-shadow:inset 0 -1px 0 var(--u-line);white-space:nowrap}
.fd-ua-td{height:64px;padding:0 16px;border-bottom:1px solid var(--u-line);vertical-align:middle;white-space:nowrap;overflow:visible;transition:background-color var(--fd-dur-1)}
.fd-ua-row:last-child .fd-ua-td{border-bottom-color:transparent}
@media (hover:hover){.fd-ua-row:hover .fd-ua-td{background:var(--u-hover)}}
.fd-ua-row[data-open] .fd-ua-td{background:var(--u-hover)}
.fd-ua-row[data-s="suspended"] .fd-ua-nm,.fd-ua-row[data-s="suspended"] .fd-ua-av{opacity:.55}
.fd-ua-mut{color:var(--u-mut);font-variant-numeric:tabular-nums}
.fd-ua-who{display:flex;align-items:center;gap:12px;min-width:0}
.fd-ua-av img{position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:cover;object-position:center top}
.fd-ua-av{position:relative;display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:50%;font-size:13px;font-weight:600;letter-spacing:0;color:hsl(var(--h) 50% 28%);background:hsl(var(--h) 70% 90%);box-shadow:inset 0 0 0 1px hsl(var(--h) 50% 40% / .12)}
[data-fd-theme="dark"] .fd-ua-av,[data-fd-theme="dark"].fd-ua .fd-ua-av{color:hsl(var(--h) 80% 85%);background:hsl(var(--h) 35% 24%)}
.fd-ua-dot{position:absolute;right:-1px;bottom:-1px;width:11px;height:11px;border-radius:50%;background:#16A34A;box-shadow:0 0 0 2px var(--u-bg)}
.fd-ua-dot[data-s="invited"]{background:#D97706}.fd-ua-dot[data-s="suspended"]{background:#9CA3AF}
.fd-ua-nm{display:flex;flex-direction:column;min-width:0}
.fd-ua-nm b{font-weight:500;overflow:hidden;text-overflow:ellipsis}
.fd-ua-nm small{font-size:13px;line-height:18px;color:var(--u-mut);overflow:hidden;text-overflow:ellipsis}
.fd-ua-role{display:inline-flex;align-items:center;gap:6px;height:32px;margin-left:-10px;padding:0 10px;border-radius:9px;font-size:14px;line-height:1;font-weight:500;transition:background-color var(--fd-dur-1),box-shadow var(--fd-dur-1)}
.fd-ua-role svg{color:var(--u-mut);transition:transform var(--fd-dur-2) var(--fd-ease-out)}
.fd-ua-role[aria-expanded=true] svg{transform:rotate(180deg)}
@media (hover:hover){.fd-ua-role:hover:not(:disabled){box-shadow:inset 0 0 0 1px var(--u-line2);background:var(--u-bg)}}
.fd-ua-role[aria-expanded=true]{box-shadow:inset 0 0 0 1px var(--u-line2);background:var(--u-bg)}
.fd-ua-role:disabled{cursor:default;color:var(--u-mut)}
.fd-ua-pill{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px 0 8px;border-radius:9999px;font-size:12px;font-weight:500;line-height:1;--c:#15803D;color:var(--c);background:color-mix(in srgb,var(--c) 11%,transparent)}
.fd-ua-pill i{width:6px;height:6px;border-radius:50%;background:currentColor}
.fd-ua-pill[data-s="invited"]{--c:#B45309}.fd-ua-pill[data-s="suspended"]{--c:#6B7280}
[data-fd-theme="dark"] .fd-ua-pill{--c:#4ADE80}[data-fd-theme="dark"] .fd-ua-pill[data-s="invited"]{--c:#FBBF24}[data-fd-theme="dark"] .fd-ua-pill[data-s="suspended"]{--c:#A1A1AA}
.fd-ua-end{text-align:right}
.fd-ua-more{display:inline-grid;place-items:center;width:32px;height:32px;border-radius:9px;color:var(--u-mut);opacity:0;transform:scale(.92);transition:opacity var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-spring),background-color var(--fd-dur-1),color var(--fd-dur-1)}
.fd-ua-row:hover .fd-ua-more,.fd-ua-row:focus-within .fd-ua-more,.fd-ua-more[aria-expanded=true]{opacity:1;transform:none}
.fd-ua-more:hover{background:var(--u-line);color:var(--u-fg)}
.fd-ua-more[aria-expanded=true]{background:var(--u-line);color:var(--u-fg)}
@media (hover:none){.fd-ua-more{opacity:1;transform:none}}
.fd-ua-empty{height:280px;text-align:center;color:var(--u-mut);padding:0}
.fd-ua-empty svg{margin:0 auto 12px;opacity:.7}
.fd-ua-empty b{display:block;font-size:15px;line-height:20px;font-weight:600;color:var(--u-fg)}
.fd-ua-empty span{display:block;margin-top:4px;font-size:13px}
.fd-ua-reset{margin-top:16px;height:32px;padding:0 12px;border-radius:9px;font-size:13px;font-weight:500;line-height:1;color:var(--u-fg);box-shadow:inset 0 0 0 1px var(--u-line2)}
.fd-ua-foot{display:flex;align-items:center;min-height:48px;padding:0 16px;border-top:1px solid var(--u-line);font-size:13px;color:var(--u-mut);font-variant-numeric:tabular-nums}.fd-ua-foot b{font-weight:500;color:var(--u-fg)}
.fd-ua-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.fd-ua-menu{position:fixed;z-index:1000;padding:6px;border-radius:14px;background:var(--u-pop);box-shadow:0 0 0 1px var(--u-line2),0 2px 4px rgba(22,21,26,.06),0 16px 40px -8px rgba(22,21,26,.28);animation:fd-ua-in var(--fd-dur-2) var(--fd-ease-out);transform-origin:top left}
.fd-ua-menu[data-up]{transform-origin:bottom left}
.fd-ua-mi{white-space:nowrap;display:flex;align-items:center;gap:10px;width:100%;min-height:36px;padding:0 10px;border-radius:9px;text-align:left;font-size:14px;line-height:20px;font-weight:450;color:var(--u-fg);transition:background-color 80ms}
.fd-ua-mi svg{color:var(--u-mut)}
.fd-ua-mi:hover:not(:disabled),.fd-ua-mi:focus{background:var(--u-hover);background:color-mix(in srgb,var(--u-fg) 6%,transparent);outline:0}
.fd-ua-mi:disabled{opacity:.45;cursor:default}
.fd-ua-mi[data-danger],.fd-ua-mi[data-danger] svg{color:#C2271B}
[data-fd-theme="dark"].fd-ua-menu .fd-ua-mi[data-danger],[data-fd-theme="dark"].fd-ua-menu .fd-ua-mi[data-danger] svg{color:#FF8A7A}
.fd-ua-mi-role{min-height:52px;padding:6px 10px}
.fd-ua-mt{display:flex;flex-direction:column;flex:1;min-width:0}.fd-ua-mt b{font-weight:500}.fd-ua-mt small{font-size:12px;line-height:16px;color:var(--u-mut)}
.fd-ua-mi-role>svg{color:var(--u-accent);opacity:0;transform:scale(.6);transition:opacity var(--fd-dur-1),transform var(--fd-dur-2) var(--fd-spring)}
.fd-ua-mi-role[aria-checked=true]>svg{opacity:1;transform:none}
.fd-ua-sep{height:1px;margin:6px -6px;background:var(--u-line)}
@keyframes fd-ua-in{from{opacity:0;transform:translateY(-4px) scale(.97)}}
.fd-ua-menu[data-up]{animation-name:fd-ua-in-up}@keyframes fd-ua-in-up{from{opacity:0;transform:translateY(4px) scale(.97)}}
@container (max-width:640px){[data-nh]{display:none}.fd-ua-table{min-width:0}.fd-ua-th,.fd-ua-td{padding:0 12px}.fd-ua-th:nth-child(2){width:116px!important}.fd-ua-th:last-child{width:48px!important}.fd-ua-more{margin-right:-4px}}
@media (prefers-reduced-motion:reduce){.fd-ua *,.fd-ua-menu{transition-duration:1ms!important;animation:none!important}.fd-ua-more{transform:none}}
@media (prefers-contrast:more){.fd-ua-card{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const SEED: AdminUser[] = [
  { id: "u1", name: "Priya Raman", email: "priya@parcelhq.com", role: "owner", status: "active", lastActive: "Just now", avatar: "/img/people/p6.webp" },
  { id: "u2", name: "Mateo Alvarez", email: "mateo@parcelhq.com", role: "admin", status: "active", lastActive: "12 min ago", avatar: "/img/people/p4.webp" },
  { id: "u3", name: "Hannah Okafor", email: "hannah.okafor@parcelhq.com", role: "member", status: "active", lastActive: "2 hours ago", avatar: "/img/people/p3.webp" },
  { id: "u4", name: "Jonas Lindqvist", email: "jonas@lindqvist.studio", role: "member", status: "invited", lastActive: "Never", avatar: "/img/people/p5.webp" },
  { id: "u5", name: "Kenji Tanabe", email: "kenji@parcelhq.com", role: "admin", status: "active", lastActive: "Yesterday", avatar: "/img/people/p8.webp" },
  { id: "u6", name: "Samira Haddad", email: "samira.haddad@parcelhq.com", role: "member", status: "active", lastActive: "Yesterday", avatar: "/img/people/p9.webp" },
  { id: "u7", name: "Devon Whitaker", email: "devon@whitakerlogistics.co", role: "viewer", status: "active", lastActive: "3 days ago", avatar: "/img/people/p2.webp" },
  { id: "u8", name: "Lucía Fernández", email: "lucia@parcelhq.com", role: "member", status: "suspended", lastActive: "Sep 14", avatar: "/img/people/p1.webp" },
  { id: "u9", name: "Tobias Reuter", email: "t.reuter@parcelhq.com", role: "viewer", status: "invited", lastActive: "Never", avatar: "/img/people/p7.webp" },
  { id: "u10", name: "Naledi Dlamini", email: "naledi@parcelhq.com", role: "member", status: "active", lastActive: "5 days ago", avatar: "/img/people/p6.webp" },
];

export function Demo() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [users, setUsers] = useState(SEED);
  const [note, setNote] = useState<{ text: string; undo?: () => void } | null>(null);
  const timer = useRef<number>(0);
  const say = (text: string, undo?: () => void) => {
    setNote({ text, undo });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNote(null), 6000);
  };
  const seats = users.filter((u) => u.status !== "suspended").length;

  return (
    <div className="fd-uad" data-fd-theme={theme}>
      <style>{demoCss}</style>
      <aside className="fd-uad-side" aria-label="Workspace">
        <div className="fd-uad-ws"><span className="fd-uad-mark" aria-hidden="true">P</span><span><b>Parcel</b><small>Workspace</small></span></div>
        <nav aria-label="Settings">
          <a href="#general">General</a>
          <a href="#members" aria-current="page">Members</a>
          <a href="#billing">Billing</a>
          <a href="#integrations">Integrations</a>
          <a href="#security">Security</a>
        </nav>
        <button type="button" className="fd-uad-theme" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Light" : "Dark"} theme</button>
      </aside>
      <main className="fd-uad-main">
        <header className="fd-uad-head">
          <div><h1>Members</h1><p>Control who can access Parcel and what they can do.</p></div>
          <button type="button" className="fd-uad-invite" onClick={() => say("Invite link copied to your clipboard.")}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>Invite member
          </button>
        </header>
        <div className="fd-uad-seats" role="group" aria-label="Seat usage">
          <div><b>{seats}</b> of 12 seats in use<small>Suspended members don’t use a seat.</small></div>
          <div className="fd-uad-meter" role="meter" aria-valuemin={0} aria-valuemax={12} aria-valuenow={seats} aria-label="Seats used"><i style={{ width: `${(seats / 12) * 100}%` }} /></div>
        </div>
        <UserAdminTable
          theme={theme}
          users={users}
          onRoleChange={(id, role) => {
            const u = users.find((x) => x.id === id)!;
            setUsers((p) => p.map((x) => (x.id === id ? { ...x, role } : x)));
            say(`${u.name} is now ${role === "admin" ? "an" : "a"} ${role}.`);
          }}
          onAction={(id, a) => {
            const u = users.find((x) => x.id === id)!;
            if (a === "remove") {
              const idx = users.findIndex((x) => x.id === id);
              setUsers((p) => p.filter((x) => x.id !== id));
              say(`Removed ${u.name} from Parcel.`, () => { setUsers((p) => { const n = [...p]; n.splice(idx, 0, u); return n; }); setNote(null); });
            } else if (a === "suspend" || a === "reactivate") {
              setUsers((p) => p.map((x) => (x.id === id ? { ...x, status: a === "suspend" ? "suspended" : "active" } : x)));
              say(`${u.name} was ${a === "suspend" ? "suspended" : "reactivated"}.`);
            } else if (a === "resend") say(`Invite re-sent to ${u.email}.`);
            else say(`Opened ${u.name}’s profile.`);
          }}
        />
        <div className="fd-uad-toast" data-open={note ? "" : undefined} role="status" aria-live="polite">
          {note && (<><span>{note.text}</span>{note.undo && <button type="button" onClick={note.undo}>Undo</button>}</>)}
        </div>
      </main>
    </div>
  );
}

const demoCss = `
:where(.fd-uad,.fd-uad *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none;border:0;background:none}
:where(.fd-uad,.fd-uad *)::before,:where(.fd-uad,.fd-uad *)::after{box-sizing:border-box}
:where(.fd-uad svg){display:block;flex-shrink:0}
:where(.fd-uad button){appearance:none;-webkit-appearance:none;outline:0;border-radius:0;cursor:pointer}
.fd-uad{--fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);
  --d-bg:#F7F6F4;--d-side:#FBFAF9;--d-fg:#16151A;--d-mut:#6E6B78;--d-line:rgba(22,21,26,.08);--d-accent:#0F766E;--d-ring:rgba(15,118,110,.5);--d-card:#fff;
  display:grid;grid-template-columns:232px minmax(0,1fr);min-height:100vh;background:var(--d-bg);color:var(--d-fg);font:400 14px/20px ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.006em;-webkit-font-smoothing:antialiased}
.fd-uad[data-fd-theme="dark"]{--d-bg:#0D0C10;--d-side:#111015;--d-fg:#F3F2F6;--d-mut:#9F9CAB;--d-line:rgba(255,255,255,.07);--d-accent:#2DD4BF;--d-ring:rgba(45,212,191,.55);--d-card:#131217}
.fd-uad-side{display:flex;flex-direction:column;gap:20px;padding:16px 12px;background:var(--d-side);box-shadow:inset -1px 0 0 var(--d-line)}
.fd-uad-ws{display:flex;align-items:center;gap:10px;padding:4px 8px}
.fd-uad-mark{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:var(--d-accent);color:var(--d-card);font-weight:700;font-size:14px}
.fd-uad-ws b{display:block;font-weight:600;line-height:16px}.fd-uad-ws small{display:block;font-size:12px;line-height:16px;color:var(--d-mut)}
.fd-uad-side nav{display:flex;flex-direction:column;gap:2px}
.fd-uad-side nav a{display:flex;align-items:center;height:32px;padding:0 10px;border-radius:8px;font-weight:500;color:var(--d-mut);transition:background-color 120ms,color 120ms}
.fd-uad-side nav a:hover{background:var(--d-line);color:var(--d-fg)}.fd-uad-side nav a[aria-current]{background:var(--d-line);color:var(--d-fg)}
.fd-uad a:focus-visible,.fd-uad-theme:focus-visible,.fd-uad-invite:focus-visible,.fd-uad-toast button:focus-visible{outline:2px solid var(--d-ring);outline-offset:2px}
.fd-uad-theme{margin-top:auto;height:32px;padding:0 10px;border-radius:8px;text-align:left;font-size:13px;font-weight:500;color:var(--d-mut)}.fd-uad-theme:hover{background:var(--d-line);color:var(--d-fg)}
.fd-uad-main{min-width:0;padding:32px clamp(16px,3vw,40px) 80px;max-width:1040px;width:100%}
.fd-uad-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
.fd-uad-head h1{font-size:24px;line-height:32px;font-weight:600;letter-spacing:-.025em}.fd-uad-head p{margin-top:4px;color:var(--d-mut)}
.fd-uad-invite{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 14px;border-radius:10px;background:var(--d-accent);color:#fff;font-size:13px;font-weight:500;line-height:1;box-shadow:0 1px 2px rgba(15,118,110,.4),inset 0 1px 0 rgba(255,255,255,.18);transition:transform 240ms var(--fd-spring),filter 120ms}
.fd-uad[data-fd-theme="dark"] .fd-uad-invite{color:#042F2B}
.fd-uad-invite:hover{filter:brightness(1.08)}.fd-uad-invite:active{transform:scale(.97)}
.fd-uad-seats{display:flex;align-items:center;justify-content:space-between;gap:24px;margin:24px 0;padding:16px 20px;border-radius:14px;background:var(--d-card);box-shadow:0 0 0 1px var(--d-line)}
.fd-uad-seats b{font-weight:600;font-variant-numeric:tabular-nums}.fd-uad-seats small{display:block;font-size:13px;color:var(--d-mut)}
.fd-uad-meter{flex:0 1 220px;width:220px;height:8px;border-radius:9999px;background:var(--d-line);overflow:hidden}
.fd-uad-meter i{display:block;height:100%;border-radius:inherit;background:var(--d-accent);transition:width 420ms var(--fd-ease-out)}
.fd-uad-toast{position:fixed;left:50%;bottom:24px;z-index:900;display:flex;align-items:center;gap:16px;min-height:44px;padding:0 8px 0 16px;border-radius:12px;background:var(--d-fg);color:var(--d-bg);font-size:13px;font-weight:500;box-shadow:0 12px 32px -8px rgba(0,0,0,.4);opacity:0;visibility:hidden;transform:translate(-50%,12px);transition:opacity 240ms var(--fd-ease-out),transform 420ms var(--fd-ease-out),visibility 0s linear 420ms}
.fd-uad-toast[data-open]{opacity:1;visibility:visible;transform:translate(-50%,0);transition-delay:0s}
.fd-uad-toast button{height:28px;padding:0 10px;border-radius:8px;font-weight:600;color:inherit;background:rgba(127,127,127,.25)}
@media (max-width:820px){.fd-uad{grid-template-columns:1fr}.fd-uad-side{flex-direction:row;align-items:center;gap:12px;padding:10px 16px;box-shadow:inset 0 -1px 0 var(--d-line)}.fd-uad-side nav{display:none}.fd-uad-theme{margin:0 0 0 auto}.fd-uad-meter{display:none}.fd-uad-main{padding-top:24px}}
@media (prefers-reduced-motion:reduce){.fd-uad *{transition-duration:1ms!important}}
`;
