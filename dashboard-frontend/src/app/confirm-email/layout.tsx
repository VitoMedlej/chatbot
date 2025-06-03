export default function ConfirmEmailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0 min-h-screen flex items-center justify-center">
      {children}
    </div>
  );
}