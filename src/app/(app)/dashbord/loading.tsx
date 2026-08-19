import { Skjelett, SkjelettTall, SkjelettTopp } from "@/components/skjelett";

export default function Laster() {
  return (
    <>
      <SkjelettTopp />
      <SkjelettTall />
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="kort p-4">
            <Skjelett className="h-4 w-40" />
            <Skjelett className="mt-4 h-48 w-full" />
          </div>
        ))}
      </div>
    </>
  );
}
