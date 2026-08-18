import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

/** Rotadressen sender brukeren dit den hører hjemme. */
export default async function Home() {
  const session = await getSession();
  redirect(session ? "/dashbord" : "/logg-inn");
}
