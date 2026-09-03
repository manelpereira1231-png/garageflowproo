import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DemoRequests from "@/components/DemoRequests";
import DemoAnalytics from "@/components/admin/DemoAnalytics";

export default function AdminDemoRequests() {
  return (
    <Tabs defaultValue="analytics" className="space-y-4">
      <TabsList>
        <TabsTrigger value="analytics">Analytics da Demo</TabsTrigger>
        <TabsTrigger value="requests">Pedidos de Demonstração</TabsTrigger>
      </TabsList>
      <TabsContent value="analytics">
        <DemoAnalytics />
      </TabsContent>
      <TabsContent value="requests">
        <DemoRequests title="Pedidos de Demonstração" />
      </TabsContent>
    </Tabs>
  );
}
