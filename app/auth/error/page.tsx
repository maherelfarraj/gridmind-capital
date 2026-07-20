export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-slate-800">Authentication Error</h1>
        <p className="mt-2 text-slate-500">Something went wrong during sign in. Please try again.</p>
        <a
          href="/auth/login"
          className="mt-6 inline-flex items-center rounded-lg bg-[#0a192f] px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Back to Login
        </a>
      </div>
    </div>
  )
}
