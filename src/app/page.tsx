import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  QrCode,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import ScrollAmbientBackground from "@/components/layout/ScrollAmbientBackground";

const features = [
  { icon: QrCode, label: "Identifikasi aset berbasis QR" },
  { icon: BarChart3, label: "Monitoring risiko real-time" },
  { icon: ShieldCheck, label: "Audit K3 dalam satu ruang kerja" },
];

export default function HomePage() {
  return (
    <div className="relative min-h-dvh w-full max-w-full overflow-hidden bg-[#f8faf8]">
      <ScrollAmbientBackground />

      <header className="relative z-20 mx-auto flex h-20 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white bg-white/80 shadow-[0_12px_30px_rgba(8,119,90,0.14)] backdrop-blur-xl">
            <Image src="/logo.png" alt="" width={36} height={36} className="h-9 w-9 object-contain" priority />
          </span>
          <span className="hidden min-w-0 min-[350px]:block">
            <span className="block text-base font-bold tracking-[-0.03em] text-[#102c23]">VocaSafe Lab</span>
            <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-700/60">Keselamatan Terpadu</span>
          </span>
        </Link>

        <Link
          href="/dashboard"
          className="group inline-flex shrink-0 items-center gap-2 rounded-2xl border border-emerald-950/10 bg-white/75 px-3.5 py-2.5 text-sm font-semibold text-emerald-950 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white sm:px-4"
        >
          Masuk
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100dvh-80px)] w-full min-w-0 max-w-7xl items-center gap-10 px-4 pb-16 pt-8 sm:gap-14 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-8 lg:py-16">
        <section className="fade-up min-w-0 max-w-2xl">
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-200/80 bg-white/70 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm backdrop-blur-xl">
            <Sparkles className="h-3.5 w-3.5" />
            Sistem K3 laboratorium yang lebih cerdas
          </div>

          <h1 className="mt-7 text-[2.55rem] font-semibold leading-[1.02] tracking-[-0.055em] text-[#102c23] min-[390px]:text-[2.8rem] sm:text-6xl lg:text-[4.6rem]">
            Keselamatan kerja,
            <span className="gradient-text block">terlihat lebih jelas.</span>
          </h1>

          <p className="mt-7 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Audit alat, laporan bahaya, checklist inspeksi, dan rekomendasi risiko dalam satu pengalaman digital yang tenang, cepat, dan mudah dipahami.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#102c23] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(16,44,35,0.2)] transition hover:-translate-y-1 hover:bg-[#164535]"
            >
              Buka ruang kerja
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-2xl border border-emerald-950/10 bg-white/70 px-6 py-3.5 text-sm font-semibold text-emerald-950 backdrop-blur-xl transition hover:bg-white"
            >
              Lihat sistem audit
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-5 gap-y-3">
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <span className="grid h-7 w-7 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {label}
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Pratinjau sistem VocaSafe Lab" className="relative mx-auto h-[480px] w-full min-w-0 max-w-[560px] overflow-hidden sm:h-[570px] sm:overflow-visible">
          <div className="absolute inset-x-8 top-16 h-80 rounded-full bg-gradient-to-br from-emerald-300/40 via-cyan-200/20 to-violet-300/40 blur-3xl" />

          <div className="float-slow premium-surface absolute left-[8%] right-[3%] top-[7%] rounded-[36px] p-4 shadow-[0_45px_100px_rgba(24,70,55,0.18)] sm:p-5 [transform:perspective(1100px)_rotateY(-7deg)_rotateX(3deg)]">
            <div className="flex items-center justify-between border-b border-emerald-950/[0.07] pb-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#102c23] text-white">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">Pemantauan K3</p>
                  <p className="text-[10px] text-slate-500">4 laboratorium terhubung</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold text-emerald-700">Aktif</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-[#102c23] p-4 text-white shadow-[0_18px_35px_rgba(16,44,35,0.18)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">Aset layak</p>
                <p className="mt-3 text-4xl font-semibold tracking-[-0.05em]">75%</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[75%] rounded-full bg-emerald-300" />
                </div>
              </div>
              <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Arsip audit</p>
                <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-emerald-950">04</p>
                <p className="mt-3 text-[10px] text-slate-500">Tersedia untuk peninjauan berizin</p>
              </div>
            </div>

            <div className="mt-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">Sinyal keselamatan</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Sinyal laporan 6 bulan terakhir</p>
                </div>
                <BarChart3 className="h-4 w-4 text-emerald-700" />
              </div>
              <div className="mt-4 flex h-24 items-end gap-2">
                {[100, 100, 100, 100, 100, 83].map((height, index) => (
                  <div
                    key={`${height}-${index}`}
                    className="motion-bar-y flex-1 rounded-t-lg bg-gradient-to-t from-emerald-600 to-emerald-200"
                    style={{ height: `${height}%`, animationDelay: `${180 + index * 45}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="premium-surface absolute left-0 bottom-[13%] w-[46%] min-w-0 rounded-3xl p-3.5 shadow-[0_24px_55px_rgba(34,74,60,0.16)] sm:w-44 sm:p-4">
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em]">Inspeksi selesai</span>
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-900">96 hasil</p>
            <p className="mt-1 text-[10px] text-slate-500">Hasil inspeksi tercatat</p>
          </div>

          <div className="premium-surface absolute bottom-[5%] right-0 w-[50%] min-w-0 rounded-3xl p-3.5 shadow-[0_24px_55px_rgba(70,48,112,0.14)] [transform:rotate(2deg)] sm:w-48 sm:p-4 sm:[transform:rotate(3deg)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700">Temuan kritis</span>
              <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_0_5px_rgba(239,68,68,0.1)]" />
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900">10</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500">Laporan + checklist perlu prioritas</p>
          </div>
        </section>
      </main>
    </div>
  );
}
