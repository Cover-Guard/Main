import type { Metadata } from 'next'
import { SharedPropertyView } from './SharedPropertyView'

export const metadata: Metadata = { title: 'Shared Property Report' }

interface SharedPageProps {
  params: Promise<{ token: string }>
}

export default async function SharedPropertyPage({ params }: SharedPageProps) {
  const { token } = await params

  return <SharedPropertyView token={token} />
}
