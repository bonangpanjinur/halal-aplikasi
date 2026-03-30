// This is the updated Komisi Tab section for AppSettings.tsx
// Replace the existing Komisi Tab (around line 527-553) with this content

{isOwner && (
  <TabsContent value="komisi" className="space-y-6 outline-none">
    <Card className="border-none shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> Tarif Komisi Tim</CardTitle>
        <CardDescription>Atur jumlah komisi yang didapatkan tim Anda untuk satu data entri yang berhasil.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(rates)
          .filter(([roleKey]) => !["super_admin", "owner"].includes(roleKey))
          .map(([r, amount]) => (
            <div key={r} className="flex items-center gap-4 p-4 border rounded-xl bg-card">
              <Label className="w-40 capitalize font-semibold text-sm">{r.replace("_", " ")}</Label>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Rp</span>
                <Input type="number" value={amount} onChange={(e) => setRates(prev => ({ ...prev, [r]: parseInt(e.target.value) || 0 }))} className="pl-10 h-11" />
              </div>
            </div>
          ))}
      </CardContent>
    </Card>
    <Button onClick={handleSaveRates} disabled={savingRates} className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20">
      {savingRates ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
      Simpan Tarif Komisi Tim
    </Button>

    <Card className="border-none shadow-md bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-primary" /> Pengaturan Komisi & Gaji per Role</CardTitle>
        <CardDescription>Atur skema pembayaran untuk setiap role: pilih komisi per sertifikat atau gaji bulanan, tambahkan uang transport, dan tentukan target serta bonus kelebihan target.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(rates)
          .filter(([roleKey]) => !["super_admin", "owner"].includes(roleKey))
          .map(([roleKey]) => (
            <div key={roleKey} className="p-4 border rounded-xl bg-card/50 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h4 className="font-semibold capitalize text-base">{roleKey.replace("_", " ")}</h4>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">{roleKey}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Jenis Komisi</Label>
                  <Select defaultValue="per_certificate">
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_certificate">Komisi Per Sertifikat</SelectItem>
                      <SelectItem value="monthly_salary">Gaji Per Bulan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Gaji Pokok (Rp)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rp</span>
                    <Input type="number" placeholder="0" className="pl-10 h-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Uang Transport (Rp)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rp</span>
                    <Input type="number" placeholder="0" className="pl-10 h-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Target KTP/Bulan</Label>
                  <Input type="number" placeholder="130" defaultValue="130" className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Bonus per KTP Melebihi Target (Rp)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rp</span>
                    <Input type="number" placeholder="25000" defaultValue="25000" className="pl-10 h-10" />
                  </div>
                </div>
              </div>
            </div>
          ))}
      </CardContent>
    </Card>
    <Button className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20">
      <Save className="mr-2 h-5 w-5" />
      Simpan Semua Pengaturan Komisi
    </Button>
  </TabsContent>
)}
