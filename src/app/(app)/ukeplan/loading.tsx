import { Skjelett, SkjelettTopp } from "@/components/skjelett";

export default function Laster() {
  return (
    <>
      <SkjelettTopp />
      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }, (_, dag) => (
          <div key={dag} className="kort p-3">
            <Skjelett className="h-4 w-24" />
            <div className="mt-3 space-y-2">
              {Array.from({ length: dag % 3 === 0 ? 3 : 2 }, (_, i) => (
                <Skjelett key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
