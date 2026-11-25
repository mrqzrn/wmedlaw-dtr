import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4">
      <h2 className="text-xl font-bold mb-2">Page Not Found</h2>
      <Link href="/" className="text-blue-600 hover:underline text-sm">
        Return to Home
      </Link>
    </div>
  );
}
