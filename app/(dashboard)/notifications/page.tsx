import { NotificationsCenter } from '@/components/notifications/notifications-center'
import { AuditTrail } from '@/components/notifications/audit-trail'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Bell, Shield } from 'lucide-react'

export const metadata = { title: 'Notifications & Audit — GridMind Capital' }

export default function Page() {
  return (
    <div className="p-6 h-full flex flex-col min-h-0">
      <Tabs defaultValue="notifications" className="flex flex-col flex-1 min-h-0">
        <TabsList className="w-fit mb-6">
          <TabsTrigger value="notifications" className="gap-1.5">
            <Bell size={14} /> Notifications
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5">
            <Shield size={14} /> Audit Trail
          </TabsTrigger>
        </TabsList>
        <TabsContent value="notifications" className="flex-1 min-h-0 mt-0">
          <NotificationsCenter />
        </TabsContent>
        <TabsContent value="audit" className="flex-1 min-h-0 mt-0">
          <AuditTrail />
        </TabsContent>
      </Tabs>
    </div>
  )
}
