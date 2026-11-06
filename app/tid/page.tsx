import type { Metadata } from "next";
import { Suspense } from "react";
import TidClient from "./TidClient";
import "./tid.css";

export const metadata: Metadata = {
  title: "Tidsspelet – hur bra är er tidskänsla?",
};

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="tid-loading">Laddar…</div>}>
      <TidClient />
    </Suspense>
  );
}
