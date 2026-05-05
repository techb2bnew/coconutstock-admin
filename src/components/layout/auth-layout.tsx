// import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';

type AuthLayoutProps = {
  children: React.ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  const authBg = PlaceHolderImages.find(p => p.id === 'auth-background');

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-6 sm:p-12 lg:p-0">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
      <div className="hidden bg-muted lg:block relative">
        {authBg && (
          <Image
            src={authBg.imageUrl}
            alt={authBg.description}
            fill
            className="object-cover"
            data-ai-hint={authBg.imageHint}
            priority
          />
        )}
      </div>
    </div>
  );
}
