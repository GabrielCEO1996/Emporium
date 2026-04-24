import { SkeletonListPage } from '@/components/ui/Skeleton'

export default function Loading() {
  return <SkeletonListPage rows={10} columns={6} statCards={4} />
}
