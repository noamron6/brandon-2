import { Suspense } from "react";
import SummaryClient from "./SummaryClient";

export default async function SummaryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto px-4 py-20 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full border-4 border-sky-600 border-t-transparent animate-spin" />
          <p className="text-slate-600 font-medium">טוען את דוח החקירה של JHON...</p>
        </div>
      }
    >
      <SummaryClient id={id} />
    </Suspense>
  );
}
