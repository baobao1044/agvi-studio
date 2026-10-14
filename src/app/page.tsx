import { Suspense } from "react";
import { AGVIStudio } from "@/components/studio/AGVIStudio";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-[#06080E] flex items-center justify-center text-slate-400 font-mono text-sm">
          Loading AGVI Studio...
        </div>
      }
    >
      <AGVIStudio />
    </Suspense>
  );
}
