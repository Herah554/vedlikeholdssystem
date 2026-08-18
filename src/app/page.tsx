import { redirect } from "next/navigation";
import { gyldigSesjon } from "@/lib/auth";

/** Rotadressen sender brukeren dit den hører hjemme. */
export default async function Home() {
  const session = await gyldigSesjon();
  redirect(session ? "/dashbord" : "/logg-inn");
}
