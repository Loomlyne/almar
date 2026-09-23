const PHOTO = "/assets/img/caedcb84dd0d35bb.webp";

const PEOPLE = [
  ["Maria Del Mar Valdes", "Founder"],
  ["María Francis", "Co-founder"],
] as const;

export function TeamSpecimen() {
  return (
    <section className="kit-section" id="specimen-team" aria-label="Team">
      <h2>Team</h2>
      <div className="team-grid">
        {PEOPLE.map(([name, role]) => (
          <figure key={name} className="team-card">
            <img className="team-portrait" src={PHOTO} alt={name} width={900} height={1350} />
            <figcaption>
              <p className="team-name">{name}</p>
              <p>{role}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
