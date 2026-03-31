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
import { Loader2, Plus, Edit2, Trash2, FileText, Copy, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentTemplate {
  id: string;
  owner_id: string | null;
  name: string;
  description: string | null;
  template_type: string;
  content: any;
  is_active: boolean;
  is_global: boolean;
  created_at: string;
}

interface FormField {
  id: string;
  template_id: string;
  field_name: string;
  field_type: string;
  field_label: string;
  placeholder: string | null;
  is_required: boolean;
  field_order: number;
  validation_rules: any;
  options: any;
  help_text: string | null;
}

export default function DocumentTemplates() {
  const { role, user } = useAuth();
  const isSuperAdmin = role === "super_admin";
  const isOwner = role === "owner";

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showFieldDialog, setShowFieldDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Form states
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    template_type: "form",
  });
  const [fieldForm, setFieldForm] = useState({
    field_name: "",
    field_type: "text",
    field_label: "",
    placeholder: "",
    is_required: false,
    field_order: 1,
    help_text: "",
  });

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        let query = supabase.from("document_templates").select("*");

        if (isSuperAdmin) {
          // Super admin sees all templates
          query = query.order("created_at", { ascending: false });
        } else if (isOwner && user) {
          // Owner sees their own and global templates
          query = query.or(`owner_id.eq.${user.id},is_global.eq.true`).order("created_at", { ascending: false });
        }

        const { data, error } = await query;
        if (error) throw error;
        setTemplates(data || []);
      } catch (error: any) {
        toast({ title: "Gagal memuat template", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, [isSuperAdmin, isOwner, user]);

  // Fetch fields for selected template
  useEffect(() => {
    const fetchFields = async () => {
      if (!selectedTemplate) return;
      try {
        const { data, error } = await supabase
          .from("form_fields")
          .select("*")
          .eq("template_id", selectedTemplate.id)
          .order("field_order", { ascending: true });

        if (error) throw error;
        setFields(data || []);
      } catch (error: any) {
        toast({ title: "Gagal memuat field", description: error.message, variant: "destructive" });
      }
    };
    fetchFields();
  }, [selectedTemplate]);

  const handleAddTemplate = async () => {
    if (!templateForm.name.trim()) {
      toast({ title: "Nama template wajib diisi", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("document_templates")
        .insert([{
          owner_id: isOwner ? user?.id : null,
          name: templateForm.name,
          description: templateForm.description || null,
          template_type: templateForm.template_type,
          content: {},
          is_global: isSuperAdmin,
        }])
        .select();

      if (error) throw error;
      if (data) {
        setTemplates([...templates, data[0]]);
        setTemplateForm({ name: "", description: "", template_type: "form" });
        setShowTemplateDialog(false);
        toast({ title: "Template berhasil ditambahkan" });
      }
    } catch (error: any) {
      toast({ title: "Gagal menambahkan template", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddField = async () => {
    if (!selectedTemplate || !fieldForm.field_name.trim() || !fieldForm.field_label.trim()) {
      toast({ title: "Nama field dan label wajib diisi", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("form_fields")
        .insert([{
          template_id: selectedTemplate.id,
          field_name: fieldForm.field_name,
          field_type: fieldForm.field_type,
          field_label: fieldForm.field_label,
          placeholder: fieldForm.placeholder || null,
          is_required: fieldForm.is_required,
          field_order: fieldForm.field_order,
          help_text: fieldForm.help_text || null,
          validation_rules: {},
          options: [],
        }])
        .select();

      if (error) throw error;
      if (data) {
        setFields([...fields, data[0]]);
        setFieldForm({
          field_name: "",
          field_type: "text",
          field_label: "",
          placeholder: "",
          is_required: false,
          field_order: fields.length + 1,
          help_text: "",
        });
        setShowFieldDialog(false);
        toast({ title: "Field berhasil ditambahkan" });
      }
    } catch (error: any) {
      toast({ title: "Gagal menambahkan field", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus template ini?")) return;
    try {
      const { error } = await supabase.from("document_templates").delete().eq("id", id);
      if (error) throw error;
      setTemplates(templates.filter(t => t.id !== id));
      if (selectedTemplate?.id === id) setSelectedTemplate(null);
      toast({ title: "Template berhasil dihapus" });
    } catch (error: any) {
      toast({ title: "Gagal menghapus template", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteField = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus field ini?")) return;
    try {
      const { error } = await supabase.from("form_fields").delete().eq("id", id);
      if (error) throw error;
      setFields(fields.filter(f => f.id !== id));
      toast({ title: "Field berhasil dihapus" });
    } catch (error: any) {
      toast({ title: "Gagal menghapus field", description: error.message, variant: "destructive" });
    }
  };

  const getFieldTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      text: "Teks",
      email: "Email",
      number: "Angka",
      date: "Tanggal",
      select: "Pilihan",
      checkbox: "Checkbox",
      textarea: "Area Teks",
      file: "File",
    };
    return types[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Template Dokumen & Formulir</h1>
          <p className="text-muted-foreground mt-2">Kelola template formulir dan dokumen untuk pengumpulan data</p>
        </div>
        <Button onClick={() => setShowTemplateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Template
        </Button>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates">Template</TabsTrigger>
          <TabsTrigger value="fields">Field</TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Daftar Template
              </CardTitle>
              <CardDescription>Kelola template dokumen dan formulir untuk pengumpulan data</CardDescription>
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
                        <TableHead className="font-bold">Nama Template</TableHead>
                        <TableHead className="font-bold">Tipe</TableHead>
                        <TableHead className="font-bold">Deskripsi</TableHead>
                        <TableHead className="font-bold text-center">Status</TableHead>
                        <TableHead className="w-[120px] text-center font-bold">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            Belum ada template dokumen
                          </TableCell>
                        </TableRow>
                      ) : (
                        templates.map(template => (
                          <TableRow key={template.id} className="hover:bg-muted/20 transition-all">
                            <TableCell className="font-semibold">{template.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{template.template_type}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{template.description || "-"}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={template.is_active ? "default" : "secondary"}>
                                {template.is_active ? "Aktif" : "Nonaktif"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex gap-2 justify-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTemplate(template);
                                    setShowPreview(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTemplate(template);
                                  }}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteTemplate(template.id)}
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

        {/* Fields Tab */}
        <TabsContent value="fields" className="space-y-4">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Field Formulir
              </CardTitle>
              <CardDescription>Kelola field dalam template formulir</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {templates.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Tambahkan template terlebih dahulu</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Pilih Template</Label>
                    <select
                      value={selectedTemplate?.id || ""}
                      onChange={(e) => {
                        const template = templates.find(t => t.id === e.target.value);
                        setSelectedTemplate(template || null);
                      }}
                      className="w-full px-3 py-2 border rounded-lg bg-background"
                    >
                      <option value="">-- Pilih Template --</option>
                      {templates.map(template => (
                        <option key={template.id} value={template.id}>{template.name}</option>
                      ))}
                    </select>
                  </div>

                  {selectedTemplate && (
                    <>
                      <Button onClick={() => setShowFieldDialog(true)} className="w-full gap-2" variant="outline">
                        <Plus className="h-4 w-4" />
                        Tambah Field
                      </Button>

                      <div className="rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/30">
                            <TableRow>
                              <TableHead className="font-bold">Urutan</TableHead>
                              <TableHead className="font-bold">Nama Field</TableHead>
                              <TableHead className="font-bold">Tipe</TableHead>
                              <TableHead className="font-bold text-center">Wajib</TableHead>
                              <TableHead className="w-[100px] text-center font-bold">Aksi</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {fields.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                  Belum ada field dalam template ini
                                </TableCell>
                              </TableRow>
                            ) : (
                              fields.map(field => (
                                <TableRow key={field.id} className="hover:bg-muted/20 transition-all">
                                  <TableCell className="font-semibold">{field.field_order}</TableCell>
                                  <TableCell>{field.field_label}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{getFieldTypeLabel(field.field_type)}</Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {field.is_required ? (
                                      <Badge className="bg-red-500">Ya</Badge>
                                    ) : (
                                      <Badge variant="secondary">Tidak</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteField(field.id)}
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
      </Tabs>

      {/* Add Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Template Dokumen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nama Template</Label>
              <Input
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="Contoh: Form Verifikasi Halal"
              />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Input
                value={templateForm.description}
                onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                placeholder="Deskripsi template"
              />
            </div>
            <div>
              <Label>Tipe Template</Label>
              <select
                value={templateForm.template_type}
                onChange={(e) => setTemplateForm({ ...templateForm, template_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-background"
              >
                <option value="form">Formulir</option>
                <option value="document">Dokumen</option>
                <option value="checklist">Checklist</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Batal</Button>
            <Button onClick={handleAddTemplate} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Field Dialog */}
      <Dialog open={showFieldDialog} onOpenChange={setShowFieldDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Field Formulir</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nama Field</Label>
              <Input
                value={fieldForm.field_name}
                onChange={(e) => setFieldForm({ ...fieldForm, field_name: e.target.value })}
                placeholder="Contoh: nama_pemilik"
              />
            </div>
            <div>
              <Label>Label Field</Label>
              <Input
                value={fieldForm.field_label}
                onChange={(e) => setFieldForm({ ...fieldForm, field_label: e.target.value })}
                placeholder="Contoh: Nama Pemilik Usaha"
              />
            </div>
            <div>
              <Label>Tipe Field</Label>
              <select
                value={fieldForm.field_type}
                onChange={(e) => setFieldForm({ ...fieldForm, field_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-background"
              >
                <option value="text">Teks</option>
                <option value="email">Email</option>
                <option value="number">Angka</option>
                <option value="date">Tanggal</option>
                <option value="select">Pilihan</option>
                <option value="checkbox">Checkbox</option>
                <option value="textarea">Area Teks</option>
                <option value="file">File</option>
              </select>
            </div>
            <div>
              <Label>Placeholder</Label>
              <Input
                value={fieldForm.placeholder}
                onChange={(e) => setFieldForm({ ...fieldForm, placeholder: e.target.value })}
                placeholder="Teks placeholder"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={fieldForm.is_required}
                onChange={(e) => setFieldForm({ ...fieldForm, is_required: e.target.checked })}
              />
              <Label>Field Wajib</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFieldDialog(false)}>Batal</Button>
            <Button onClick={handleAddField} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
