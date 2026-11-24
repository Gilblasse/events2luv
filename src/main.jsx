import React, {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
} from "react";
import { createRoot } from "react-dom/client";
import {
  content as defaults,
  mediaSpecs,
  bookingLabels,
  isBookingLabel,
} from "./content.js";
import "./style.css";
import "./editorial.css";
const C = createContext();
async function request(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  const data = await r.json();
  if (!r.ok)
    throw Object.assign(Error(data.error || "Request failed"), {
      status: r.status,
      code: data.code,
    });
  return data;
}
function useModal(active, onClose) {
  const last = useRef(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!active) return;
    last.current = document.activeElement;
    const modal = document.querySelector(".drawer,.inbox");
    if (!modal) return;
    const nodes = () =>
      [
        ...modal.querySelectorAll(
          "button:not(:disabled),input,textarea,select,a[href]",
        ),
      ].filter((el) => el.getClientRects().length);
    nodes()[0]?.focus();
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current?.();
      }
      if (e.key === "Tab") {
        const list = nodes(),
          first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      last.current?.focus();
    };
  }, [active]);
}
const pagePath = (path) => path.replace(/\/+$/, "") || "/";
function linksToCurrentPage(href) {
  if (!href || href.startsWith("#")) return false;
  try {
    const url = new URL(href, location.href);
    return (
      url.origin === location.origin &&
      pagePath(url.pathname) === pagePath(location.pathname)
    );
  } catch {
    return false;
  }
}
function E({ id, as = "span", className = "" }) {
  const c = useContext(C),
    v = c.values[id] || defaults[id];
  const Tag = as;
  let node;
  if (v.type === "text") node = <Tag>{v.text}</Tag>;
  else if (v.type === "link") {
    if (!c.records || (v.visible === false && !c.editing)) return null;
    node = (
      <a
        href={v.href}
        aria-current={
          id.startsWith("nav") && linksToCurrentPage(v.href)
            ? "page"
            : undefined
        }
        onClick={(e) => {
          if (c.editing) {
            e.preventDefault();
            c.open(id);
          }
        }}
      >
        {v.text}
        {v.visible === false && (
          <small className="hidden-link-note">Hidden</small>
        )}
        <span aria-hidden="true" className="arrow-icon" />
      </a>
    );
  } else if (v.type === "video")
    node = v.src ? (
      <video
        aria-label={v.alt}
        src={v.src}
        poster={v.poster}
        controls
        playsInline
        preload="metadata"
      >
        {v.captions && (
          <track
            kind="captions"
            src={v.captions}
            srcLang="en"
            label="English"
            default
          />
        )}
      </video>
    ) : c.editing ? (
      <div className="empty-film">Add your celebration film</div>
    ) : null;
  else
    node = (
      <img
        src={v.src}
        alt={v.alt}
        style={{
          "--focus": `${v.x}% ${v.y}%`,
          "--focus-mobile": `${v.mobileX ?? v.x}% ${v.mobileY ?? v.y}%`,
        }}
        loading={id === "hero" ? "eager" : "lazy"}
      />
    );
  return (
    <span
      className={`editable ${v.type} ${className} ${c.editing ? "can-edit" : ""} ${c.selected === id ? "selected" : ""}`}
    >
      {node}
      {c.editing && (
        <button
          type="button"
          className="edit-button"
          aria-label={`Edit ${id}`}
          onClick={() => c.open(id)}
        >
          ✎ Edit {v.type}
        </button>
      )}
    </span>
  );
}
function Header() {
  const c = useContext(C);
  return (
    <header>
      <div className="brand">
        <span className="rings" aria-hidden="true" />
        {c.editing ? (
          <E id="brand" />
        ) : (
          <a
            href="/"
            aria-current={linksToCurrentPage("/") ? "page" : undefined}
          >
            {(c.values.brand || defaults.brand).text}
          </a>
        )}
      </div>
      <nav aria-label="Main navigation">
        {["navServices", "navWork", "navAbout", "navFaq"].map((id) => (
          <E key={id} id={id} />
        ))}
        <E id="navBook" className="button" />
      </nav>
      <E id="navBook" className="mobile-book" />
      <details className="mobile-nav">
        <summary>
          <E id="menuLabel" />
        </summary>
        {["navServices", "navWork", "navAbout", "navFaq", "navBook"].map(
          (id) => (
            <E key={id} id={id} />
          ),
        )}
      </details>
    </header>
  );
}
function CTA() {
  return (
    <section className="cta">
      <E id="ctaTitle" as="h2" />
      <E id="ctaBook" className="button light" />
    </section>
  );
}
function Services({ heading = "h1" }) {
  return (
    <section className="section">
      <E id="servicesEye" className="eyebrow" />
      <E id="servicesTitle" as={heading} />
      <div className="services-grid">
        {[
          ["wedding", "weddings"],
          ["birthday", "birthdays"],
          ["gathering", "gatherings"],
        ].map(([img, key]) => (
          <article key={key}>
            <E id={img} />
            <E id={key + "Title"} as="h3" />
            <E id={key + "Copy"} as="p" />
            <E id={key + "Link"} className="text-link" />
          </article>
        ))}
      </div>
    </section>
  );
}
function About({ heading = "h1" }) {
  return (
    <section className="about section">
      <E id="founder" />
      <div>
        <E id="aboutEye" className="eyebrow" />
        <E id="aboutTitle" as={heading} />
        <E id="aboutCopy" as="p" />
        <E id="aboutLocal" as="p" />
        <E id="aboutBook" className="text-link" />
      </div>
    </section>
  );
}
const chapters = [
  { id: "spark", label: "chapterSpark" },
  { id: "details", label: "chapterDetails" },
  { id: "moment", label: "chapterMoment" },
];

