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
import { Loader2, Plus, Edit2, Trash2, ArrowRight, CheckCircle2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface WorkflowStage {
  id: string;
  category_id: string;
  stage_name: string;
  stage_order: number;
  description: string | null;
  required_fields: string[] | null;
  is_active: boolean;
}

interface WorkflowTransition {
  id: string;
  category_id: string;
  from_stage_id: string;
  to_stage_id: string;
  allowed_roles: string[];
  description: string | null;
  is_active: boolean;
}

export default function WorkflowConfiguration() {
  const { role } = useAuth();
  const isSuperAdmin = role === "super_admin";

  const [categories, setCategories] = useState<WorkflowCategory[]>([]);
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [showTransitionDialog, setShowTransitionDialog] = useState(false);

  // Form states
  const [selectedCategory, setSelectedCategory] = useState<WorkflowCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [stageForm, setStageForm] = useState({ stage_name: "", stage_order: 1, description: "", required_fields: "" });
  const [transitionForm, setTransitionForm] = useState({ from_stage: "", to_stage: "", allowed_roles: ["super_admin"] });

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!isSuperAdmin) return;
      setLoading(true);
      try {
        const [categoriesRes, stagesRes, transitionsRes] = await Promise.all([
          supabase.from("workflow_categories").select("*").order("created_at", { ascending: false }),
          supabase.from("workflow_stages").select("*").order("stage_order", { ascending: true }),
          supabase.from("workflow_transitions").select("*"),
        ]);

        if (categoriesRes.data) setCategories(categoriesRes.data);
        if (stagesRes.data) setStages(stagesRes.data);
        if (transitionsRes.data) setTransitions(transitionsRes.data);
      } catch (error: any) {
        toast({ title: "Gagal memuat data", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isSuperAdmin]);

  const handleAddCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast({ title: "Nama kategori wajib diisi", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("workflow_categories")
        .insert([{ name: categoryForm.name, description: categoryForm.description || null }])
        .select();

      if (error) throw error;
      if (data) {
        setCategories([...categories, data[0]]);
        setCategoryForm({ name: "", description: "" });
        setShowCategoryDialog(false);
        toast({ title: "Kategori workflow berhasil ditambahkan" });
      }
    } catch (error: any) {
      toast({ title: "Gagal menambahkan kategori", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddStage = async () => {
    if (!selectedCategory || !stageForm.stage_name.trim()) {
      toast({ title: "Pilih kategori dan nama tahap", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("workflow_stages")
        .insert([{
          category_id: selectedCategory.id,
          stage_name: stageForm.stage_name,
          stage_order: stageForm.stage_order,
          description: stageForm.description || null,
          required_fields: stageForm.required_fields ? stageForm.required_fields.split(",").map(f => f.trim()) : null,
        }])
        .select();

      if (error) throw error;
      if (data) {
        setStages([...stages, data[0]]);
        setStageForm({ stage_name: "", stage_order: 1, description: "", required_fields: "" });
        setShowStageDialog(false);
        toast({ title: "Tahap workflow berhasil ditambahkan" });
      }
    } catch (error: any) {
      toast({ title: "Gagal menambahkan tahap", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus kategori ini?")) return;
    try {
      const { error } = await supabase.from("workflow_categories").delete().eq("id", id);
      if (error) throw error;
      setCategories(categories.filter(c => c.id !== id));
      toast({ title: "Kategori berhasil dihapus" });
    } catch (error: any) {
      toast({ title: "Gagal menghapus kategori", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteStage = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus tahap ini?")) return;
    try {
      const { error } = await supabase.from("workflow_stages").delete().eq("id", id);
      if (error) throw error;
      setStages(stages.filter(s => s.id !== id));
      toast({ title: "Tahap berhasil dihapus" });
    } catch (error: any) {
      toast({ title: "Gagal menghapus tahap", description: error.message, variant: "destructive" });
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Anda tidak memiliki akses ke halaman ini.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const categoryStages = selectedCategory ? stages.filter(s => s.category_id === selectedCategory.id) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Konfigurasi Workflow</h1>
          <p className="text-muted-foreground mt-2">Atur alur kerja dan tahapan proses sertifikasi halal</p>
        </div>
        <Button onClick={() => setShowCategoryDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Kategori
        </Button>
      </div>

      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="categories">Kategori</TabsTrigger>
          <TabsTrigger value="stages">Tahapan</TabsTrigger>
          <TabsTrigger value="transitions">Transisi</TabsTrigger>
        </TabsList>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Kategori Workflow
              </CardTitle>
              <CardDescription>Kelola kategori workflow untuk berbagai jenis sertifikasi</CardDescription>
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
                        <TableHead className="font-bold">Nama Kategori</TableHead>
                        <TableHead className="font-bold">Deskripsi</TableHead>
                        <TableHead className="font-bold text-center">Status</TableHead>
                        <TableHead className="w-[100px] text-center font-bold">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Belum ada kategori workflow
                          </TableCell>
                        </TableRow>
                      ) : (
                        categories.map(cat => (
                          <TableRow key={cat.id} className="hover:bg-muted/20 transition-all">
                            <TableCell className="font-semibold">{cat.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{cat.description || "-"}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={cat.is_active ? "default" : "secondary"}>
                                {cat.is_active ? "Aktif" : "Nonaktif"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex gap-2 justify-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCategory(cat);
                                    setShowStageDialog(true);
                                  }}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteCategory(cat.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stages Tab */}
        <TabsContent value="stages" className="space-y-4">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Tahapan Workflow
              </CardTitle>
              <CardDescription>Kelola tahapan dalam setiap kategori workflow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {categories.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Tambahkan kategori terlebih dahulu</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Pilih Kategori</Label>
                    <select
                      value={selectedCategory?.id || ""}
                      onChange={(e) => {
                        const cat = categories.find(c => c.id === e.target.value);
                        setSelectedCategory(cat || null);
                      }}
                      className="w-full px-3 py-2 border rounded-lg bg-background"
                    >
                      <option value="">-- Pilih Kategori --</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  {selectedCategory && (
                    <>
                      <Button onClick={() => setShowStageDialog(true)} className="w-full gap-2" variant="outline">
                        <Plus className="h-4 w-4" />
                        Tambah Tahap
                      </Button>

                      <div className="rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/30">
                            <TableRow>
                              <TableHead className="font-bold">Urutan</TableHead>
                              <TableHead className="font-bold">Nama Tahap</TableHead>
                              <TableHead className="font-bold">Field Wajib</TableHead>
                              <TableHead className="w-[100px] text-center font-bold">Aksi</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {categoryStages.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                  Belum ada tahap dalam kategori ini
                                </TableCell>
                              </TableRow>
                            ) : (
                              categoryStages.map(stage => (
                                <TableRow key={stage.id} className="hover:bg-muted/20 transition-all">
                                  <TableCell className="font-semibold">{stage.stage_order}</TableCell>
                                  <TableCell>{stage.stage_name}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {stage.required_fields?.join(", ") || "-"}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteStage(stage.id)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transitions Tab */}
        <TabsContent value="transitions" className="space-y-4">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRight className="h-5 w-5 text-primary" />
                Transisi Tahapan
              </CardTitle>
              <CardDescription>Kelola transisi yang diizinkan antar tahapan</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-8">Fitur transisi akan ditampilkan di sini</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Kategori Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nama Kategori</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="Contoh: Sertifikasi Halal Standard"
              />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Input
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Deskripsi kategori workflow"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>Batal</Button>
            <Button onClick={handleAddCategory} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Stage Dialog */}
      <Dialog open={showStageDialog} onOpenChange={setShowStageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Tahap Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nama Tahap</Label>
              <Input
                value={stageForm.stage_name}
                onChange={(e) => setStageForm({ ...stageForm, stage_name: e.target.value })}
                placeholder="Contoh: Verifikasi Data"
              />
            </div>
            <div>
              <Label>Urutan</Label>
              <Input
                type="number"
                value={stageForm.stage_order}
                onChange={(e) => setStageForm({ ...stageForm, stage_order: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div>
              <Label>Field Wajib (pisahkan dengan koma)</Label>
              <Input
                value={stageForm.required_fields}
                onChange={(e) => setStageForm({ ...stageForm, required_fields: e.target.value })}
                placeholder="nama, email, alamat"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStageDialog(false)}>Batal</Button>
            <Button onClick={handleAddStage} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
