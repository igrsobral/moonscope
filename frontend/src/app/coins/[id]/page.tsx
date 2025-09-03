import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CoinDetailView } from '@/components/coins/coin-detail-view';

interface CoinDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: CoinDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  // TODO: fetch coin data here for better SEO
  return {
    title: `Coin Analysis - MemeAnalyzer`,
    description: `Detailed analysis and real-time data for coin ${id}`,
  };
}

export default async function CoinDetailPage({ params }: CoinDetailPageProps) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  return <CoinDetailView coinId={id} />;
}
