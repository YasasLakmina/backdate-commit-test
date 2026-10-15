export default function Rationale({ paragraphs, title }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <div className="rationale">
        {paragraphs.map((p) => <p key={p}>{p}</p>)}
      </div>
    </section>
  );
}
