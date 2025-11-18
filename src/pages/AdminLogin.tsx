import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import schoolLogo from '@/assets/school-logo.png';

const ADMIN_PASSWORD = '987654321';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('adminAuth', 'true');
      navigate('/admin');
    } else {
      toast({
        title: 'סיסמה שגויה. נסה שוב.',
        variant: 'destructive',
      });
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header title="כניסת מנהלים" showLogo={false} />

      <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
        <Card className="p-8 max-w-md w-full card-elevated">
          <div className="text-center mb-8">
            <img 
              src={schoolLogo} 
              alt="אורט אורמת" 
              className="h-20 w-auto mx-auto mb-4 opacity-80"
            />
            <h2 className="text-2xl font-bold text-foreground mb-2">ניהול מערכות – אורט אורמת</h2>
            <p className="text-muted-foreground">הזן סיסמה להמשך</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                <Lock className="inline-block ml-2 h-4 w-4" />
                סיסמה
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="הזן סיסמה"
                className="text-lg h-12"
                autoFocus
              />
            </div>

            <Button 
              onClick={handleLogin}
              className="w-full gradient-primary text-lg h-12"
            >
              התחבר
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="w-full"
            >
              <ArrowRight className="ml-2 h-4 w-4" />
              חזור
            </Button>
          </div>
        </Card>
      </main>

      <Footer />
    </div>
  );
}