export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h1 className="text-4xl font-bold">About ReanHub</h1>
        <p className="mt-3 text-muted-foreground">A simple hub for classes, assignments, and quizzes.</p>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-24 space-y-6">
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Our Mission</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Help students and teachers collaborate with a lightweight, modern experience.
          </p>
        </section>
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Technology</h2>
          <p className="mt-2 text-sm text-muted-foreground">React + Vite + TypeScript on the frontend, Node/Express + Supabase on the backend.</p>
        </section>
      </main>
    </div>
  );
}
