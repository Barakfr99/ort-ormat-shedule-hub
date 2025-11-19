import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Upload, ArrowRight } from 'lucide-react';

export default function UploadExcel() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [dialogType, setDialogType] = useState<'success' | 'error'>('success');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setDialogMessage('אנא בחר קובץ להעלאה');
      setDialogType('error');
      setDialogOpen(true);
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('upload-excel', {
        body: formData,
      });

      if (error) throw error;

      if (data.success) {
        setDialogMessage(`הקובץ הועלה בהצלחה!\nתלמידים: ${data.stats.students}\nשעות: ${data.stats.scheduleEntries}`);
        setDialogType('success');
        setFile(null);
      } else {
        throw new Error(data.error || 'שגיאה בהעלאת הקובץ');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setDialogMessage(`שגיאה: ${error.message}`);
      setDialogType('error');
    } finally {
      setUploading(false);
      setDialogOpen(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header title="העלאת קובץ אקסל - אורט אורמת" />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <Card className="p-6 md:p-8 card-elevated space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold">העלאת מערכת שעות</h2>
            <p className="text-muted-foreground">
              העלה קובץ אקסל חדש כדי לעדכן את מערכות השעות של כל התלמידים
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="excel-file">בחר קובץ אקסל</Label>
              <Input
                id="excel-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={uploading}
                className="cursor-pointer"
              />
              {file && (
                <p className="text-sm text-muted-foreground">
                  קובץ נבחר: {file.name}
                </p>
              )}
            </div>

            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h3 className="font-semibold text-sm">דרישות הקובץ:</h3>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>העמודה הראשונה: שם התלמיד</li>
                <li>העמודה השנייה: כיתה</li>
                <li>40 העמודות הבאות: 8 שעות × 5 ימים</li>
                <li>הקובץ יחליף את כל המידע הקיים במערכת</li>
              </ul>
            </div>

            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full"
              size="lg"
            >
              {uploading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  מעלה קובץ...
                </>
              ) : (
                <>
                  <Upload className="ml-2 h-4 w-4" />
                  העלה קובץ
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate('/admin')}
              className="w-full"
            >
              <ArrowRight className="ml-2 h-4 w-4" />
              חזרה לניהול
            </Button>
          </div>
        </Card>
      </main>

      <Footer />

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogType === 'success' ? 'הצלחה' : 'שגיאה'}
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {dialogMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Button onClick={() => setDialogOpen(false)}>סגור</Button>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}