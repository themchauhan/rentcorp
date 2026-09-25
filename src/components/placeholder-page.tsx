export function PlaceholderPage({ title, phase }: { title: string; phase: string }) {
  return (
    <section>
      <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
      <p className="mt-2 text-stone-600">Coming in {phase}.</p>
    </section>
  );
}
