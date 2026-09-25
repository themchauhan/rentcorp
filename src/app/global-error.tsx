"use client"; // Error boundaries must be Client Components

// Replaces the root layout when it fails, so it renders its own document
// and cannot rely on globals.css — styles are inline.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "3rem 1rem" }}
      >
        <title>Something went wrong</title>
        <h1 style={{ fontSize: "1.5rem" }}>Something went wrong</h1>
        {error.digest && (
          <p style={{ color: "#78716c", fontSize: "0.75rem" }}>Ref: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={() => retry()}
          style={{
            marginTop: "1.5rem",
            minHeight: "3rem",
            padding: "0 1.25rem",
            borderRadius: "0.5rem",
            border: 0,
            background: "#b45309",
            color: "#fff",
            fontSize: "1rem",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
