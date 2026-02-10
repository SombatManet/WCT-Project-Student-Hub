export default function Services() {
  const items = [
    { title: "Class Management", desc: "Create and manage classes with invite codes." },
    { title: "Assignments", desc: "Post assignments, submit files, and grade work." },
    { title: "Quizzes", desc: "Create quizzes and track results." },
  ];
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h1 className="text-4xl font-bold">Services</h1>
        <p className="mt-3 text-muted-foreground">What you can do with ReanHub</p>
      </header>
      <main className="mx-auto max-w-5xl px-6 pb-24 grid gap-6 md:grid-cols-3">
        {items.map(i => (
          <div key={i.title} className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{i.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{i.desc}</p>
          </div>
        ))}
      </main>
    </div>
  );
}
