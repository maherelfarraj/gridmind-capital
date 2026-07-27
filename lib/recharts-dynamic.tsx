/**
 * Utility for code-splitting recharts components with next/dynamic
 * Reduces initial bundle size by loading charts only when needed
 */

import dynamic from 'next/dynamic'

const ChartSkeleton = () => (
  <div className="w-full h-64 bg-muted animate-pulse rounded-md" />
)

export const DynamicBarChart = dynamic(
  () => import('recharts').then((mod) => mod.BarChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
)

export const DynamicLineChart = dynamic(
  () => import('recharts').then((mod) => mod.LineChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
)

export const DynamicPieChart = dynamic(
  () => import('recharts').then((mod) => mod.PieChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
)

export const DynamicScatterChart = dynamic(
  () => import('recharts').then((mod) => mod.ScatterChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
)

export const DynamicAreaChart = dynamic(
  () => import('recharts').then((mod) => mod.AreaChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
)

export const DynamicRadarChart = dynamic(
  () => import('recharts').then((mod) => mod.RadarChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
)

export const DynamicComposedChart = dynamic(
  () => import('recharts').then((mod) => mod.ComposedChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
)