function Cover() {
  return (
    <section className="cover">
      <div className="cover-letter">
        <E id="eyebrow" className="eyebrow" />
        <h1>
          <E id="heroTitle" />
          <E id="heroItalic" as="em" />
        </h1>
        <E id="heroCopy" as="p" />
        <div className="cover-actions">
          <E id="heroBook" className="button" />
          <E id="heroWork" className="text-link" />
        </div>
      </div>
      <figure className="cover-plate">
        <E id="hero" />
        <figcaption>
          <span className="plate-rule" />
          <E id="coverCaption" />
        </figcaption>
      </figure>
    </section>
  );
}

function ChapterSpreads({ gallery = false }) {
  const { editing } = useContext(C);
  const [active, setActive] = useState("spark");
  const list = useRef(null);
  useEffect(() => {
    if (!window.IntersectionObserver) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-30% 0px -48%" },
    );
    for (const article of list.current.children) observer.observe(article);
    return () => observer.disconnect();
  }, []);
  return (
    <section className="chapter-section">
      <div className="chapter-band">
        <E id={gallery ? "storyEyebrow" : "processTitle"} />
        <nav aria-label="Celebration chapters">
          {chapters.map(({ id, label }, index) => (
            <div key={id}>
              {editing ? (
                <E id={label} />
              ) : (
                <a
                  href={"#" + id}
                  aria-current={active === id ? "step" : undefined}
                >
                  <i aria-hidden="true">0{index + 1}</i>
                  <E id={label} />
                </a>
              )}
            </div>
          ))}
        </nav>
      </div>
      <div ref={list} className="chapter-spreads">
        {chapters.map(({ id, label }, i) => (
          <article id={id} key={id} className={"chapter spread-" + id}>
            <div className="chapter-copy">
              <E id={gallery ? label : "step" + (i + 1)} className="eyebrow" />
              <E id={id + "Title"} as="h2" />
              <E id={id + "Copy"} as="p" />
              {id === "details" && (
                <details open={editing || undefined}>
                  <summary>
                    <E id="followDetail" />
                  </summary>
                  <E id="detailNote" as="p" />
                </details>
              )}
              {id === "moment" && (
                <E
                  id={gallery ? "storyBook" : "heroWork"}
                  className="text-link"
                />
              )}
            </div>
            <div className="chapter-photos">
              <E id={id === "moment" && !gallery ? "wedding" : id} />
              {id === "details" && <E id="overlap" />}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const galleryPhotos = [
  "wedding",
  "gathering",
  "birthday",
  "spark",
  "overlap",
  "moment",
];

function Story() {
  const c = useContext(C);
  const [zoom, setZoom] = useState(null);
  const dialog = useRef(null);
  const trigger = useRef(null);
  const opened = zoom !== null;
  useEffect(() => {
    if (!opened) return;
    const el = dialog.current;
    el.showModal();
    return () => {
      el.close();
      trigger.current?.focus({ preventScroll: true });
    };
  }, [opened]);
  const move = (by) =>
    setZoom((i) => (i + by + galleryPhotos.length) % galleryPhotos.length);
  const photo =
    opened && (c.values[galleryPhotos[zoom]] || defaults[galleryPhotos[zoom]]);
  return (
    <>
      <section className="gallery-cover">
        <div>
          <E id="galleryEye" className="eyebrow" />
          <E id="galleryTitle" as="h1" />
          <E id="galleryCopy" as="p" />
        </div>
        <E id="bookingPhoto" />
      </section>
      <section className="gallery-letter">
        <E id="storyTitle" as="h2" />
        <E id="storyIntro" as="p" />
      </section>
      <ChapterSpreads gallery />
      <section className="album section">
        <E id="moreTitle" as="h2" />
        <div className="album-plates">
          {galleryPhotos.map((id, index) => (
            <figure key={id}>
              <E id={id} />
              {!c.editing && (
                <button
                  onClick={(event) => {
                    trigger.current = event.currentTarget;
                    setZoom(index);
                  }}
                  aria-label={`Enlarge ${(c.values[id] || defaults[id]).alt}`}
                >
                  {(c.values.viewPhoto || defaults.viewPhoto).text}
                  <span aria-hidden="true"> ?</span>
                </button>
              )}
            </figure>
          ))}
        </div>
        <E id="galleryNote" as="p" className="fineprint" />
      </section>
      <section className="screening">
        <div>
          <E id="filmTitle" as="h2" />
          <E id="filmNote" as="p" />
        </div>
        <E id="storyFilm" />
      </section>
      {opened && (
        <dialog
          ref={dialog}
          className="viewer"
          aria-label={photo.alt}
          onCancel={() => setZoom(null)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") move(-1);
            if (event.key === "ArrowRight") move(1);
          }}
        >
          <div className="viewer-controls">
            <span aria-live="polite">
              {zoom + 1} / {galleryPhotos.length}
            </span>
            <button onClick={() => setZoom(null)} autoFocus>
              {(c.values.closePhoto || defaults.closePhoto).text} ?
            </button>
          </div>
          <img src={photo.src} alt={photo.alt} />
          <div className="viewer-controls">
            <button
              aria-label={
                (c.values.previousPhoto || defaults.previousPhoto).text
              }
              onClick={() => move(-1)}
            >
              ?
            </button>
            <p>{photo.alt}</p>
            <button
              aria-label={(c.values.nextPhoto || defaults.nextPhoto).text}
              onClick={() => move(1)}
            >
              ?
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
function FAQ({ heading = "h1" }) {
  const c = useContext(C);
  return (
    <section className="section faq">
      <E id="faqTitle" as={heading} />
      {[1, 2, 3, 4].map((n) => (
        <details key={n} open={c.editing || undefined}>
          <summary>
            <E id={"faq" + n} />
          </summary>
          <E id={"answer" + n} as="p" />
        </details>
      ))}
    </section>
  );
}
function BookingField({ name, children }) {
  const c = useContext(C);
  const id = bookingLabels[name];
  if (c.values[id]?.visible !== false) return children;
  return c.editing ? (
    <div>
      <E id={id} /> <small className="hidden-link-note">Hidden</small>
    </div>
  ) : null;
}

function Booking() {
  const c = useContext(C);
  const [status, setStatus] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false);
  const inspiration =
    new URLSearchParams(location.search).get("inspiration") || "";
  async function send(e) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    const payload = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await request("/api/inquiries", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSent(true);
    } catch (e) {
      setStatus(
        (
          c.values[e.code] ||
          defaults[e.code] ||
          c.values.inquiryFailed ||
          defaults.inquiryFailed
        ).text,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="section">
      <E id="bookingEye" className="eyebrow" />
      <E id="bookingTitle" as="h1" />
      <E id="bookingCopy" as="p" />
      <div className="booking">
        <div className="booking-art">
          <E id="bookingPhoto" />
          <E id="bookingInset" className="booking-inset" />
          <E id="footerEmail" className="text-link" />
        </div>
        {sent ? (
          <div className="success" role="status">
            <E id="successTitle" as="h2" />
            <E id="successCopy" as="p" />
          </div>
        ) : c.records ? (
          <form onSubmit={send}>
            <E id="formTitle" as="h2" />
            <E id="formIntro" as="p" />
            <BookingField name="inspiration">
              {(inspiration || c.editing) && (
                <div className="inspiration">
                  <E id="inspirationLabel" /> {inspiration.slice(0, 200)}
                </div>
              )}
              <input type="hidden" name="inspiration" value={inspiration} />
            </BookingField>
            <div className="form-grid">
              <Field name="name" required />
              <Field name="email" type="email" required />
              <BookingField name="occasion">
                <label>
                  <E id="occasionLabel" />
                  <select name="occasion" required>
                    <option value="">
                      {
                        (c.values.occasionPrompt || defaults.occasionPrompt)
                          .text
                      }
                    </option>
                    {[
                      "Wedding",
                      "Birthday",
                      "Gathering",
                      "Meeting",
                      "Life",
                      "Other",
                    ].map((x) => (
                      <option key={x}>
                        {
                          (c.values["occasion" + x] || defaults["occasion" + x])
                            .text
                        }
                      </option>
                    ))}
                  </select>
                </label>
              </BookingField>
              {(c.editing ||
                c.values.dateLabel?.visible !== false ||
                c.values.flexLabel?.visible !== false) && (
                <div>
                  <Field name="date" type="date" />
                  <BookingField name="flexible">
                    <label className="check">
                      <input type="checkbox" name="flexible" value="yes" />
                      <E id="flexLabel" />
                    </label>
                  </BookingField>
                </div>
              )}
              <Field name="location" wide />
              <Field name="phone" type="tel" wide />
              <Field name="guests" type="number" />
              <Field name="budget" />
              <Field name="vision" area wide />
            </div>
            <input
              className="honeypot"
              name="website"
              tabIndex="-1"
              autoComplete="off"
              aria-hidden="true"
            />
            <p role="alert">{status}</p>
            <div className="submit-area">
              {c.editing && <E id="submitLabel" />}
              <button className="button submit" disabled={busy}>
                {
                  (
                    c.values[busy ? "sendingLabel" : "submitLabel"] ||
                    defaults[busy ? "sendingLabel" : "submitLabel"]
                  ).text
                }{" "}
                ↗
              </button>
            </div>
            <E id="submitNote" as="p" className="fineprint" />
            <E id="privacyNote" as="p" className="fineprint" />
          </form>
        ) : null}
      </div>
      <E id="nextEye" className="eyebrow" />
      <div className="steps">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <i>0{i}</i>
            <E id={"next" + i} />
          </div>
        ))}
      </div>
    </section>
  );
}
function Field({ name, type = "text", required, area, wide }) {
  const c = useContext(C);
  return (
    <BookingField name={name}>
      <label className={wide ? "wide" : ""}>
        <E id={name + "Label"} />
        {area ? (
          <textarea
            name={name}
            rows="4"
            maxLength="4000"
            placeholder={
              (c.values[name + "Placeholder"] || defaults[name + "Placeholder"])
                ?.text
            }
          />
        ) : (
          <input
            name={name}
            type={type}
            required={required}
            min={type === "number" ? 1 : undefined}
            max={type === "number" ? 100000 : undefined}
            maxLength="300"
            placeholder={
              (c.values[name + "Placeholder"] || defaults[name + "Placeholder"])
                ?.text
            }
          />
        )}
      </label>
    </BookingField>
  );
}
function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="login section">
      <span className="eyebrow">EVENTS2LUV ADMIN</span>
      <h1>Welcome back.</h1>
      <p>Sign in to edit your website.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setError("");
          setBusy(true);
          try {
            await request("/api/login", {
              method: "POST",
              body: JSON.stringify(
                Object.fromEntries(new FormData(e.currentTarget)),
              ),
            });
            // The gallery reads the new session after navigation.
            location.replace("/gallery");
          } catch (e) {
            setError(e.message);
            setBusy(false);
          }
        }}
      >
        <label>
          Email
          <input autoComplete="username" name="email" type="email" required />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            name="password"
            type="password"
            required
          />
        </label>
        <p role="alert">{error}</p>
        <button className="button" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </section>
  );
}
function NewPasswordField({ name, label, visibilityLabel = "new password" }) {
  const [visible, setVisible] = useState(false);
  const action = visible ? "Hide" : "Show";
  return (
    <div className="password-field">
      <label htmlFor={name}>{label}</label>
      <div className="password-control">
        <input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          autoCapitalize="none"
          spellCheck={false}
          minLength={14}
          maxLength={256}
          required
        />
        <button
          type="button"
          aria-label={`${action} ${visibilityLabel}`}
          aria-controls={name}
          onClick={() => setVisible((previous) => !previous)}
        >
          {action}
        </button>
      </div>
    </div>
  );
}
function ChangePassword({ session, onSuccess }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="login section">
      <h1>Change password</h1>
      <p>Use 14 to 256 characters. After saving, sign in again with your new password.</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setError("");
          setBusy(true);
          try {
            await request("/api/admin/password", {
              method: "POST",
              headers: { "x-csrf-token": session.csrf },
              body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
            });
            onSuccess();
          } catch (error) {
            setError(error.message);
            setBusy(false);
          }
        }}
      >
        <input type="hidden" autoComplete="username" value={session.email} />
        <label>
          Current password
          <input name="currentPassword" type="password" autoComplete="current-password" maxLength={256} required />
        </label>
        <NewPasswordField name="newPassword" label="New password" />
        <NewPasswordField
          name="confirmPassword"
          label="Confirm new password"
          visibilityLabel="password confirmation"
        />
        {error && <p role="alert">{error}</p>}
        <button className="button" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
      </form>
    </section>
  );
}
function Editor() {
  const c = useContext(C),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const d = c.draft;
  useModal(!!d, () => {
    if (!busy && !uploading) c.close();
  });
  if (!d) return null;
  const change = (k, v) => c.setDraft((prev) => ({ ...prev, [k]: v }));
  async function upload(file, key = "src") {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      let r;
      if (import.meta.env.VITE_NETLIFY_UPLOADS === "true") {
        const headers = { "x-csrf-token": c.session.csrf };
        const upload = await request("/api/uploads/start", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            mime: file.name.endsWith(".vtt") ? "text/vtt" : file.type,
          }),
        });
        for (let offset = 0; offset < file.size; offset += upload.chunkSize) {
          const response = await fetch(
            `/api/uploads/${upload.id}/${offset / upload.chunkSize}`,
            {
              method: "PUT",
              headers: {
                ...headers,
                "content-type": "application/octet-stream",
              },
              body: file.slice(offset, offset + upload.chunkSize),
            },
          );
          if (!response.ok)
            throw Error("Upload interrupted. Please choose the file again.");
        }
        r = await request(`/api/uploads/${upload.id}/finish`, {
          method: "POST",
          headers,
          body: "{}",
        });
      } else {
        const body = new FormData();
        body.append("file", file);
        r = await request("/api/upload", {
          method: "POST",
          headers: { "x-csrf-token": c.session.csrf },
          body,
        });
      }
      c.pending.current.push(r.src);
      change(key, r.src);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const r = await request("/api/content/" + c.selected, {
        method: "PUT",
        headers: { "x-csrf-token": c.session.csrf },
        body: JSON.stringify({
          value: d,
          version: c.records[c.selected]?.version || 0,
        }),
      });
      c.setRecords({ ...c.records, [c.selected]: r });
      c.close(true);
      c.setToast(r.warning || "Your changes are saved.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="drawer-shield" />
      <div
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Edit content"
      >
        <div className="drawer-head">
          <h2>Edit {d.type}</h2>
          <button
            disabled={busy || uploading}
            onClick={() => c.close()}
            aria-label="Close editor"
          >
            ×
          </button>
        </div>
        <p className="fineprint">
          {c.selected}
          {c.selected.startsWith("nav") || c.selected.startsWith("footer")
            ? " · Shared across all pages"
            : ""}
        </p>
        <div className="drawer-body">
          {["text", "link"].includes(d.type) ? (
            <>
              <label>
                Words
                <textarea
                  autoFocus
                  rows="6"
                  value={d.text}
                  onChange={(e) => change("text", e.target.value)}
                />
              </label>
              {isBookingLabel(c.selected) && (
                <label className="check link-visibility">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={d.visible !== false}
                    onChange={(e) => change("visible", e.target.checked)}
                  />
                  Show field on booking form
                </label>
              )}
              {d.type === "link" && (
                <>
                  <label>
                    Link destination
                    <input
                      value={d.href}
                      onChange={(e) => change("href", e.target.value)}
                    />
                    <small>Website address, /page, mailto: or tel:</small>
                  </label>
                  <label className="check link-visibility">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={d.visible !== false}
                      onChange={(e) => change("visible", e.target.checked)}
                    />
                    Show link to visitors
                  </label>
                </>
              )}
            </>
          ) : (
            <>
              {d.type === "image" ? (
                <img className="upload-preview" src={d.src} alt={d.alt} />
              ) : d.src ? (
                <video controls src={d.src} poster={d.poster} />
              ) : (
                <p>Upload your celebration film.</p>
              )}
              <label className="upload-control">
                Upload new {d.type}
                <input
                  type="file"
                  accept={
                    d.type === "image"
                      ? "image/jpeg,image/png,image/webp"
                      : "video/mp4,video/webm"
                  }
                  onChange={(e) => upload(e.target.files[0])}
                />
              </label>
              <p className="fineprint">
                {d.type === "image"
                  ? "JPG, PNG or WebP · maximum 15 MB. " +
                    (mediaSpecs[c.selected] ||
                      "Portrait or landscape · recommended 2000 pixels on the longest edge.")
                  : "MP4 or WebM · maximum 100 MB, 5 minutes, 4096 pixels per side. Landscape 16:9 · recommended 1920 × 1080."}
              </p>
              <label>
                Image / video description
                <textarea
                  value={d.alt}
                  onChange={(e) => change("alt", e.target.value)}
                />
              </label>
              {d.type === "image" ? (
                <>
                  <label>
                    Horizontal focus
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={d.x}
                      onChange={(e) => change("x", +e.target.value)}
                    />
                  </label>
                  <label>
                    Vertical focus
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={d.y}
                      onChange={(e) => change("y", +e.target.value)}
                    />
                  </label>
                  <label>
                    Mobile horizontal focus
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={d.mobileX ?? d.x}
                      onChange={(e) => change("mobileX", +e.target.value)}
                    />
                  </label>
                  <label>
                    Mobile vertical focus
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={d.mobileY ?? d.y}
                      onChange={(e) => change("mobileY", +e.target.value)}
                    />
                  </label>
                  <small>Desktop crop</small>
                  <div className="crop-preview">
                    <img
                      src={d.src}
                      alt="Crop preview"
                      style={{ objectPosition: `${d.x}% ${d.y}%` }}
                    />
                  </div>
                  <small>Mobile crop</small>
                  <div className="crop-preview mobile-crop">
                    <img
                      src={d.src}
                      alt="Mobile crop preview"
                      style={{
                        objectPosition: `${d.mobileX ?? d.x}% ${d.mobileY ?? d.y}%`,
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <label>
                    Poster image
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => upload(e.target.files[0], "poster")}
                    />
                    <small>
                      JPG, PNG or WebP · maximum 15 MB. Landscape 16:9 ·
                      recommended 1920 × 1080.
                    </small>
                  </label>
                  <label>
                    Captions (.vtt)
                    <input
                      type="file"
                      accept=".vtt"
                      onChange={(e) => upload(e.target.files[0], "captions")}
                    />
                    <small>WebVTT (.vtt) · maximum 1 MB.</small>
                  </label>
                </>
              )}
            </>
          )}
          <p role="alert">{error}</p>
          {error.includes("Another admin") && (
            <button
              className="text-link"
              onClick={async () => {
                if (
                  confirm(
                    "Discard this draft and load the latest saved version?",
                  )
                ) {
                  const all = await request("/api/admin/content");
                  c.setRecords(all);
                  c.setDraft(
                    structuredClone(
                      all[c.selected]?.value || defaults[c.selected],
                    ),
                  );
                  setError("");
                }
              }}
            >
              Load latest saved version
            </button>
          )}
          {uploading && <p role="status">Processing upload…</p>}
          <p className="fineprint">Only you see changes until saved.</p>
        </div>
        <div className="drawer-actions">
          <button onClick={() => c.close()} disabled={busy || uploading}>
            Cancel
          </button>
          <button
            className="button"
            disabled={busy || uploading}
            onClick={save}
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
          <small>Saving updates the live website.</small>
        </div>
      </div>
    </>
  );
}
export function App() {
  const [records, setRecords] = useState(null),
    [session, setSession] = useState(null),
    [editing, setEditing] = useState(false),
    [selected, setSelected] = useState(null),
    [draft, setDraft] = useState(null),
    [toast, setToast] = useState(""),
    [contentList, setContentList] = useState(false),
    [search, setSearch] = useState("");
  useModal(contentList, () => setContentList(false));
  const pending = useRef([]);
  const values = Object.fromEntries(
    Object.entries(records || {}).map(([id, v]) => [id, v.value]),
  );
  if (selected && draft) values[selected] = draft;
  useEffect(() => {
    request("/api/content")
      .then(setRecords)
      .catch(() => setToast("Content could not be refreshed. Please reload."));
    request("/api/session")
      .then((s) => {
        setSession(s);
        setEditing(!!s.email);
      })
      .catch(() => {
        setSession({});
        setToast("Your sign-in status could not be checked. Please reload.");
      });
  }, []);
  useEffect(() => {
    const fn = (e) => {
      if (draft) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    addEventListener("beforeunload", fn);
    return () => removeEventListener("beforeunload", fn);
  }, [draft]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  async function close(saved = false) {
    if (
      !saved &&
      draft &&
      JSON.stringify(draft) !==
        JSON.stringify(records[selected]?.value || defaults[selected]) &&
      !confirm("Discard your unsaved changes?")
    )
      return false;
    for (const src of pending.current)
      request("/api/upload/" + src.slice(7), {
        method: "DELETE",
        headers: { "x-csrf-token": session.csrf },
      }).catch(() => {});
    pending.current = [];
    setSelected(null);
    setDraft(null);
    return true;
  }
  async function open(id) {
    if (selected && !(await close())) return;
    setSelected(id);
    setDraft(structuredClone(records[id]?.value || defaults[id]));
  }
  const ctx = {
    records,
    setRecords,
    values,
    session,
    editing,
    selected,
    draft,
    setDraft,
    open,
    close,
    pending,
    setToast,
  };
  const path = pagePath(location.pathname);
  useEffect(() => {
    const names = {
      "/": "Your moment, beautifully planned",
      "/gallery": "Our Work",
      "/booking": "Plan Your Event",
      "/about": "Meet Shaniese",
      "/services": "Services",
      "/faq": "Frequently Asked Questions",
      "/admin": "Admin",
    };
    document.title = `${names[path] || "Events"} · Events2Luv`;
  }, [path]);
  return (
    <C.Provider value={ctx}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      {session?.email && (
        <div className="adminbar">
          <strong>Events2Luv / Admin</strong>
          <span>{session.email}</span>
          <button
            onClick={async () => {
              if (await close()) {
                setEditing(!editing);
              }
            }}
          >
            {editing ? "Preview website" : "Edit mode"}
          </button>
          <button
            className="content-button"
            onClick={() => setContentList(true)}
          >
            All content
          </button>
          {path !== "/admin" && (
            <button onClick={async () => {
              if (await close()) location.href = "/admin";
            }}>
              Change password
            </button>
          )}
          <button
            onClick={async () => {
              if (await close()) {
                await request("/api/logout", {
                  method: "POST",
                  headers: { "x-csrf-token": session.csrf },
                });
                setSession({});
                setEditing(false);
              }
            }}
          >
            Sign out
          </button>
        </div>
      )}
      <Header />
      <main id="main">
        {path === "/admin" ? (
          session === null ? (
            <section className="login section">
              <p role="status">Checking your session…</p>
            </section>
          ) : session.email ? (
            <ChangePassword session={session} onSuccess={() => {
              setSession({});
              setEditing(false);
              setContentList(false);
              setToast("Password updated. Sign in with your new password.");
            }} />
          ) : (
            <Login />
          )
        ) : path === "/booking" ? (
          <Booking />
        ) : path === "/gallery" ? (
          <Story />
        ) : path === "/services" ? (
          <>
            <Services />
            <FAQ heading="h2" />
          </>
        ) : path === "/about" ? (
          <About />
        ) : path === "/faq" ? (
          <FAQ />
        ) : (
          <>
            <Cover />
            <ChapterSpreads />
            <Services heading="h2" />
            <About heading="h2" />
          </>
        )}
      </main>
      {path !== "/booking" && path !== "/admin" && <CTA />}
      <footer>
        <E id="brand" as="h2" />
        <E id="footerCopy" as="p" />
        <E id="footerEmail" />
        <div>
          {["navServices", "navWork", "navAbout", "navFaq"].map((id) => (
            <E key={id} id={id} />
          ))}
        </div>
      </footer>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {selected && <Editor key={selected} />}
      {contentList && (
        <div
          className="inbox"
          role="dialog"
          aria-modal="true"
          aria-label="All website content"
        >
          <button onClick={() => setContentList(false)}>Close ×</button>
          <h2>All website content</h2>
          <p>Edit shared words, links, form placeholders, and media.</p>
          <label>
            Find content
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search words or content name"
            />
          </label>
          <div className="content-list">
            {Object.keys(defaults)
              .filter((id) =>
                JSON.stringify({ id, ...(values[id] || defaults[id]) })
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((id) => (
                <button
                  key={id}
                  onClick={() => {
                    setContentList(false);
                    setEditing(true);
                    open(id);
                  }}
                >
                  <small>
                    {id} · {defaults[id].type}
                  </small>
                  <span>
                    {(values[id] || defaults[id]).text ||
                      (values[id] || defaults[id]).alt}
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}
    </C.Provider>
  );
}
if (document.getElementById("root"))
  createRoot(document.getElementById("root")).render(<App />);
