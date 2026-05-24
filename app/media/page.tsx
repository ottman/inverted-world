import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"
export const revalidate = 300

export default function MediaPage() {
  redirect("/documents")
}
