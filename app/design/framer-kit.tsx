const LOGOS = [
  ["Black wordmark", "https://framerusercontent.com/images/RX7lhKpzXFpv2KTvbxNSm3UZz8.svg"],
  ["White wordmark", "https://framerusercontent.com/images/9UQH6L9unLcVGSBMDQ8zgJYMBT0.svg"],
  ["Black polygon", "https://framerusercontent.com/images/9iiV0CfugYnGxSPRzesh3liqs.svg"],
  ["White polygon", "https://framerusercontent.com/images/iFS0Oj39DFjk35aAaQNDBN1TtDM.svg"],
  ["Gold polygon", "https://framerusercontent.com/images/YfhnZNlsqpGuo6qLpQhrHHlrts.svg"],
  ["Black monogram", "https://framerusercontent.com/images/prMcX1bT4P2ZzVsjpoFmR4T5nA.svg"],
  ["White monogram", "https://framerusercontent.com/images/Hbj6Mb3vJsfPCLnDYGGfXzH5pU.svg"],
] as const;

const NAV = [
  ["Destinations", "/destinations"],
  ["Experiences", "/experiences"],
  ["Services", "/services"],
  ["About", "/about"],
  ["Blogs", "/blog"],
] as const;

const STAYS = [
  ["Getsemaní Colonial House", "Up to 10 guests", "/assets/img/0ecaa27f3bc3940e.webp"],
  ["Getsemaní Courtyard Residence", "3 king beds, 2 queen beds", "/assets/img/59682878de873329.webp"],
  ["Cartagena Historic Center House", "Up to 7 guests", "/assets/img/3d4468b8d961eff5.webp"],
] as const;

const TEAM = [
  ["Ana Velásquez", "Founder & Journey Director", "/assets/img/b9d52c65cad144dd.webp"],
  ["Mateo Ríos", "Private Travel Designer", "/assets/img/e52175dd9670c9d5.webp"],
  ["Sofía Marín", "Guest Experience Lead", "/assets/img/b69b236fc3988de3.webp"],
] as const;

const INDEX = [
  ["brand", "Brand"],
  ["header", "Header"],
  ["buttons", "Buttons"],
  ["type", "Type"],
  ["stays", "Stays"],
  ["destination", "Destination"],
  ["team", "Team"],
  ["footer", "Footer"],
] as const;

function Wordmark({ src, alt, onDark = false }: { src: string; alt: string; onDark?: boolean }) {
  return (
    <img
      className={onDark ? "frk-logo frk-logo-on-dark" : "frk-logo"}
      src={src}
      alt={alt}
      width={140}
      height={70}
    />
  );
}

