export default function LogoutButton() {
  return (
    <form action="/auth/sign-out" method="post">
      <button className="px-4 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-lg transition-all duration-200 border border-border">
        Logout
      </button>
    </form>
  );
}
