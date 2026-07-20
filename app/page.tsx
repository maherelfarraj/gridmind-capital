import { ToastProvider } from '@/components/ui/toast'
import { DesignSystemShowcase } from '@/components/design-system/showcase'

export default function Home() {
  return (
    <ToastProvider position="bottom-right">
      <DesignSystemShowcase />
    </ToastProvider>
  )
}