export function FramerKit() {
  return (
    <div className="frk">
      <div className="frk-shell">
        <nav className="frk-side" aria-label="On this page">
          <p className="frk-side-title">Components</p>
          <ul>
            {INDEX.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <main className="frk-main" id="frk-main">
          <header className="frk-page-head">
            <p className="frk-kicker">From the Framer project</p>
            <h1>ALMAR</h1>
          </header>

          <section className="frk-section" id="brand" aria-label="Brand">
            <h2>Brand</h2>
            <p className="frk-sub">Logo variants from the project. Square. No extra mark.</p>
            <ul className="frk-logos">
              {LOGOS.map(([alt, src]) => (
                <li key={alt} className={alt.startsWith("White") ? "is-dark" : ""}>
                  <Wordmark src={src} alt={alt} onDark={alt.startsWith("White")} />
                  <span>{alt}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="frk-section" id="header" aria-label="Header">
            <h2>Header</h2>
            <p className="frk-sub">Desktop. White wordmark. Links from the component.</p>
            <div className="frk-hero">
              <img
                src="https://framerusercontent.com/images/UBXu3rmNV3xBxikz9sxPamJs6jQ.jpg"
                alt=""
              />
              <div className="frk-header">
                <nav aria-label="Primary">
                  {NAV.slice(0, 2).map(([label, href]) => (
                    <a key={label} href={href}>
                      {label}
                    </a>
                  ))}
                </nav>
                <a href="/" aria-label="ALMAR home">
                  <Wordmark
                    src="https://framerusercontent.com/images/9UQH6L9unLcVGSBMDQ8zgJYMBT0.svg"
                    alt=""
                    onDark
                  />
                </a>
                <nav aria-label="More">
                  {NAV.slice(2).map(([label, href]) => (
                    <a key={label} href={href}>
                      {label}
                    </a>
                  ))}
                </nav>
              </div>
              <div className="frk-hero-copy">
                <p>Welcome to ALMAR</p>
                <p className="frk-display">Colombia, Privately Yours</p>
                <a className="frk-btn" href="/contact">
                  Design your journey
                </a>
              </div>
            </div>
          </section>

          <section className="frk-section" id="buttons" aria-label="Buttons">
            <h2>Buttons</h2>
            <p className="frk-sub">Width follows the label. Square. No fill of the column.</p>
            <div className="frk-row">
              <a className="frk-btn" href="/contact">
                Design your journey
              </a>
              <a className="frk-link" href="/private-stays">
                View all private stays
              </a>
              <a className="frk-icon" href="/contact" aria-label="Next">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </a>
            </div>
            <div className="frk-row">
              <button type="button" className="frk-form">
                Begin your journey
              </button>
              <button type="button" className="frk-form is-loading" aria-busy="true">
                Begin your journey
              </button>
              <button type="button" className="frk-form" disabled>
                Begin your journey
              </button>
              <button type="button" className="frk-form is-ok">
                Sent
              </button>
              <button type="button" className="frk-form is-err">
                Try again
              </button>
            </div>
          </section>

          <section className="frk-section" id="type" aria-label="Type">
            <h2>Type</h2>
            <p className="frk-sub">Questa for headings. Lato for body. Teal on ivory.</p>
            <div className="frk-type">
              <p className="frk-kicker">Private stays</p>
              <p className="frk-h4">Private Stays, Fully Vetted</p>
              <p>Where safety meets bespoke luxury.</p>
            </div>
          </section>

          <section className="frk-section" id="stays" aria-label="Stays">
            <h2>Stays</h2>
            <p className="frk-sub">Stay card. Photo, then the name.</p>
            <ul className="frk-stays">
              {STAYS.map(([name, meta, src]) => (
                <li key={name}>
                  <a href="/private-stays">
                    <img src={src} alt="" />
                    <span>{name}</span>
                    <small>{meta}</small>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section className="frk-section" id="destination" aria-label="Destination">
            <h2>Destination</h2>
            <p className="frk-sub">Image left. Copy on the ivory field.</p>
            <article className="frk-dest">
              <img src="/assets/img/7be54fdf64a2e281.webp" alt="" />
              <div>
                <p className="frk-kicker">Cartagena</p>
                <p className="frk-h4">Colombia Through Your Eyes</p>
                <p>Moments designed for you.</p>
                <a className="frk-link" href="/destinations">
                  View destinations
                </a>
              </div>
            </article>
          </section>

          <section className="frk-section" id="team" aria-label="Team">
            <h2>Team</h2>
            <p className="frk-sub">Portrait, name, role. Icons only on the social row.</p>
            <ul className="frk-team">
              {TEAM.map(([name, role, src]) => (
                <li key={name}>
                  <img src={src} alt="" />
                  <p className="frk-name">{name}</p>
                  <p className="frk-role">{role}</p>
                </li>
              ))}
            </ul>
            <ul className="frk-socials" aria-label="Social">
              <li>
                <a href="https://facebook.com/" aria-label="Facebook, opens in a new tab" target="_blank" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path d="M14 8V6.5A1.5 1.5 0 0 1 15.5 5H17V3h-2a3 3 0 0 0-3 3v2H10v2h2v8h3v-8h2.2l.3-2H15z" fill="currentColor" />
                  </svg>
                </a>
              </li>
              <li>
                <a href="https://www.instagram.com/almarprivatejourney/" aria-label="Instagram, opens in a new tab" target="_blank" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="8" y="8" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </a>
              </li>
              <li>
                <a href="https://youtube.com/" aria-label="YouTube, opens in a new tab" target="_blank" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <rect x="3" y="6" width="18" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M11 10.5v3l3-1.5-3-1.5z" fill="currentColor" />
                  </svg>
                </a>
              </li>
            </ul>
          </section>

          <section className="frk-section" id="footer" aria-label="Footer">
            <h2>Footer</h2>
            <p className="frk-sub">Ivory field. Teal line. Label-width button.</p>
            <footer className="frk-footer">
              <div>
                <p className="frk-kicker">Explore</p>
                <a href="/destinations">Destinations</a>
                <a href="/experiences">Experiences</a>
                <a href="/private-stays">Private stays</a>
              </div>
              <div>
                <p className="frk-kicker">Contact</p>
                <a href="mailto:inquiries@almarprivatejourney.com">inquiries@almarprivatejourney.com</a>
                <a href="tel:+971563883302">+971 56 388 3302</a>
              </div>
              <a className="frk-form" href="/contact">
                Begin your journey
              </a>
            </footer>
          </section>
        </main>
      </div>
    </div>
  );
}

export function ProjectUpdate() {
  return (
    <>
      <section className="kit-section" id="wordmark" aria-label="Wordmark">
        <header className="kit-head">
          <h2>Wordmark</h2>
          <p className="kit-sub">Logo variants from the Framer project.</p>
        </header>
        <ul className="frk-logos">
          {LOGOS.map(([alt, src]) => (
            <li key={alt} className={alt.startsWith("White") ? "is-dark" : ""}>
              <Wordmark src={src} alt={alt} onDark={alt.startsWith("White")} />
              <span>{alt}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="kit-section" id="site-header" aria-label="Site header">
        <header className="kit-head">
          <h2>Site header</h2>
          <p className="kit-sub">Desktop header from the project.</p>
        </header>
        <div className="frk-hero">
          <img src="https://framerusercontent.com/images/UBXu3rmNV3xBxikz9sxPamJs6jQ.jpg" alt="" />
          <div className="frk-header">
            <nav aria-label="Primary">
              {NAV.slice(0, 2).map(([label, href]) => (
                <a key={label} href={href}>
                  {label}
                </a>
              ))}
            </nav>
            <a href="/" aria-label="ALMAR home">
              <Wordmark
                src="https://framerusercontent.com/images/9UQH6L9unLcVGSBMDQ8zgJYMBT0.svg"
                alt=""
                onDark
              />
            </a>
            <nav aria-label="More">
              {NAV.slice(2).map(([label, href]) => (
                <a key={label} href={href}>
                  {label}
                </a>
              ))}
            </nav>
          </div>
          <div className="frk-hero-copy">
            <p>Welcome to ALMAR</p>
            <p className="frk-display">Colombia, Privately Yours</p>
            <a className="frk-btn" href="/contact">
              Design your journey
            </a>
          </div>
        </div>
      </section>
      <section className="kit-section" id="project-stays" aria-label="Project stays">
        <header className="kit-head">
          <h2>Project stays</h2>
          <p className="kit-sub">Stay cards from the project.</p>
        </header>
        <ul className="frk-stays">
          {STAYS.map(([name, meta, src]) => (
            <li key={name}>
              <a href="/private-stays">
                <img src={src} alt="" />
                <span>{name}</span>
                <small>{meta}</small>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
