"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Trash2 } from "lucide-react";
import { equipmentCatalog, type Listing, type VehicleType } from "@/lib/demo-data";
import { Button, Field, inputClass } from "@/components/ui";
import { SiteImage } from "@/components/site-image";

const basicsSchema = z.object({
  title: z.string().trim().min(4, "İlan başlığı en az 4 karakter olmalı."),
  city: z.string().trim().min(2, "Şehir alanını doldur."),
  type: z.string().min(1, "Araç tipini seç."),
  brand: z.string().trim().min(1, "Marka bilgisini doldur."),
  model: z.string().trim().min(1, "Model bilgisini doldur."),
  year: z.coerce.number().int().min(1980, "Model yılı 1980 veya sonrası olmalı.").max(2030, "Model yılını kontrol et."),
  transmission: z.string().min(1, "Vites tipini seç."),
  fuel: z.string().min(1, "Yakıt tipini seç."),
  price: z.coerce.number().min(500, "Gecelik fiyat en az 500 TL olmalı."),
  capacity: z.coerce.number().int().min(1, "Kapasite en az 1 kişi olmalı."),
  beds: z.coerce.number().int().min(1, "Yatak sayısı en az 1 olmalı."),
  dimensions: z.string().trim().min(3, "Araç ölçülerini gir."),
  license: z.string().min(1, "Gerekli ehliyet sınıfını seç."),
  minimumDriverAge: z.coerce.number().int().min(18, "Minimum yaş 18 veya üzeri olmalı.").max(80, "Yaşı kontrol et."),
  minimumNights: z.coerce.number().int().min(1, "Minimum kiralama süresi en az 1 gece olmalı.").max(30, "Minimum gece sayısını kontrol et."),
});
const descriptionSchema = z.string().trim().min(30, "Açıklama en az 30 karakter olmalı.").max(1200, "Açıklama en fazla 1200 karakter olabilir.");
const fileTypes = ["image/jpeg", "image/png", "image/webp"];
const stepLabels = ["Temel bilgiler", "Donanım ve kurallar", "Fotoğraflar", "Önizleme"];
type Photo = { file: File; url: string };

