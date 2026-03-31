import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Star, MessageSquare, TrendingUp, Send, Reply } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppRating {
  id: string;
  user_id: string;
  entry_id: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface RatingResponse {
  id: string;
  rating_id: string;
  response_text: string;
  responded_by: string | null;
  responded_at: string;
}

interface RatingAnalytics {
  id: string;
  period: string;
  total_ratings: number;
  average_rating: number;
  rating_1_count: number;
  rating_2_count: number;
  rating_3_count: number;
  rating_4_count: number;
  rating_5_count: number;
}

export default function UserRatings() {
  const { role, user } = useAuth();
  const isSuperAdmin = role === "super_admin";
  const isOwner = role === "owner";
  const isUmkm = role === "umkm";

  const [ratings, setRatings] = useState<AppRating[]>([]);
  const [analytics, setAnalytics] = useState<RatingAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [showResponseDialog, setShowResponseDialog] = useState(false);

  // Form states
  const [ratingForm, setRatingForm] = useState({
    rating: 5,
    title: "",
    comment: "",
    category: "general",
  });
  const [selectedRating, setSelectedRating] = useState<AppRating | null>(null);
  const [responseText, setResponseText] = useState("");

  // Fetch ratings
  useEffect(() => {
    const fetchRatings = async () => {
      setLoading(true);
      try {
        let query = supabase.from("app_ratings").select("*");

        if (isUmkm && user) {
          query = query.eq("user_id", user.id);
        } else if (isOwner && user) {
          query = query.in(
            "user_id",
            supabase.from("profiles").select("id").eq("owner_id", user.id)
          );
        }

        const { data, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;
        setRatings(data || []);

        // Fetch analytics for today
        const today = new Date().toISOString().split("T")[0];
        const { data: analyticsData } = await supabase
          .from("rating_analytics")
          .select("*")
          .eq("period", today)
          .single();

        if (analyticsData) setAnalytics(analyticsData);
      } catch (error: any) {
        toast({ title: "Gagal memuat rating", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchRatings();
  }, [isUmkm, isOwner, user]);

  const handleAddRating = async () => {
    if (!user) {
      toast({ title: "Anda harus login terlebih dahulu", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("app_ratings")
        .insert([{
          user_id: user.id,
          rating: ratingForm.rating,
          title: ratingForm.title || null,
          comment: ratingForm.comment || null,
          category: ratingForm.category,
          status: "submitted",
        }])
        .select();

      if (error) throw error;
      if (data) {
        setRatings([data[0], ...ratings]);
        setRatingForm({ rating: 5, title: "", comment: "", category: "general" });
        setShowRatingDialog(false);
        toast({ title: "Rating berhasil dikirim, terima kasih!" });
      }
    } catch (error: any) {
      toast({ title: "Gagal mengirim rating", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddResponse = async () => {
    if (!selectedRating || !responseText.trim()) {
      toast({ title: "Teks respons tidak boleh kosong", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("rating_responses")
        .insert([{
          rating_id: selectedRating.id,
          response_text: responseText,
          responded_by: user?.id,
        }])
        .select();

      if (error) throw error;
      if (data) {
        setResponseText("");
        setShowResponseDialog(false);
        toast({ title: "Respons berhasil dikirim" });
        // Refresh ratings
        const { data: updatedRatings } = await supabase
          .from("app_ratings")
          .select("*")
          .order("created_at", { ascending: false });
        if (updatedRatings) setRatings(updatedRatings);
      }
    } catch (error: any) {
      toast({ title: "Gagal mengirim respons", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return "text-green-500";
    if (rating >= 3) return "text-yellow-500";
    return "text-red-500";
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      general: "Umum",
      workflow: "Workflow",
      support: "Dukungan",
      ui: "Antarmuka",
      performance: "Performa",
    };
    return labels[category] || category;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rating & Feedback</h1>
          <p className="text-muted-foreground mt-2">
            {isUmkm
              ? "Bagikan pengalaman Anda menggunakan aplikasi HalalTrack"
              : "Kelola rating dan feedback dari pengguna"}
          </p>
        </div>
        {isUmkm && (
          <Button onClick={() => setShowRatingDialog(true)} className="gap-2">
            <Star className="h-4 w-4" />
            Berikan Rating
          </Button>
        )}
      </div>

      {/* Analytics Cards */}
      {(isSuperAdmin || isOwner) && analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-none shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Rating</p>
                  <p className="text-2xl font-bold">{analytics.total_ratings}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rata-rata Rating</p>
                  <p className="text-2xl font-bold">{analytics.average_rating.toFixed(1)}</p>
                </div>
                <Star className="h-8 w-8 text-yellow-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rating 5 Bintang</p>
                  <p className="text-2xl font-bold">{analytics.rating_5_count}</p>
                </div>
                <Star className="h-8 w-8 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rating &lt; 3 Bintang</p>
                  <p className="text-2xl font-bold">{analytics.rating_1_count + analytics.rating_2_count}</p>
                </div>
                <Star className="h-8 w-8 text-red-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ratings Table */}
      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Daftar Rating & Feedback
          </CardTitle>
          <CardDescription>
            {isUmkm
              ? "Rating dan feedback yang telah Anda berikan"
              : "Kelola semua rating dan feedback dari pengguna"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-bold">Rating</TableHead>
                    <TableHead className="font-bold">Judul</TableHead>
                    <TableHead className="font-bold">Kategori</TableHead>
                    <TableHead className="font-bold">Komentar</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                    <TableHead className="font-bold">Tanggal</TableHead>
                    {(isSuperAdmin || isOwner) && <TableHead className="w-[100px] text-center font-bold">Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ratings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isSuperAdmin || isOwner ? 7 : 6} className="text-center py-8 text-muted-foreground">
                        Belum ada rating
                      </TableCell>
                    </TableRow>
                  ) : (
                    ratings.map(rating => (
                      <TableRow key={rating.id} className="hover:bg-muted/20 transition-all">
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {[...Array(rating.rating)].map((_, i) => (
                              <Star key={i} className={cn("h-4 w-4", getRatingColor(rating.rating))} fill="currentColor" />
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">{rating.title || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getCategoryLabel(rating.category)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{rating.comment || "-"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={rating.status === "submitted" ? "default" : "secondary"}>
                            {rating.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(rating.created_at).toLocaleDateString("id-ID")}
                        </TableCell>
                        {(isSuperAdmin || isOwner) && (
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedRating(rating);
                                setShowResponseDialog(true);
                              }}
                            >
                              <Reply className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Rating Dialog */}
      <Dialog open={showRatingDialog} onOpenChange={setShowRatingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Berikan Rating & Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rating (1-5 Bintang)</Label>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRatingForm({ ...ratingForm, rating: star })}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={cn(
                        "h-8 w-8",
                        star <= ratingForm.rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Kategori</Label>
              <select
                value={ratingForm.category}
                onChange={(e) => setRatingForm({ ...ratingForm, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-background"
              >
                <option value="general">Umum</option>
                <option value="workflow">Workflow</option>
                <option value="support">Dukungan</option>
                <option value="ui">Antarmuka</option>
                <option value="performance">Performa</option>
              </select>
            </div>
            <div>
              <Label>Judul (Opsional)</Label>
              <Input
                value={ratingForm.title}
                onChange={(e) => setRatingForm({ ...ratingForm, title: e.target.value })}
                placeholder="Judul singkat untuk feedback Anda"
              />
            </div>
            <div>
              <Label>Komentar</Label>
              <textarea
                value={ratingForm.comment}
                onChange={(e) => setRatingForm({ ...ratingForm, comment: e.target.value })}
                placeholder="Bagikan pengalaman Anda..."
                className="w-full px-3 py-2 border rounded-lg bg-background resize-none"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRatingDialog(false)}>Batal</Button>
            <Button onClick={handleAddRating} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Kirim Rating
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Response Dialog */}
      <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Balas Rating</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRating && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {[...Array(selectedRating.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-yellow-500" fill="currentColor" />
                  ))}
                </div>
                <p className="font-semibold">{selectedRating.title || "Tanpa Judul"}</p>
                <p className="text-sm text-muted-foreground mt-1">{selectedRating.comment}</p>
              </div>
            )}
            <div>
              <Label>Respons Anda</Label>
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Tulis respons untuk rating ini..."
                className="w-full px-3 py-2 border rounded-lg bg-background resize-none"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResponseDialog(false)}>Batal</Button>
            <Button onClick={handleAddResponse} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Kirim Respons
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
