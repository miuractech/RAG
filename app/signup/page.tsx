import Messages from './messages';

export default function Signup() {
  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-2">Create Account</h1>
        <p className="text-sm text-gray-600">Join Crownwell AI to start chatting with your files</p>
      </div>
      <form
        className="flex-1 flex flex-col w-full justify-center gap-2 text-foreground"
        action="/auth/sign-up"
        method="post"
      >
        <label className="text-md" htmlFor="email">
          Email
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          name="email"
          placeholder="you@example.com"
          required
        />
        <label className="text-md" htmlFor="password">
          Password
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          type="password"
          name="password"
          placeholder="••••••••"
          required
        />
        <button className="bg-green-700 rounded px-4 py-2 text-white mb-2">
          Sign Up
        </button>
        <div className="text-center text-sm text-gray-600 mt-4">
          Already have an account?{' '}
          <a href="/login" className="text-green-700 hover:underline font-semibold">
            Sign In
          </a>
        </div>
        <Messages />
      </form>
    </div>
  );
}

