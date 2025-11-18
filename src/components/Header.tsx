import schoolLogo from '@/assets/school-logo.png';

interface HeaderProps {
  title: string;
  showLogo?: boolean;
}

export default function Header({ title, showLogo = true }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full bg-card border-b border-border backdrop-blur-sm bg-card/80">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">{title}</h1>
        {showLogo && (
          <img 
            src={schoolLogo} 
            alt="אורות יבנה" 
            className="h-8 md:h-10 w-auto"
          />
        )}
      </div>
    </header>
  );
}