export function ListingWizard({ initial }: { initial?: Listing }) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [city, setCity] = useState(initial ? `${initial.city}, ${initial.district}` : "");
  const [type, setType] = useState<VehicleType | "">(initial?.vehicleType ?? "");
  const [price, setPrice] = useState(initial ? String(initial.nightlyPrice) : "");
  const [capacity, setCapacity] = useState(initial ? String(initial.capacity) : "4");
  const [year, setYear] = useState(initial ? String(initial.year) : "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [transmission, setTransmission] = useState(initial?.transmission ?? "");
  const [fuel, setFuel] = useState(initial?.fuel ?? "");
  const [beds, setBeds] = useState(initial ? String(initial.beds) : "2");
  const [dimensions, setDimensions] = useState(initial?.dimensions ?? "");
  const [license, setLicense] = useState(initial?.license ?? "");
  const [minimumDriverAge, setMinimumDriverAge] = useState(initial ? String(initial.minimumDriverAge) : "25");
  const [minimumNights, setMinimumNights] = useState(initial ? String(initial.minimumNights) : "2");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(initial?.amenities ?? []);
  const [rules, setRules] = useState(initial?.rules.join("\n") ?? "");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const photoUrls = useRef(new Set<string>());
  const [photoError, setPhotoError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");

  useEffect(() => () => photoUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  function next() {
    setNotice("");
    if (step === 0) {
      const parsed = basicsSchema.safeParse({ title, city, type, brand, model, year, transmission, fuel, price, capacity, beds, dimensions, license, minimumDriverAge, minimumNights });
      if (!parsed.success) {
        const nextErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] ?? "");
          if (key && !nextErrors[key]) nextErrors[key] = issue.message;
        }
        setErrors(nextErrors);
        return;
      }
      setErrors({});
    }
    if (step === 1) {
      const parsed = descriptionSchema.safeParse(description);
      if (!parsed.success) {
        setErrors({ description: parsed.error.issues[0]?.message ?? "Açıklamayı kontrol et." });
        return;
      }
      setErrors({});
    }
    if (step === 2 && photos.length === 0 && !initial?.gallery.length) {
      setPhotoError("Önizleme için en az bir fotoğraf ekle.");
      return;
    }
    setStep((current) => Math.min(stepLabels.length - 1, current + 1));
  }

  function addPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    const available = Math.max(0, 10 - (initial?.gallery.length ?? 0) - photos.length);
    const valid: Photo[] = [];
    const messages: string[] = [];
    for (const file of incoming) {
      if (!fileTypes.includes(file.type)) { messages.push(`${file.name}: yalnızca JPEG, PNG veya WebP kabul edilir.`); continue; }
      if (file.size > 5 * 1024 * 1024) { messages.push(`${file.name}: dosya 5 MB sınırını aşıyor.`); continue; }
      if (valid.length >= available) { messages.push("En fazla 10 fotoğraf ekleyebilirsin."); break; }
      const url = URL.createObjectURL(file);
      photoUrls.current.add(url);
      valid.push({ file, url });
    }
    setPhotos((current) => [...current, ...valid].slice(0, 10));
    setPhotoError(messages.join(" "));
    event.target.value = "";
  }

  function removePhoto(url: string) {
    URL.revokeObjectURL(url);
    photoUrls.current.delete(url);
    setPhotos((current) => current.filter((photo) => photo.url !== url));
  }

  function toggleAmenity(item: string) {
    setSelectedAmenities((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  }

  function submit() {
    setNotice("Örnek ilan bilgileri kontrol edildi. Bu demo sürümünde incelemeye gönderilmedi veya kaydedilmedi.");
  }

  return (
    <section className="rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-8">
      <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="İlan oluşturma adımları">
        {stepLabels.map((label, index) => <li key={label} className={`grid gap-2 ${index === step ? "text-forest" : index < step ? "text-sage-strong" : "text-ink-faint"}`}><span className={`grid size-8 place-items-center rounded-full text-xs font-extrabold ${index === step ? "bg-forest text-white" : index < step ? "bg-sage-pale text-forest" : "bg-neutral-soft"}`}>{index < step ? <Check size={15} /> : index + 1}</span><span className="hidden text-xs font-bold sm:block">{label}</span></li>)}
      </ol>
      {step === 0 ? <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="İlan başlığı" error={errors.title}><input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Örn. Ege kıyılarında özgür rota" /></Field></div>
        <Field label="Şehir" error={errors.city}><input className={inputClass} value={city} onChange={(event) => setCity(event.target.value)} placeholder="İzmir" /></Field>
        <Field label="Araç tipi" error={errors.type}><select className={inputClass} value={type} onChange={(event) => setType(event.target.value as VehicleType | "")}><option value="">Seç</option><option>Motokaravan</option><option>Campervan</option><option>Çekme karavan</option></select></Field>
        <Field label="Marka" error={errors.brand}><input className={inputClass} value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Marka" /></Field>
        <Field label="Model" error={errors.model}><input className={inputClass} value={model} onChange={(event) => setModel(event.target.value)} placeholder="Model" /></Field>
        <Field label="Model yılı" error={errors.year}><input className={inputClass} type="number" min="1980" max="2030" value={year} onChange={(event) => setYear(event.target.value)} placeholder="2023" /></Field>
        <Field label="Vites" error={errors.transmission}><select className={inputClass} value={transmission} onChange={(event) => setTransmission(event.target.value)}><option value="">Seç</option><option>Manuel</option><option>Otomatik</option></select></Field>
        <Field label="Yakıt" error={errors.fuel}><select className={inputClass} value={fuel} onChange={(event) => setFuel(event.target.value)}><option value="">Seç</option><option>Dizel</option><option>Benzin</option><option>Hibrit</option><option>Elektrik</option></select></Field>
        <Field label="Kişi kapasitesi" error={errors.capacity}><input className={inputClass} type="number" min="1" max="10" value={capacity} onChange={(event) => setCapacity(event.target.value)} /></Field>
        <Field label="Yatak sayısı" error={errors.beds}><input className={inputClass} type="number" min="1" max="10" value={beds} onChange={(event) => setBeds(event.target.value)} /></Field>
        <Field label="Araç ölçüleri" error={errors.dimensions}><input className={inputClass} value={dimensions} onChange={(event) => setDimensions(event.target.value)} placeholder="5,6 × 2,1 m" /></Field>
        <Field label="Gerekli ehliyet" error={errors.license}><select className={inputClass} value={license} onChange={(event) => setLicense(event.target.value)}><option value="">Seç</option><option>B sınıfı</option><option>B+E sınıfı</option><option>C sınıfı</option></select></Field>
        <Field label="Minimum sürücü yaşı" error={errors.minimumDriverAge}><input className={inputClass} type="number" min="18" max="80" value={minimumDriverAge} onChange={(event) => setMinimumDriverAge(event.target.value)} /></Field>
        <Field label="Minimum kiralama (gece)" error={errors.minimumNights}><input className={inputClass} type="number" min="1" max="30" value={minimumNights} onChange={(event) => setMinimumNights(event.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label="Gecelik fiyat" hint="Örnek fiyat · ödeme veya komisyon yok" error={errors.price}><input className={inputClass} inputMode="numeric" type="number" min="500" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="₺" /></Field></div>
      </div> : null}
      {step === 1 ? <div className="grid gap-6">
        <Field label="İlan açıklaması" error={errors.description} hint="30–1200 karakter"><textarea className={`${inputClass} min-h-28 resize-y py-3`} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Karavanı, kullanımını ve konaklama deneyimini anlat…" /></Field>
        <fieldset><legend className="mb-3 text-sm font-bold text-ink">Karavanda bulunanlar</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{equipmentCatalog.map((item) => <label key={item} className="flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm text-ink-muted hover:bg-paper"><input type="checkbox" className="size-4 accent-forest" checked={selectedAmenities.includes(item)} onChange={() => toggleAmenity(item)} />{item}</label>)}</div></fieldset>
        <Field label="Ev kuralları" hint="Her kuralı ayrı satıra yaz."><textarea className={`${inputClass} min-h-32 resize-y py-3`} value={rules} onChange={(event) => setRules(event.target.value)} placeholder="Araç içinde sigara içilmez.\nMinimum kiralama süresi 2 gece." /></Field>
      </div> : null}
      {step === 2 ? <div>
        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-sage bg-paper p-5 text-center focus-within:ring-2 focus-within:ring-forest"><ImagePlus size={24} className="text-forest" /><span className="mt-2 text-sm font-bold text-ink">Fotoğraf seç</span><span className="mt-1 text-xs text-ink-muted">JPEG, PNG, WebP · en fazla 10 görsel · 5 MB/dosya</span><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addPhotos} /></label>
        {photoError ? <p className="mt-3 text-sm font-semibold text-error" role="alert">{photoError}</p> : null}
        {initial?.gallery.length ? <div className="mt-4"><p className="mb-2 text-sm font-bold text-ink">Mevcut örnek fotoğraflar · {initial.gallery.length}</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{initial.gallery.map((src, index) => <div key={src} className="relative aspect-square overflow-hidden rounded-2xl bg-sage-pale"><SiteImage src={src} alt={`Mevcut örnek fotoğraf ${index + 1}`} fill unoptimized sizes="160px" className="object-cover" /></div>)}</div></div> : null}
        {photos.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{photos.map(({ file, url }) => <div key={url} className="relative overflow-hidden rounded-2xl border border-line"><SiteImage src={url} alt={`${file.name} fotoğraf önizlemesi`} width={320} height={320} unoptimized className="aspect-square w-full object-cover" /><button type="button" aria-label={`${file.name} fotoğrafını sil`} onClick={() => removePhoto(url)} className="absolute right-2 top-2 grid size-11 place-items-center rounded-full bg-white text-error shadow-soft"><Trash2 size={16} /></button></div>)}</div> : !initial?.gallery.length ? <p className="mt-4 text-sm text-ink-muted">Fotoğraflar yalnızca bu tarayıcıda önizlenir; sunucuya yüklenmez.</p> : null}
      </div> : null}
      {step === 3 ? <div className="grid gap-4">
        <div className="rounded-2xl bg-paper p-4"><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-sage-strong">Örnek ilan önizlemesi</p><h2 className="mt-2 font-display text-xl font-bold text-ink">{title || "İlan başlığı"}</h2><p className="mt-1 text-sm text-ink-muted">{city || "Şehir"} · {type || "Araç tipi"} · {capacity} kişi · {beds} yatak</p><p className="mt-3 font-bold text-ink">{price ? `${Number(price).toLocaleString("tr-TR")} ₺ / gece` : "Gecelik fiyat girilmedi"}</p><p className="mt-2 text-xs text-ink-muted">{brand} {model} · {year} · {transmission} · {fuel} · {dimensions}</p><p className="mt-1 text-xs text-ink-muted">{license} ehliyet · en az {minimumDriverAge} yaş · minimum {minimumNights} gece</p><p className="mt-3 text-sm leading-6 text-ink-muted">{description}</p></div>
        <div><p className="text-sm font-bold text-ink">Seçilen donanım</p><p className="mt-1 text-sm text-ink-muted">{selectedAmenities.length ? selectedAmenities.join(" · ") : "Henüz donanım eklenmedi"}</p></div>
        <div><p className="text-sm font-bold text-ink">Fotoğraflar</p><p className="mt-1 text-sm text-ink-muted">{photos.length + (initial?.gallery.length ?? 0)} fotoğraf · önizleme bu tarayıcıda</p></div>
        <p className="rounded-xl border border-warning-line bg-warning-soft px-4 py-3 text-sm leading-5 text-warning">Bu demo formu ilanı kaydetmez veya moderasyona göndermez.</p>
      </div> : null}
      <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t border-line pt-5 sm:flex-row">{step > 0 ? <Button variant="outline" onClick={() => { setStep((current) => current - 1); setNotice(""); }}><ArrowLeft size={16} /> Geri</Button> : <span />} {step < 3 ? <Button onClick={next}>Devam et <ArrowRight size={16} /></Button> : <Button onClick={submit}>Demo önizlemeyi tamamla <Check size={16} /></Button>}</div>
      {notice ? <p className="mt-4 rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-sm text-info" role="status">{notice}</p> : null}
    </section>
  );
}
