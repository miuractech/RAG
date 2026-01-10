import Messages from './messages';

export default function Login() {
  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your Crownwell AI account</p>
      </div>
      <form
        className="flex flex-col w-full gap-6 text-foreground bg-card border border-border rounded-lg p-8 shadow-sm"
        action="/auth/sign-in"
        method="post"
      >
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            className="rounded-lg px-4 py-2.5 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            className="rounded-lg px-4 py-2.5 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
            type="password"
            name="password"
            placeholder="••••••••"
            required
          />
        </div>
        <button className="bg-primary text-primary-foreground rounded-lg px-4 py-2.5 font-medium hover:opacity-90 transition-opacity">
          Sign In
        </button>
        <div className="text-center text-sm text-muted-foreground mt-2">
          Don't have an account?{' '}
          <a href="/signup" className="text-primary hover:underline font-semibold">
            Sign Up
          </a>
        </div>
        <Messages />
      </form>
    </div>
  );
}
