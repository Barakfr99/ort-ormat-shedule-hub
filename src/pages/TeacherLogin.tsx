import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { findTeacherByCode } from "@/lib/teachers";
import { ArrowRight, UserCheck2 } from "lucide-react";
import schoolLogo from "@/assets/school-logo.png";
import { getStoredTeacher, persistTeacherSession } from "@/hooks/useTeacherAuth";

export default function TeacherLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [code, setCode] = useState("");

  useEffect(() => {
    if (getStoredTeacher()) {
      navigate("/teacher", { replace: true });
    }
  }, [navigate]);

  const handleLogin = () => {
    const teacher = findTeacherByCode(code);

    if (!teacher) {
      toast({
        title: "קוד מורה שגוי",
        description: "אנא ודא שהזנת את תעודת הזהות כפי שנמסרה לך.",
        variant: "destructive",
      });
      setCode("");
      return;
    }

    persistTeacherSession(teacher);

    toast({
      title: "ברוך/ה הבא/ה",
      description: `${teacher.name}, הכניסה הושלמה בהצלחה.`,
    });

    navigate("/teacher");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header title="כניסת מורים" showLogo={false} />

      <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
        <Card className="p-8 max-w-md w-full card-elevated">
          <div className="text-center mb-8">
            <img
              src={schoolLogo}
              alt="אורט אורמת"
              className="h-20 w-auto mx-auto mb-4 opacity-80"
            />
            <h2 className="text-2xl font-bold text-foreground mb-2">
              כניסת מורים למערכת השעות
            </h2>
            <p className="text-muted-foreground">
              הזן את מספר תעודת הזהות שקיבלת מהנהלת בית הספר
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                <UserCheck2 className="inline-block ml-2 h-4 w-4" />
                קוד מורה (תעודת זהות)
              </label>
              <Input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="הזן מספר מלא ללא מקפים"
                className="text-lg h-12 text-center"
                autoFocus
              />
            </div>

            <Button onClick={handleLogin} className="w-full gradient-primary text-lg h-12">
              התחברות מורה
            </Button>

            <Button variant="outline" onClick={() => navigate("/")} className="w-full">
              <ArrowRight className="ml-2 h-4 w-4" />
              חזרה לעמוד הראשי
            </Button>
          </div>
        </Card>
      </main>

      <Footer />
    </div>
  );
}

