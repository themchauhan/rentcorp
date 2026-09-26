import { APP_NAME } from "@/lib/app";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <p className="mb-8 text-center text-2xl font-bold text-brand-700">{APP_NAME}</p>
      {children}
    </main>
  );
}
