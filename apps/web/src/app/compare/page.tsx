import { redirect } from 'next/navigation'

export default function ComparePage() {
  // Redirect to dashboard compare tab, preserving query params
  return redirect('/dashboard?tab=compare')
}
